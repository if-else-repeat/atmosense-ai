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

Implemented in `server/services/aqiService.ts`:

1. **Coordinate Quantization & Cache Lookup**: Coordinates are rounded to `3` decimal places (`~111 m` neighborhood grid) and hashed with SHA-256 (`createAQICacheKey('current', lat, lng)`) into a `100`-entry, `10`-minute TTL LRU cache.
2. **Parallel Provider Acquisition**: Queries `WAQI` (reliability $r = 0.95$), `OpenAQ` ($r = 0.85$, skipped when retired/unkeyed), and `OpenWeather` ($r = 0.70$) concurrently under per-provider sliding-window rate limits (`60 req/min`), request timeouts (`6s`), and exponential backoff (`250ms * 2^attempt`) on `5xx`/`408`.
3. **HTTP 410 Circuit-Breaker**: Any upstream returning `410 Gone` is recorded in `retiredSources` and bypassed on all future requests with zero warning noise.
4. **Consensus Baseline & Outlier Dampening**:
   - Let $B$ be the consensus AQI baseline (weighted median/primary reading among valid providers).
   - For each provider $i$, compute relative deviation:
     $$d_i = \frac{|\text{AQI}_i - B|}{\max(B, 1)}$$
   - If $d_i > 0.50$ (exceeding 50% deviation), mark `isOutlier = true` and multiply reliability weight by `outlierWeightFactor = 0.2`:
     $$w_i = \begin{cases} r_i \times 0.2 & \text{if } d_i > 0.50 \\ r_i & \text{otherwise} \end{cases}$$
   - Normalize weights $\hat{w}_i = w_i / \sum_j w_j$ and compute fused composite AQI and pollutant concentrations, attaching a complete `SourceProvenance[]` audit trail to every response.

### 2.3 Server-Side AI Request Lifecycle (`server/services/geminiService.ts`)

```text
POST /api/ai/*
  │
  ├─► [1] Express Security Stack (Helmet, CORS, Rate Limit 30/min, Sanitize)
  ├─► [2] Zod Request Schema Validation (400 on malformed/out-of-range fields)
  ├─► [3] Prompt Injection Sanitization (strips role overrides & control tokens)
  ├─► [4] SHA-256 Query Cache Lookup (instant hit for identical normalized prompt)
  ├─► [5] Server-Side @google/genai Call (temperature: 0.3, maxOutputTokens: 2048)
  │        ├── Success → Zod Output Schema Validation
  │        │               ├── Valid → Cache & Return Structured JSON
  │        │               └── Invalid → Deterministic Heuristic Fallback
  │        └── Error / Missing Key / Timeout → Deterministic Heuristic Fallback
  └─► [6] PII-Free Structured Log (hashed userTag, operation, latency, cacheHit)
```

---

## 3. Frontend Module Architecture

```text
client/src/
├── App.tsx                       # Workspace shell, GPS/IP auto-location, lazy tab router
├── context/AuthContext.tsx       # Dynamic-import Firebase Auth & Firestore state manager
├── hooks/
│   ├── useAQI.ts                 # 10-min polling, abort-safe fetching, forecast hydration
│   └── usePWAInstall.ts          # beforeinstallprompt capture & standalone detection
├── components/
│   ├── Dashboard/                # Eagerly loaded primary view (Monitor tab)
│   │   ├── AQIDashboard.tsx      # Hero AQI, pull-to-refresh, skeletons, retry state
│   │   ├── PollutantCard.tsx     # React.memo card with sparkline + WHO/EPA progress bar
│   │   ├── ForecastChart.tsx     # Lazy-loaded zero-dep SVG chart + .sr-only table
│   │   ├── InversionIndicator.tsx# Diurnal boundary-layer trapping assessment
│   │   └── HealthRecommendation.tsx
│   ├── AirQualityMap.tsx         # Lazy chunk (46.7 KB gzip): Leaflet + OSM tiles
│   ├── Family/                   # Lazy chunk (12.2 KB gzip): Profiles, Symptoms, Insights
│   ├── Community/                # Lazy chunk (10.5 KB gzip): Feed, EJ Heatmap, Pledges, Board
│   ├── HealthAssistantPanel.tsx  # Lazy chunk (7.8 KB gzip): AI Chat, Routine, Vision
│   ├── SavedZonesPanel.tsx       # Lazy chunk (3.9 KB gzip): Firestore-synced zones
│   ├── Routine/RoutineOptimizer.tsx
│   ├── Voice/VoiceInterface.tsx
│   ├── ErrorBoundary.tsx         # React error boundary with recovery UI
│   └── OfflineIndicator.tsx      # Service worker / navigator.onLine status bar
├── lib/
│   ├── firebase.ts               # Lazy-imported Firebase App + Auth + Firestore dbId
│   └── firestoreRepo.ts          # Owner-scoped CRUD + real-time snapshot listeners
└── utils/
    ├── airQuality.ts             # Offline calibrated fallback stations
    └── formatters.ts             # Relative time, AQI category badges, unit formatting
```

---

## 4. Architecture Decision Records (ADRs)

### ADR-001: Server-Side Proxy for All AI & Sensor API Keys

