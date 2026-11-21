# Testing Strategy, Coverage Report & Verification Guide

## 1. Testing Philosophy & Pyramid

**AtmoSense AI** follows a fast, deterministic testing pyramid powered by **Vitest 5**, **React Testing Library**, **Mock Service Worker (MSW 3)**, and **axe-core 4**—ensuring every calculation, upstream failover, security boundary, UI state, and WCAG accessibility requirement is verified automatically without relying on flaky external network calls.

```text
                    /-------------------------------\
                    |  Live Headless Chromium E2E   |  playwright-cli (0 console errors,
                    |  Visual & Responsive Audit    |  light/dark, 390px–1440px, live APIs)
                   /---------------------------------\
                   |  API Integration & Accessibility |  Express routes + MSW + axe-core WCAG
                  /-----------------------------------\
                  |  React Component & Hook Testing    |  RTL (Dashboard, Family, Routine, Voice)
                 /-------------------------------------\
                 |  Core Domain, Security & AI Units    |  EPA Math, Fusion, LRU, STRIDE/CWE-209
                 \-------------------------------------/
```

---

## 2. Complete Test Suite Inventory (15 Suites · 142 Tests)

Zero tests are skipped (`it.skip`) and zero tests are isolated (`it.only`).

### 2.1 Backend Test Suites (`server/tests/` & `server/src/`)

