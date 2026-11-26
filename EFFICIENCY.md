# Performance Engineering, Caching Architecture & Efficiency Benchmarks

## 1. Executive Summary

**AtmoSense AI** is engineered for fast first paint on mobile urban networks, predictable server throughput under multi-user traffic, and resilient offline operation. By combining route-level code splitting, dynamic Firebase module loading, zero-dependency native SVG charting, and multi-tier SHA-256 LRU + Workbox caching, the production client delivers a **`171.06 KB` gzipped initial load** (**43% below** the `300 KB` gzipped target).

---

## 2. Production Bundle Benchmarks (Measured via `vite build`)

### 2.1 Before vs. After Code-Splitting Optimization

| Metric                                       | Before Optimization | After Optimization | Delta      | Target         |
| -------------------------------------------- | ------------------- | ------------------ | ---------- | -------------- |
| **Initial Entry JS (gzipped)**               | `401.61 KB`         | **`153.31 KB`**    | **-61.8%** | `< 300 KB`     |
| **Initial CSS (gzipped)**                    | `16.79 KB`          | **`16.82 KB`**     | `+0.03 KB` | `< 30 KB`      |
| **Initial HTML (gzipped)**                   | `0.90 KB`           | **`0.93 KB`**      | `+0.03 KB` | `< 5 KB`       |
| **Total Initial Critical Payload (gzipped)** | `419.30 KB`         | **`171.06 KB`**    | **-59.2%** | **`< 300 KB`** |
| **Vite Production Build Time**               | `2.32 s`            | **`1.20 s`**       | **-48.3%** | `< 10 s`       |

### 2.2 Complete Chunk Breakdown (`dist/assets/*`)

| Chunk                       |    Raw Size |    Gzipped Size | Load Strategy        | Purpose                                                            |
| --------------------------- | ----------: | --------------: | -------------------- | ------------------------------------------------------------------ |
| `index-*.js`                | `520.70 KB` | **`153.31 KB`** | Eager (Initial)      | React 19 runtime, Workspace shell, `AQIDashboard`, `PollutantCard` |
| `index-*.css`               |  `75.74 KB` |  **`16.82 KB`** | Eager (Initial)      | Atomic Tailwind CSS v4 (light + dark theme)                        |
| `index.html`                |   `2.20 KB` |   **`0.93 KB`** | Eager (Initial)      | SPA entry with preconnect & non-blocking font loading              |
| `ForecastChart-*.js`        |  `10.52 KB` |   **`3.02 KB`** | Lazy (`React.lazy`)  | Native zero-library 24-hour SVG forecast trajectory                |
| `AirQualityMap-*.js`        | `160.44 KB` |  **`46.67 KB`** | Lazy (Map Tab)       | Leaflet 1.9.4 + OpenStreetMap interactive station map              |
| `FamilyManager-*.js`        |  `50.26 KB` |  **`12.15 KB`** | Lazy (Family Tab)    | Household profiles, 5-symptom tracker, AI insights, PDF export     |
| `CommunityHub-*.js`         |  `47.08 KB` |  **`10.53 KB`** | Lazy (Community Tab) | Crowdsourced AQI, EJ heatmap, leaderboard, eco-pledges             |
| `HealthAssistantPanel-*.js` |  `32.81 KB` |   **`7.79 KB`** | Lazy (Health AI Tab) | Conversational pulmonary assistant, routine & vision UI            |
| `SavedZonesPanel-*.js`      |  `17.19 KB` |   **`3.85 KB`** | Lazy (Saved Zones)   | Firestore-synced monitoring locations & alert thresholds           |
| `firebase-*.js`             | `468.03 KB` | **`141.24 KB`** | Dynamic `import()`   | Firebase Auth & App SDK loaded asynchronously post-mount           |
| `firestoreRepo-*.js`        |   `4.81 KB` |   **`1.70 KB`** | Dynamic (Signed-in)  | Cloud Firestore queries loaded only for authenticated users        |
| `workbox-window-*.js`       |   `5.65 KB` |   **`2.20 KB`** | Deferred SW Reg      | PWA service worker registration & offline lifecycle                |

---

## 3. Multi-Tier Caching Strategy

AtmoSense AI uses **four coordinated cache layers** to minimize upstream API quota burn, eliminate duplicate Gemini tokens, and guarantee instant repeat views:

| Tier                              | Location                                            | Key Strategy                                                                  | Capacity & TTL                                                         | Eviction / Invalidation                                                                              |
| --------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Tier 1: PWA Service Worker**    | Browser (Workbox `sw.js`)                           | Asset hash precache + URL match (`/api/air-quality.*`, Google Fonts)          | `30` precache entries; `30` API entries (`30 min` TTL); Fonts `1 year` | `CacheFirst` for fonts/shell, `NetworkFirst` (`4s` timeout) for live telemetry                       |
| **Tier 2: Multi-Source AQI LRU**  | Server (`AQIService`)                               | `SHA-256("${kind}:${lat.toFixed(3)},${lng.toFixed(3)}")` (~111m spatial grid) | `100` entries per cache (`current` & `forecast`), **`10 min` TTL**     | $O(1)$ JavaScript `Map` LRU eviction on capacity overflow; HTTP `Cache-Control: public, max-age=120` |
| **Tier 3: Dynamic Station Cache** | Server (`server/src/services/airQualityService.ts`) | `"${id}:${lat.toFixed(2)},${lng.toFixed(2)}"`                                 | **`5 min` TTL**                                                        | Bypassed explicitly via `?refresh=1` on user-triggered pull-to-refresh or Refresh click              |
| **Tier 4: Gemini AI Query Cache** | Server (`server/src/services/geminiService.ts`)     | `SHA-256` over normalized operation + sanitized prompt inputs                 | **`10 min` TTL**                                                       | Returns cached Zod-validated response in `< 1 ms` with zero upstream LLM cost                        |