- **Status**: Accepted
- **Context**: Exposing `GEMINI_API_KEY`, `WAQI_API_TOKEN`, or `OPENWEATHER_API_KEY` in client bundles (`VITE_*`) allows trivial key extraction, billing abuse, and quota exhaustion.
- **Decision**: Route all AI and multi-source AQI calls through Express endpoints (`/api/ai/*`, `/api/aqi/*`, `/api/air-quality/*`). Only public Firebase web config remains client-side, protected by Firestore Security Rules.
- **Consequences**: Zero secret exposure in compiled `dist/` assets; central rate limiting, Zod validation, and caching apply uniformly across all clients.

### ADR-002: Deterministic Atmospheric Fallback Heuristics for AI Resilience

- **Status**: Accepted
- **Context**: Upstream LLM services can experience transient outages, latency spikes, or unconfigured keys in local/CI environments. Public health tools must never fail blank during hazardous air episodes.
- **Decision**: Implement `server/services/heuristicFallback.ts` encoding WHO/EPA clinical thresholds and urban boundary-layer physics (06:00–10:00 morning inversion danger, 11:00–16:00 solar convection safe window, 17:00–20:00 evening peak) and invoke it automatically whenever Gemini fails or fails Zod validation.
- **Consequences**: 100% endpoint availability and deterministic testability without sacrificing structured JSON contracts.

### ADR-003: Native SVG Forecast Chart Over Third-Party Charting Libraries

- **Status**: Accepted
- **Context**: Libraries like Recharts, Chart.js, or ECharts add 60–180 KB gzipped and often generate inaccessible canvas bitmaps or complex ARIA trees.
- **Decision**: Build `ForecastChart.tsx` as a lazy-loaded, pure native SVG component (`3.02 KB` gzipped) with explicit ARIA labeling, keyboard point selection, shaded convection mixing bands, and a parallel `.sr-only` data summary.
- **Consequences**: Minimal bundle overhead, crisp HiDPI rendering in both light and dark modes, and effortless WCAG 2.2 AA compliance.

### ADR-004: Zero-API-Key Leaflet + OpenStreetMap for Spatial Telemetry

- **Status**: Accepted
- **Context**: Proprietary map SDKs require billing-enabled browser keys and add significant runtime weight.
- **Decision**: Use Leaflet 1.9.4 with OpenStreetMap raster tiles inside a `React.lazy` route chunk (`46.67 KB` gzipped), loaded only when the user opens the Map tab.
- **Consequences**: Zero map billing dependencies, immediate open-source portability, and zero impact on initial Monitor tab load time.

### ADR-005: Multi-Source Fusion with >50% Outlier Dampening & Silent HTTP 410 Circuit-Breaker

- **Status**: Accepted
- **Context**: Individual urban air quality monitors frequently drift or report erroneous spikes, and public APIs evolve (e.g., OpenAQ retired its unauthenticated v2 API with HTTP `410 Gone`).
- **Decision**: Fuse `WAQI`, `OpenAQ`, and `OpenWeather` by base reliability weights, down-weight any provider deviating by `>50%` from consensus (`×0.2`), and permanently circuit-break any source returning HTTP `410 Gone` in memory without warning log spam.
- **Consequences**: Resilient, auditable AQI readings with full provenance and clean production logs.

### ADR-006: Route-Level Code Splitting & Dynamic Firebase Imports

- **Status**: Accepted
- **Context**: Eagerly importing Leaflet, Firebase Firestore, and all five workspace tabs produced a `401.6 KB` gzipped initial JS chunk.
- **Decision**: Convert secondary tabs (`AirQualityMap`, `FamilyManager`, `CommunityHub`, `HealthAssistantPanel`, `SavedZonesPanel`) to `React.lazy` and dynamically `import()` `firebase/auth` and `firestoreRepo` inside `AuthContext.tsx` so Firestore is only fetched when authenticated.
- **Consequences**: Reduced initial JS entry chunk by **62%** (`401.6 KB` → `153.3 KB` gzipped; `171.1 KB` total initial payload including CSS and HTML), comfortably beneath the `300 KB` gzipped performance budget.

### ADR-007: Privacy-First Family Health Storage & Explicit AI Consent

- **Status**: Accepted
- **Context**: Household respiratory symptoms constitute sensitive personal health data under GDPR Article 9 and general health privacy norms.
- **Decision**: Encrypt family health records locally with AES-256-GCM, exclude all health fields from request logs and analytics, gate AI correlation behind an explicit opt-in consent checkbox, and provide a one-click GDPR full deletion control.
- **Consequences**: Users retain complete ownership of respiratory logs while still accessing AI correlation insights on demand.

### ADR-008: Strict Owner-Scoped Firestore Security Rules

- **Status**: Accepted
- **Context**: Authenticated users sync personal monitoring zones, alert thresholds, and saved advisories in Cloud Firestore.
- **Decision**: Enforce path-level ownership (`request.auth != null && request.auth.uid == userId`), strict field whitelisting, type/bounds validation, and immutable `uid`/`createdAt` invariants in `firestore.rules`.
- **Consequences**: Zero cross-tenant data access and defense-in-depth independent of client UI logic.
