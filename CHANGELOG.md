# Changelog

All notable changes to **AtmoSense AI** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2026-11-19

### Added

- **Multi-Source Live AQI Telemetry Engine (`server/services/aqiService.ts`, `server/routes/aqi.ts`)**:
  - Weighted multi-source fusion across `WAQI` (0.95), `OpenAQ` (0.85), and `OpenWeather` (0.70) with per-source provenance audit trails.
  - Automatic >50% outlier detection and weight dampening (`×0.2`).
  - SHA-256 100-entry, 10-minute TTL LRU cache for current and forecast queries.
  - Exponential backoff retry on 5xx/408 errors, HTTP `429 Retry-After` cooldown compliance, and secret-redacted logging.
- **Official US EPA & WHO 2021 Calculation Engine (`server/lib/aqiEngine.ts`)**:
  - Exact piecewise linear AQI interpolation across $\text{PM}_{2.5}$, $\text{PM}_{10}$, $\text{NO}_2$, $\text{CO}$, and $\text{O}_3$.
  - Dominant pollutant attribution, WHO 2021 24-hour guideline ratio, and 4-persona clinical guidance (`children`, `elderly`, `asthmatics`, `general`).
- **Live Automatic Location Detection (`server/src/services/airQualityService.ts`, `server/src/routes/airQuality.ts`)**:
  - Browser GPS primary geolocation with automatic server-side IP fallback (`ipwho.is` → `geojs.io`).
  - Reverse geocoding (`BigDataCloud` → `OpenStreetMap Nominatim`) and parallel Open-Meteo 24h forecast + meteorology hydration.
- **Server-Side Google Gemini AI & Deterministic Fallback (`server/services/geminiService.ts`, `server/services/heuristicFallback.ts`, `server/routes/ai.ts`)**:
  - Five structured endpoints: `/api/ai/routine`, `/api/ai/chat`, `/api/ai/emergency-advisory`, `/api/ai/analyze-image` (6 MB limit), and `/api/ai/health-insights`.
  - Prompt-injection sanitization, strict Zod output validation, SHA-256 response caching, per-user 30 req/min rate limiting, and deterministic atmospheric physics fallback heuristics (11:00–16:00 solar convection safe window; 06:00–10:00 morning inversion; 17:00–20:00 evening peak).
- **Accessible Real-Time Dashboard (`client/src/components/Dashboard/*`)**:
  - Large `aria-live="polite"` AQI display with icon + text + color status badges.
  - Five `React.memo` pollutant cards (`PM2.5`, `PM10`, `NO2`, `CO`, `O3`) with trend sparklines and WHO/EPA thresholds.
  - Lazy-loaded zero-dependency native SVG 24-hour forecast chart with `.sr-only` accessible summary.
  - Diurnal thermal inversion risk indicator, persona recommendations, dark mode toggle, 10-minute auto-refresh, mobile pull-to-refresh, loading skeletons, retry UI, and Workbox PWA offline indicator.
- **Interactive OpenStreetMap & Leaflet Station Map (`client/src/components/AirQualityMap.tsx`)**:
  - Zero-API-key OSM raster tiles, live AQI dispersion overlays, current-location centering, and jump-to-station drawer.
- **Family Health Protection & Privacy Suite (`client/src/components/Family/*`)**:
  - Multi-member household manager with color-coded avatars, clinical conditions, activity schedules, and high-sensitivity badges.
  - 5-symptom daily tracker linked automatically to timestamp and live AQI.
  - AI symptom–AQI correlation insights gated by explicit user consent, clinician PDF export, AES-256-GCM local encryption, and one-click GDPR complete data erasure.
- **Community Resilience & Environmental Justice Hub (`client/src/components/Community/*`)**:
  - Crowdsourced AQI readings, local smog photo feed, neighborhood AQI disparity heatmap, geotargeted emergency broadcasts, streaks, 6 achievement badges, accessible tabular anonymous leaderboard, and collective $\text{CO}_2$ eco-pledges.
- **7-Layer Express Security Middleware Stack (`server/middleware/security.ts`, `server/middleware/validate.ts`)**:
  - Helmet strict CSP, dynamic CORS origin whitelist (zero wildcards), two-tier IP rate limiter (`30/m` AI, `100/m` data, `/api/health` exempt), recursive HTML sanitization & prototype-pollution stripping, CWE-209 safe error handler, PII-redacted Morgan logs, and timing-safe `X-API-Key` auth.
- **Firebase Auth & Cloud Firestore Persistence (`client/src/lib/firebase.ts`, `firestore.rules`)**:
  - Optional Google Sign-In syncing saved zones, alert thresholds, and archived advisories protected by strict owner-scoped Firestore rules.
- **Comprehensive Test & Documentation Suite**:
  - 142 automated tests across 15 Vitest suites (`89.02%` statements / `91.57%` lines V8 coverage) including MSW mocking and `axe-core` WCAG 2.2 AA verification.
  - Full 11-document engineering suite (`README.md`, `PROBLEM_ALIGNMENT.md`, `ARCHITECTURE.md`, `SECURITY.md`, `EFFICIENCY.md`, `TESTING.md`, `ACCESSIBILITY.md`, `API_DOCUMENTATION.md`, `DEPLOYMENT.md`, `CONTRIBUTING.md`, `CHANGELOG.md`) with live application screenshots.

### Changed & Optimized

- **62% Initial Bundle Reduction (`client/src/App.tsx`, `client/src/context/AuthContext.tsx`)**: Lazy-loaded secondary tabs (`AirQualityMap`, `FamilyManager`, `CommunityHub`, `HealthAssistantPanel`, `SavedZonesPanel`) and dynamically imported Firebase Auth/Firestore SDKs, dropping initial JS from `401.61 KB` to `153.31 KB` gzipped (`171.06 KB` total initial payload).
- **Non-Render-Blocking Typography (`client/index.html`)**: Switched Google Fonts stylesheet to preload + async print-media swap with `<noscript>` fallback.
- **HTTPS OpenWeather Upstream (`server/services/aqiService.ts`)**: Upgraded OpenWeather current and forecast endpoints from HTTP to HTTPS.
- **Production Logging Hygiene (`server/src/index.ts`)**: Replaced startup `console.log` with `console.info` for zero `console.log` calls in production code.

### Fixed

- **OpenAQ v2 HTTP 410 Gone Circuit-Breaker (`server/services/aqiService.ts`)**: Handled permanently retired OpenAQ v2 endpoints cleanly via an in-memory `retiredSources` circuit-breaker and skipped unkeyed live OpenAQ v2 requests without emitting recurring warning logs.
- **Family Tab Responsive Overflow (`client/src/components/Family/*`)**: Eliminated horizontal scrolling across `390px`, `1024px`, and `1440px` viewports using `min-w-0` grid containers and unified responsive layouts.
- **Hosted Preview Compatibility (`vite.config.ts`, `server/middleware/security.ts`)**: Added `allowedHosts: true`, `trust proxy`, iframe-safe `frame-ancestors`, and Cloud Run `*.run.app` origin matching.
