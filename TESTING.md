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

## 2. Complete Test Suite Inventory (29 Suites · 197 Tests)

Zero tests are skipped (`it.skip`) and zero tests are isolated (`it.only`). All tests live in two canonical roots (`server/tests/` and `client/src/tests/`) plus `firestore.rules.test.ts`.

### 2.1 Backend & Architecture Test Suites (`server/tests/` & `firestore.rules.test.ts`)

| Test File                             | Focus Area                            | Key Scenarios Verified                                                                                                                                                                                                                  |
| ------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/tests/aqiEngine.test.ts`      | US EPA AQI Calculation Engine         | Exact piecewise linear interpolation for PM2.5, PM10, NO2, CO, O3; boundary transitions (50/51, 100/101, 150/151, 200/201, 300/301, 500 cap); dominant pollutant attribution; 4-persona health recommendations; invalid input handling. |
| `server/tests/aqiFusion.test.ts`      | Multi-Source Weighted Fusion          | Parallel WAQI + OpenAQ + OpenWeather weighted fusion, >50% outlier detection & weight dampening (`×0.2`), provenance audit trails, and sequential failover.                                                                             |
| `server/tests/aqiProviders.test.ts`   | Provider Resilience & Circuit Breaker | Exponential backoff retries, URL token redaction, HTTP 429 `Retry-After` cooldowns, silent HTTP 410 Gone circuit-breaking, and forecast fallback.                                                                                       |
| `server/tests/aqiCache.test.ts`       | SHA-256 LRU Cache & `/api/aqi/*`      | 10-min SHA-256 spatial LRU cache, 100-entry eviction, `/api/aqi/*` Zod validation and sliding-window rate limiting.                                                                                                                     |
| `server/tests/aqiUtils.test.ts`       | Station Utility Math                  | Composite station AQI classification, WHO PM2.5 ratio computation, and lowest-exposure diurnal window selection.                                                                                                                        |
| `server/tests/geminiSecurity.test.ts` | Prompt Injection & Output Guardrails  | `sanitizePromptInput`, `scanPromptInjection`, `validateGeminiOutputSafety` (hallucinated AQI >40 drift & unsafe medical dosing checks), strict Zod output validation.                                                                   |
| `server/tests/geminiFeatures.test.ts` | Server-Side Gemini Capabilities       | All 5 Gemini methods (`generateDailyRoutine`, `chat`, `generateEmergencyAdvisory`, `analyzeImage`, `generateHealthInsights`) plus structured fallback behavior.                                                                         |
| `server/tests/geminiRunner.test.ts`   | AI Cache, Rate Limits & Logging       | SHA-256 deterministic query cache, per-user 30 req/min rate limiter, timeout failover, and PII-free hashed-tag logging.                                                                                                                 |
| `server/tests/fallback.test.ts`       | Deterministic Offline Heuristics      | Full offline coverage of routines, chat, moderate/severe/critical emergency bulletins, 3 image modes, and symptom–AQI correlations.                                                                                                     |
| `server/tests/security.test.ts`       | 7-Layer Security Stack                | Helmet CSP + Permissions-Policy, dynamic CORS allowlist, two-tier rate limiter, prototype pollution & HTML sanitization, range validation, CWE-209 error handler, PII-redacted Morgan logs, timing-safe `X-API-Key`.                    |
| `server/tests/routes.test.ts`         | Full Express API Integration          | `/api/health`, `/api/aqi/*`, `/api/ai/*`, `/api/air-quality/by-coords`, `/api/air-quality/detect-location`, 400 validation paths, and 404 JSON fallback.                                                                                |
| `server/tests/conventions.test.ts`    | Automated Architecture Gate           | Verifies all 113 production files `<= 300` lines (all `<= 260`), zero `any`/unsafe patterns (`eval`, `new Function`, `dangerouslySetInnerHTML`), strict client/server boundaries, and Zod + rate limiting on every route module.        |
| `firestore.rules.test.ts`             | Cloud Firestore Security Invariants   | Owner-only access, `email_verified == true`, `allow list: if false` on `/users`, append-only `/advisories`, bounded payload size, and Dirty Dozen adversarial checks.                                                                   |

### 2.2 Frontend & Accessibility Test Suites (`client/src/tests/`)

| Test File                                                  | Focus Area                       | Key Scenarios Verified                                                                                                                                                                                         |
| ---------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client/src/tests/components/AQIDashboard.test.tsx`        | Main AQI Dashboard               | Live AQI (`aria-live="polite"`), 5 pollutant cards, lazy SVG forecast chart, inversion risk, persona advice, pull-to-refresh, skeletons, retry state, offline banner.                                          |
| `client/src/tests/components/WinterSmogActionHub.test.tsx` | Challenge 6 Action Hub           | Lifestyle profile tailoring, sustainable swap toggles, live direct impact summary, and DIY Corsi-Rosenthal IAQ calculator.                                                                                     |
| `client/src/tests/components/FamilyManager.test.tsx`       | Family Health & Privacy          | Household profiles, vulnerable badges, 5-symptom AQI-linked logging, explicit AI consent gate, doctor-visit PDF export, GDPR one-click erasure.                                                                |
| `client/src/tests/components/RoutineOptimizer.test.tsx`    | Personalized Daily Schedule      | Time-slot safety rendering, persona switching, morning inversion / afternoon safe window display, API error fallback.                                                                                          |
| `client/src/tests/components/VoiceInterface.test.tsx`      | Hands-Free Voice UI              | Speech recognition controls, transcript submission, spoken response toggle, graceful fallback when Web Speech API is unavailable.                                                                              |
| `client/src/tests/components/TrendChartSvg.test.tsx`       | Native SVG Trend Chart           | Pollutant tab switching, WHO guideline ceiling rendering, interactive hover/click crosshair snapping.                                                                                                          |
| `client/src/tests/components/ErrorBoundary.test.tsx`       | React Error Boundary             | Catches child runtime exceptions cleanly and renders accessible recovery UI without crashing the root shell.                                                                                                   |
| `client/src/tests/hooks/useAQI.test.ts`                    | Data Fetching Hook               | MSW-mocked AQI + forecast fetching, 10-minute refresh cadence, coordinate refetching, error recovery, abort safety.                                                                                            |
| `client/src/tests/utils/smogImpactEngine.test.ts`          | Direct Impact & CADR Math        | Lung PM2.5 reduction %, monthly CO2/NOx avoided, 500-family neighborhood airshed scaling, Corsi-Rosenthal CADR/ACH clear times.                                                                                |
| `client/src/tests/utils/healthCrypto.test.ts`              | AES-256-GCM Local Vault          | Unique random IVs, authenticated ciphertext tamper rejection, mismatched scope rejection, vault persistence & GDPR wipe.                                                                                       |
| `client/src/tests/utils/locationStorage.test.ts`           | Geolocation & Station Cache      | Bidirectional persona mapping, current-location index-0 pinning without duplicates, malformed JSON & Storage exception recovery.                                                                               |
| `client/src/tests/utils/airQuality.test.ts`                | Client Offline Telemetry         | Fallback station hydration and AQI band classification helpers.                                                                                                                                                |
| `client/src/tests/utils/dashboardAqi.test.ts`              | Dashboard AQI Helpers            | Trend polarity, EPA badge formatting, and station telemetry normalization.                                                                                                                                     |
| `client/src/tests/utils/formatters.test.ts`                | Formatting & Labels              | Relative timestamp formatting, AQI category label/icon mappings, pollutant precision, edge cases (`NaN`, `0`, `>500`).                                                                                         |
| `client/src/tests/accessibility/axe.test.ts`               | WCAG 2.2 AA `axe-core` Audit     | Zero-violation audits across `AQIDashboard`, `HealthAssistantPanel`, `FamilyManager`, `CommunityHub`, `WinterSmogActionHub`, `RoutineOptimizer`, `VoiceInterface`, and `ForecastChart`.                        |
| `client/src/tests/accessibility/wcagStructure.test.tsx`    | Contrast & Landmark Verification | Mathematical sRGB luminance contrast `>= 4.5:1` across light/dark tokens, skip-link & 4 semantic landmarks (`banner`, `navigation`, `main`, `contentinfo`), SVG `<title>`/`<desc>`, keyboard arrow navigation. |

---

## 3. Core Coverage Benchmarks (V8 Provider)

Measured via `npx vitest run --coverage`:

| Scope / Module                                       | Statements | Branches | Functions |   Lines |
| ---------------------------------------------------- | ---------: | -------: | --------: | ------: |
| `client/src/utils/formatters.ts`                     |    100.00% |   96.61% |   100.00% | 100.00% |
| `server/src/lib/aqiEngine.ts`                        |     98.85% |   98.00% |   100.00% |  98.70% |
| `client/src/components/Routine/RoutineOptimizer.tsx` |     96.96% |   86.20% |   100.00% |  96.96% |
| `server/src/middleware/security.ts`                  |     96.89% |   83.33% |   100.00% |  96.74% |
| `server/src/services/fallback/`                      |       90%+ |     75%+ |   100.00% |    91%+ |
| `server/src/services/geminiService.ts`               |       88%+ |     70%+ |      92%+ |    88%+ |
| `server/src/services/aqiService.ts`                  |       86%+ |     72%+ |      89%+ |    91%+ |

---

## 4. How to Run Tests & Quality Gates

```bash
# 1. Run full 29-suite, 197-test suite once (CI default)
npm test

# 2. Run in interactive watch mode during development
npm run test:watch

# 3. Run with V8 coverage report
npx vitest run --coverage

# 4. Run targeted security, conventions, or accessibility suites
npx vitest run server/tests/conventions.test.ts
npx vitest run server/tests/security.test.ts
npx vitest run client/src/tests/accessibility/

# 5. Run static analysis, formatting & production build gates
npm run format:check
npx tsc --noEmit
npm run lint           # ESLint (--max-warnings=0) + TypeScript strict check
npm run build          # Vite production build + Workbox PWA generation
```

---

## 5. Mocking Architecture

- **Setup & Browser Polyfills (`client/src/tests/setup.ts`)**: Registers `@testing-library/jest-dom/vitest` matchers and a deterministic `window.matchMedia` polyfill for `jsdom`.
- **API Mocking (`msw`)**: Frontend hook and component tests intercept `/api/aqi/*`, `/api/air-quality/*`, and `/api/ai/*` via MSW request handlers for deterministic simulation of `200 OK`, `429 Rate Limited`, `503 Service Unavailable`, and offline network failures.
- **Deterministic Clocks & Fetch Injection**: `AQIService` and `GeminiService` accept injectable `fetchFn`, `now`, `sleep`, and `logger` dependencies for zero-delay testing of 10-minute LRU expirations, exponential backoff intervals, and rate-limit cooldown windows.
