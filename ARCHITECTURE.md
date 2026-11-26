# System Architecture & Architecture Decision Records (ADRs)

## 1. Architectural Overview

**AtmoSense AI** follows a **modular monolith / BFF (Backend-for-Frontend) full-stack architecture** written end-to-end in strict TypeScript. A single Express 5 server serves both the REST API surface (`/api/*`) and the Vite-built React 19 Progressive Web Application (`dist/`), eliminating CORS misconfigurations in single-origin deployments while still supporting dynamic whitelisted cross-origin clients.

### 1.1 High-Level Component Topology

```text
                          +------------------------------------+
                          |       Browser / Mobile PWA         |
                          |  React 19 + Tailwind v4 + Workbox  |
                          +-----------------+------------------+
                                            |
              +-----------------------------+-----------------------------+
              | (HTTPS REST API)                                          | (HTTPS SDK)
              v                                                           v
+-------------+------------------------------------+     +----------------+-----------------+
|             Express 5 API Gateway                |     |     Firebase Cloud Platform      |
|  1. Helmet Strict CSP & Security Headers         |     |  - Firebase Auth (Google OAuth)  |
|  2. Dynamic CORS Whitelist (credentials: true)   |     |  - Cloud Firestore (User-scoped  |
|  3. Split JSON Body Parsers (256KB / 6MB Vision) |     |    savedLocations, advisories,   |
|  4. PII-Redacted Morgan Request Logger           |     |    user profile preferences)     |
|  5. Two-Tier IP Rate Limiter (30/m AI, 100/m API)|     +----------------------------------+
|  6. Optional Timing-Safe X-API-Key Auth          |
|  7. Deep Input Sanitizer + Range Validator       |
+----+--------------------+-------------------+----+
     |                    |                   |
     v                    v                   v
+----+----------+  +------+---------+  +------+-----------------+
| Air Quality   |  | Multi-Source   |  | Server-Side AI Engine  |
| & Geo Service |  | AQIService     |  | (GeminiService)        |
| - 8 Stations  |  | - WAQI (0.95)  |  | - Prompt Sanitizer     |
| - GPS/IP Geo  |  | - OpenAQ (0.85)|  | - SHA-256 Query Cache  |
| - Reverse Geo |  | - OWM (0.70)   |  | - Per-User Rate Limit  |
| - Open-Meteo  |  | - Outlier Damp |  | - Zod JSON Validator   |
|   24h + Wx    |  | - 410 Breaker  |  | - HeuristicFallback    |
+---------------+  | - SHA-256 LRU  |  +-----------+------------+
                   +-------+--------+              |
                           |                       v
                           |            +----------+------------+
                           |            | Google Gemini API     |
                           v            | (@google/genai SDK)   |
              +------------+---------+  +-----------------------+
              | External Sensor APIs |
              | WAQI / OWM / Open-   |
              | Meteo / BigDataCloud |
              +----------------------+
```

---

## 2. Core Data Pipelines

### 2.1 Location Detection & Live Station Resolution Flow

```text
User Opens App / Clicks "My Location"
   │
   ├──[1] navigator.geolocation.getCurrentPosition() (5.5s–9s timeout)
   │        ├── Success → GET /api/air-quality/by-coords?lat=...&lng=...
   │        └── Denied / Timeout / Iframe Blocked
   │                 │
   │                 ▼
   └──[2] GET /api/air-quality/detect-location (Server-side IP Geolocation)
            ├── Primary:  https://ipwho.is/{clientIp}
            └── Fallback: https://get.geojs.io/v1/ip/geo/{clientIp}.json
                      │
                      ▼
            getStationByCoordinates(lat, lng) [Parallel Promise.all]:
              ├── aqiService.getCurrentAQI(lat, lng)  → Fused WAQI + OpenWeather AQI
              ├── Open-Meteo Air Quality              → 24h Hourly Forecast Trajectory
              ├── Open-Meteo Weather                  → Temp (°C), Humidity (%), Wind (km/h)
              └── Reverse Geocode                     → BigDataCloud → OSM Nominatim
```

### 2.2 Multi-Source Data Fusion & Outlier Dampening Algorithm

Implemented in `server/src/services/aqiService.ts` and `server/src/services/aqi/`:

1. **Coordinate Quantization & Cache Lookup**: Coordinates are rounded to `3` decimal places (`~111 m` neighborhood grid) and hashed with SHA-256 (`createAQICacheKey('current', lat, lng)`) into a `100`-entry, `10`-minute TTL LRU cache (`server/src/services/aqi/cache.ts`).
2. **Parallel Provider Acquisition**: Queries `WAQI` (reliability $r = 0.95$), `OpenAQ` ($r = 0.85$, skipped when retired/unkeyed), and `OpenWeather` ($r = 0.70$) concurrently under per-provider sliding-window rate limits (`60 req/min`), request timeouts (`6s`), and exponential backoff (`250ms * 2^attempt`) on `5xx`/`408`.
3. **HTTP 410 Circuit-Breaker**: Any upstream returning `410 Gone` is recorded in `retiredSources` and bypassed on all future requests with zero warning noise.
4. **Consensus Baseline & Outlier Dampening**:
   - Let $B$ be the consensus AQI baseline (weighted median/primary reading among valid providers).
   - For each provider $i$, compute relative deviation:
     $$d_i = \frac{|\text{AQI}_i - B|}{\max(B, 1)}$$
   - If $d_i > 0.50$ (exceeding 50% deviation), mark `isOutlier = true` and multiply reliability weight by `outlierWeightFactor = 0.2`:
     $$w_i = \begin{cases} r_i \times 0.2 & \text{if } d_i > 0.50 \\ r_i & \text{otherwise} \end{cases}$$
   - Normalize weights $\hat{w}_i = w_i / \sum_j w_j$ and compute fused composite AQI and pollutant concentrations, attaching a complete `SourceProvenance[]` audit trail to every response.