### Upstream Resilience & Latency Savings

- **Silent HTTP 410 Circuit-Breaker**: Once an upstream provider returns `410 Gone` (e.g., retired OpenAQ v2), `AQIService` records it in `retiredSources` (`Set<AQISourceName>`). Subsequent requests skip the dead endpoint in **`0 ms`** instead of wasting `250–600 ms` per request.
- **Unkeyed OpenAQ v2 Skip**: Live instances without `OPENAQ_API_KEY` skip OpenAQ v2 immediately on cold start, eliminating even the initial `410` round-trip.
- **Parallel Upstream Acquisition**: `getStationByCoordinates` executes `aqiService.getCurrentAQI`, Open-Meteo 24h forecast, Open-Meteo current weather, and reverse geocoding concurrently via `Promise.all()`, bounding total latency to `max(provider_latencies)` instead of their sum.

---

## 4. Runtime Rendering & Algorithmic Efficiency

| Optimization                             | Implementation Location                             | Complexity / Benefit                                                                                  |
| ---------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **`React.memo` Pollutant Cards**         | `client/src/components/Dashboard/PollutantCard.tsx` | Prevents re-rendering all 5 pollutant sparkline cards when unrelated dashboard UI state changes       |
| **Memoized AQI & Trend Computations**    | `client/src/components/Dashboard/AQIDashboard.tsx`  | `useMemo` caches EPA status badges, WHO ratios, and chart scales across parent re-renders             |
| **AbortController Request Cancellation** | `client/src/hooks/useAQI.ts`                        | Cancels stale in-flight fetches immediately when switching stations or auto-detecting GPS coordinates |
| **$O(1)$ LRU Cache Operations**          | `server/src/services/aqi/cache.ts` (`LRUCache`)     | `Map.delete` + `Map.set` keeps `get()`, `set()`, and LRU eviction strictly $O(1)$                     |
| **$O(1)$ EPA Breakpoint Interpolation**  | `server/src/lib/aqiEngine.ts`                       | Fixed 6–7 band table lookup across 5 pollutants completes in `< 0.05 ms` per reading                  |
| **Zero-Cost Fallback Heuristics**        | `server/src/services/fallback/`                     | Generates full structured `RoutinePlan` or emergency advisory in `< 1 ms` when AI is unavailable      |

---

## 5. Lighthouse & Core Web Vitals Optimization Architecture

Every Lighthouse category is engineered against `>= 95` targets:

| Lighthouse Category | Key Engineering Controls Implemented                                                                                                                                                                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Performance**     | `171.06 KB` gzipped initial payload (`< 300 KB`); route-level `React.lazy` for Map/Family/Community/AI/Saved tabs; async dynamic import for Firebase SDK; lazy-loaded `3.02 KB` native SVG chart; preconnected `fonts.googleapis.com` / `fonts.gstatic.com`; explicit dimensions on cards and chart viewBox (`CLS ≈ 0`). |
| **Accessibility**   | Verified `0` violations via `axe-core` & mathematical contrast audits (`client/src/tests/accessibility/`); WCAG 2.2 AA contrast (`> 4.5:1`); `aria-live="polite"` on live AQI; icon + text + color badges; `.sr-only` chart descriptions; global `:focus-visible`; tabular leaderboard fallback.                         |
| **Best Practices**  | Strict Helmet CSP, HTTPS upstream endpoints (`WAQI`, `OpenWeather`, `Open-Meteo`), zero console errors/warnings in Chromium verification, CWE-209 safe error handling, no deprecated APIs.                                                                                                                               |
| **SEO & PWA**       | Semantic `<header>`, `<nav>`, `<main>`, `<footer>`, descriptive `<title>`, `<meta name="description">`, OpenGraph + Twitter meta tags, `manifest.webmanifest` with maskable `512×512` icons, Workbox service worker offline fallback.                                                                                    |

### Measured Local Server Response Benchmarks

| Endpoint                                      |          Cache Miss (Live Upstream) |      Cache Hit (LRU / Query Cache) |
| --------------------------------------------- | ----------------------------------: | ---------------------------------: |
| `GET /api/health`                             |                            `< 2 ms` |                           `< 2 ms` |
| `GET /api/aqi/sources`                        |                            `< 3 ms` |                           `< 3 ms` |
| `GET /api/aqi/current?lat=28.6139&lng=77.209` | `~420–780 ms` (parallel WAQI + OWM) |  **`< 3 ms`** (10-min SHA-256 LRU) |
| `GET /api/air-quality/by-coords`              |   `~550–950 ms` (parallel 4-source) | **`< 4 ms`** (5-min station cache) |
| `POST /api/ai/routine` (fallback / cached)    |                          `~4–20 ms` |    **`< 2 ms`** (SHA-256 AI cache) |

---

## 6. Reproducing Benchmarks

```bash
# Measure production bundle sizes & gzipped chunks
npm run build

# Inspect server cache hit/miss ratios live
curl -s http://localhost:3000/api/aqi/sources | jq '.cache'

# Measure live API latency (miss vs hit)
curl -o /dev/null -s -w "Miss: %{time_total}s\n" "http://localhost:3000/api/aqi/current?lat=28.6139&lng=77.209"
curl -o /dev/null -s -w "Hit:  %{time_total}s\n" "http://localhost:3000/api/aqi/current?lat=28.6139&lng=77.209"
```