| Test File                            | Focus Area                              | Key Scenarios Verified                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/tests/aqiEngine.test.ts`     | US EPA AQI Calculation Engine           | Exact piecewise linear interpolation for PM2.5, PM10, NO2, CO, O3; boundary transitions (50/51, 100/101, 150/151, 200/201, 300/301, 500 cap); dominant pollutant attribution; 4-persona health recommendations; color palettes; invalid/negative input handling.                                                                                                    |
| `server/tests/aqiService.test.ts`    | Multi-Source Fusion, Caching & Failover | WAQI + OpenAQ + OpenWeather parallel fusion; sequential fallback; >50% outlier detection & down-weighting; 10-min SHA-256 LRU cache & 100-entry eviction; exponential backoff retries + token redaction; HTTP 429 `Retry-After` cooldowns; **silent HTTP 410 Gone circuit-breaking**; forecast fallback; `/api/aqi/*` route validation & rate limiting.             |
| `server/tests/geminiService.test.ts` | Server-Side AI & Heuristics             | All 5 Gemini methods (`generateDailyRoutine`, `chat`, `generateEmergencyAdvisory`, `analyzeImage`, `generateHealthInsights`); prompt injection sanitization; strict Zod output validation; deterministic fallback heuristics (11:00–16:00 safe window, 06:00–10:00 morning inversion); SHA-256 query cache; per-user 30 req/min rate limit; PII-free logging.       |
| `server/tests/security.test.ts`      | 7-Layer Security Stack                  | Helmet CSP headers; dynamic CORS whitelist (blocks untrusted origins, rejects wildcards); two-tier rate limiter (30/m AI, 100/m data, skips `/api/health`); prototype pollution stripping & HTML escaping; lat/lng/AQI range validation; CWE-209 error handler (never leaks stack traces or secrets); PII-redacted Morgan logs; timing-safe `X-API-Key` validation. |
| `server/tests/routes.test.ts`        | Full Express API Integration            | `/api/health`, `/api/aqi/*`, `/api/ai/*`, `/api/air-quality/by-coords`, `/api/air-quality/detect-location`, 400 validation paths, and 404 JSON fallback.                                                                                                                                                                                                            |
| `server/src/utils/aqi.vitest.ts`     | Station Utility Math                    | Composite station AQI classification, WHO PM2.5 ratio computation, and lowest-exposure diurnal window selection.                                                                                                                                                                                                                                                    |

### 2.2 Frontend Test Suites (`client/src/tests/` & `client/src/`)

| Test File                                               | Focus Area                  | Key Scenarios Verified                                                                                                                                                                                                                |
| ------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client/src/tests/components/AQIDashboard.test.tsx`     | Main AQI Dashboard          | Real-time AQI display (`aria-live="polite"`), 5 pollutant cards, lazy-loaded SVG forecast chart, inversion risk indicator, persona recommendations, loading skeleton, error state + retry button, offline banner, source attribution. |
| `client/src/tests/components/FamilyManager.test.tsx`    | Family Health & Privacy     | Adding/switching family members, vulnerable person badges, 5-symptom AQI-linked logging, explicit AI consent gate, doctor-visit PDF export trigger, GDPR one-click data erasure.                                                      |
| `client/src/tests/components/RoutineOptimizer.test.tsx` | Personalized Daily Schedule | Time-slot safety rendering, persona switching, morning inversion / afternoon safe window display, API error fallback.                                                                                                                 |
| `client/src/tests/components/VoiceInterface.test.tsx`   | Hands-Free Voice UI         | Speech recognition controls, transcript submission, spoken response toggle, graceful fallback when Web Speech API is unavailable.                                                                                                     |
| `client/src/tests/hooks/useAQI.test.ts`                 | Data Fetching Hook          | MSW-mocked AQI + forecast fetching, 10-minute refresh cadence, coordinate change refetching, error recovery, and abort safety.                                                                                                        |
| `client/src/tests/utils/formatters.test.ts`             | Formatting & Labels         | Relative timestamp formatting, AQI category label/icon mappings, pollutant unit precision, edge cases (`NaN`, `0`, `>500`).                                                                                                           |
| `client/src/tests/accessibility/axe.test.ts`            | WCAG 2.2 AA Automated Audit | `axe-core` zero-violation checks across Dashboard, Routine Optimizer, Voice Interface, and Family Manager components; landmark & ARIA label assertions.                                                                               |
| `client/src/utils/airQuality.vitest.ts`                 | Client Offline Telemetry    | Fallback station hydration and AQI band classification helpers.                                                                                                                                                                       |
| `client/src/components/ErrorBoundary.vitest.tsx`        | React Error Boundary        | Catches child runtime exceptions cleanly and renders accessible recovery UI without crashing the root app.                                                                                                                            |

---

## 3. Verified Code Coverage Report (V8 Provider)

Measured via `npx vitest run --coverage`:

| Scope / Module                                       | Statements |   Branches |  Functions |      Lines |
| ---------------------------------------------------- | ---------: | ---------: | ---------: | ---------: |
| **All Tracked Modules**                              | **89.02%** | **74.56%** | **90.21%** | **91.57%** |
| `client/src/utils/formatters.ts`                     |    100.00% |     96.61% |    100.00% |    100.00% |
| `server/lib/aqiEngine.ts`                            |     98.85% |     98.00% |    100.00% |     98.70% |
| `client/src/components/Routine/RoutineOptimizer.tsx` |     96.96% |     86.20% |    100.00% |     96.96% |
| `server/middleware/security.ts`                      |     96.89% |     83.33% |    100.00% |     96.74% |
| `server/services/heuristicFallback.ts`               |     88.88% |     61.45% |    100.00% |     90.66% |
| `client/src/components/Voice/VoiceInterface.tsx`     |     87.87% |     83.78% |     63.63% |     92.06% |
| `server/services/geminiService.ts`                   |     87.65% |     62.40% |     91.42% |     87.71% |
| `server/services/aqiService.ts`                      |     86.04% |     71.51% |     88.70% |     91.70% |
| `server/middleware/validate.ts`                      |     72.34% |     70.00% |     73.33% |     73.33% |

- **Statement Coverage**: `89.02%` (exceeds `80%` threshold by `+9.02%`)
- **Function Coverage**: `90.21%` (exceeds `80%` threshold by `+10.21%`)
- **Line Coverage**: `91.57%` (exceeds `80%` threshold by `+11.57%`)

---

## 4. How to Run Tests & Quality Gates

```bash
# 1. Run full 142-test suite once (CI mode)
npm run test:ci

# 2. Run in interactive watch mode during development
npm test

# 3. Run with V8 coverage report (text + json-summary)
npx vitest run --coverage

# 4. Run a targeted test file
npx vitest run server/tests/security.test.ts
npx vitest run client/src/tests/accessibility/axe.test.ts

# 5. Run static analysis & build gates
npm run lint           # TypeScript strict check (tsc --noEmit) — 0 errors
npm run lint:eslint    # ESLint v10 check — 0 warnings
npm run build          # Vite production build + Workbox PWA generation
```

---

## 5. Mocking Architecture

- **API Mocking (`msw`)**: Frontend hook and component tests intercept `/api/aqi/*`, `/api/air-quality/*`, and `/api/ai/*` via MSW request handlers configured in `client/src/test/setup.ts`, allowing deterministic simulation of `200 OK`, `429 Rate Limited`, `503 Service Unavailable`, and offline network failures.
- **Firebase Auth Mocking**: Client tests mock `AuthContext` / Firebase Auth modules cleanly so tests run instantaneously in `jsdom` without live Google OAuth popups or external Firestore writes.
- **Deterministic Clocks & Fetch Injection**: `AQIService` and `GeminiService` accept injectable `fetchFn`, `now`, `sleep`, and `logger` dependencies, enabling zero-delay testing of 10-minute LRU expirations, exponential backoff intervals, and rate-limit cooldown windows.