### 2.3 Server-Side AI Request Lifecycle (`server/src/services/geminiService.ts`)

```text
POST /api/ai/*
  │
  ├─► [1] Express Security Stack (Helmet, CORS, Rate Limit 30/min, Sanitize)
  ├─► [2] Zod Request Schema Validation (400 on malformed/out-of-range fields)
  ├─► [3] Prompt Injection Guard (sanitizePromptInput + scanPromptInjection)
  ├─► [4] SHA-256 Query Cache Lookup (instant hit for identical normalized prompt)
  ├─► [5] Server-Side @google/genai Call (temperature: 0.3, maxOutputTokens: 2048)
  │        ├── Success → Zod Schema + Output Safety Guard (validateGeminiOutputSafety)
  │        │               ├── Valid & Safe → Cache & Return Structured JSON
  │        │               └── Invalid / Unsafe → Deterministic Heuristic Fallback
  │        └── Error / Missing Key / Timeout → Deterministic Heuristic Fallback
  └─► [6] PII-Free Structured Log (hashed userTag, operation, latency, cacheHit)
```

---

## 3. Frontend & Backend Module Architecture

```text
client/src/
├── App.tsx                          # Workspace shell, semantic landmarks, GPS/IP auto-location, lazy tab router
├── context/AuthContext.tsx          # Dynamic-import Firebase Auth & Firestore state manager
├── hooks/
│   ├── useAQI.ts                    # 10-min polling, abort-safe fetching, forecast hydration
│   ├── useStationNetwork.ts         # Curated station network + hyperlocal coordinate state
│   ├── aqiTelemetry.ts              # Normalized station/forecast fetch orchestration
│   └── usePWAInstall.ts             # beforeinstallprompt capture & standalone detection
├── components/
│   ├── ActionHub/                   # WinterSmogActionHub, SustainableAlternatives, IndoorAirHacks
│   ├── Dashboard/                   # AQIDashboard, PollutantCard, ForecastChart, ForecastSvgPlot, InversionIndicator
│   ├── Map/                         # MapControls paired with lazy AirQualityMap.tsx (Leaflet + OSM)
│   ├── Family/                      # FamilyManager, SymptomTracker, SymptomLogForm, SymptomHistoryList, HealthInsights, InsightCard
│   ├── Community/                   # CommunityHub, CommunityHeader, CommunityFeed, EnvironmentalJustice, PledgeSystem, Leaderboard
│   ├── Assistant/                   # Modular AI Assistant panels paired with lazy HealthAssistantPanel.tsx
│   ├── SavedZonesPanel.tsx          # Lazy chunk: local & synced monitoring zones
│   ├── Routine/RoutineOptimizer.tsx # Personalized low-emission daily schedule
│   ├── Voice/VoiceInterface.tsx     # Web Speech API hands-free audio controls
│   ├── ErrorBoundary.tsx            # React error boundary with accessible recovery UI
│   └── OfflineIndicator.tsx         # Service worker / navigator.onLine status bar
└── utils/
    ├── airQuality.ts                # Offline calibrated fallback stations
    ├── healthCrypto.ts              # Browser-local AES-256-GCM encryption
    ├── locationStorage.ts           # Cached geolocation + online auto-refresh helpers
    ├── personaGuidance.ts           # Pure clinical persona selection + personaTemplates.ts
    ├── smogImpactEngine.ts          # Direct lung PM2.5, CO2/NOx & Corsi-Rosenthal CADR math
    └── formatters.ts                # Relative time, AQI category badges, unit formatting

server/src/
├── index.ts                         # Express 5 app assembly + SPA static/Vite middleware
├── lib/aqiEngine.ts                 # Official US EPA piecewise linear AQI & WHO 2021 calculations
├── middleware/                      # security.ts, securityHelpers.ts, validate.ts
├── routes/                          # airQuality.ts, aqi.ts, ai.ts (all Zod + rate-limit enforced)
└── services/
    ├── aqi/                         # cache.ts, fusion.ts, parsers.ts, forecastParsers.ts, types.ts
    ├── fallback/                    # Deterministic WHO/EPA & inversion fallback heuristics
    ├── gemini/                      # prompts.ts, schemas.ts, security.ts, outputGuard.ts, stationBrief.ts
    ├── aqiService.ts                # Unified multi-source AQI service
    ├── airQualityService.ts         # Curated stations, hyperlocal lookup & IP geolocation
    └── geminiService.ts             # Single consolidated server-side Gemini AI service
```

---

## 4. Architecture Decision Records (ADRs)

Full Architecture Decision Records (**ADR-001 through ADR-005**) and engineering quality standards are maintained in:

- **[docs/DECISIONS.md](./docs/DECISIONS.md)** — Detailed ADR trade-offs covering multi-source fusion & outlier dampening, server-side Gemini guardrails & deterministic fallback, AES-256-GCM health privacy, native SVG/Leaflet zero-bloat frontend, and single-manifest architecture conventions.
- **[CODE_QUALITY.md](./CODE_QUALITY.md)** — Module size caps (`<= 260` lines target / `<= 300` hard cap), strict linting, layer boundary rules, and automated enforcement via `server/tests/conventions.test.ts`.
