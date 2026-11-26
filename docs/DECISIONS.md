# Architecture Decision Records (ADRs)

This document captures the foundational architectural decisions behind **AtmoSense AI**, their trade-offs, and their concrete implementation paths.

---

## ADR-001: Zero-Key Open-Meteo + Multi-Source Weighted Fusion with >50% Outlier Dampening

- **Status**: Accepted
- **Context**: Urban air quality sensors frequently drift, fail silently, or retire endpoints (such as OpenAQ v2 returning HTTP `410 Gone`), while commercial AQI APIs impose strict rate limits or key requirements that degrade out-of-the-box reliability.
- **Decision**:
  - Combine live **Open-Meteo Air Quality & Weather** (zero-API-key baseline for 24h trajectories and meteorological inversion data) with parallel server-side fusion of **WAQI** (reliability `0.95`), **OpenAQ** (`0.85`), and **OpenWeather** (`0.70`) in `server/src/services/aqiService.ts`.
  - Compute a consensus baseline across active providers and down-weight any reading deviating by `> 50%` using an `outlierWeightFactor` of `0.2`, returning a full `SourceProvenance[]` audit trail.
  - Circuit-break any upstream returning HTTP `410 Gone` in memory (`retiredSources`) so subsequent requests incur `0 ms` overhead and zero log noise.
  - Quantize coordinates to `3` decimal places (`~111 m` grid) and cache responses in an $O(1)$ 100-entry, 10-minute SHA-256 LRU cache (`server/src/services/aqi/cache.ts`).
- **Consequences**: Resilient, auditable AQI telemetry with graceful degradation even when zero paid sensor keys are configured.

---

## ADR-002: Strictly Server-Side Gemini Proxy with Zod + Output Safety Guardrails & Deterministic Heuristic Fallback

- **Status**: Accepted
- **Context**: Calling LLMs from browser code exposes `GEMINI_API_KEY`, prevents centralized rate limiting, and leaves families vulnerable to prompt injection, hallucinated AQI numbers, or unsafe medical advice during hazardous smog events.
- **Decision**:
  - Consolidate all Gemini interactions into a single server-side service (`server/src/services/geminiService.ts`) behind Express `/api/ai/*` endpoints protected by a 30 req/min rate limiter and strict Zod request schemas.
  - Sanitize user inputs and reject prompt-injection overrides via `server/src/services/gemini/security.ts` and `server/src/services/gemini/outputGuard.ts` (`scanPromptInjection`).
  - Validate every structured JSON response against Zod schemas (`server/src/services/gemini/schemas.ts`) AND semantic safety guardrails (`validateGeminiOutputSafety` flagging hallucinated current AQI divergence `> 40` or unsafe inhaler/medication cessation advice).
  - Automatically invoke scientifically calibrated atmospheric heuristics (`server/src/services/fallback/`) whenever Gemini is unconfigured, throttled, times out, or fails schema/safety validation.
- **Consequences**: Zero client-side secret leakage, 100% endpoint availability during severe winter smog episodes, and verifiable clinical safety boundaries.

---

## ADR-003: Client-Side AES-256-GCM Family Health Vault with Explicit De-Identified AI Consent

- **Status**: Accepted
- **Context**: Household respiratory profiles and symptom logs (asthma, COPD, pediatric wheezing, cardiovascular risk) constitute sensitive personal health information under GDPR Article 9. Requiring mandatory cloud accounts creates friction during urgent smog episodes and expands breach blast radius.
- **Decision**:
  - Store household profiles and 5-symptom AQI-linked logs locally in the browser encrypted with Web Crypto **AES-256-GCM** (`client/src/utils/healthCrypto.ts`).
  - Gate AI symptom–AQI correlation (`POST /api/ai/health-insights`) behind an explicit opt-in consent control and send only de-identified symptom/AQI arrays.
  - Provide clinician-ready printable summaries and a one-click GDPR full erasure action (`FamilyManager.tsx`).
  - For optional authenticated cloud zone sync, enforce strict owner-only, email-verified, append-only advisory rules in `firestore.rules`.
- **Consequences**: Zero-friction onboarding, strong privacy-by-design guarantees, and full user sovereignty over household health records.

---

## ADR-004: Native SVG Telemetry Charts & Zero-Key Leaflet OpenStreetMap Frontend

- **Status**: Accepted
- **Context**: Heavy charting libraries (Recharts/Chart.js/ECharts) and commercial map SDKs inflate mobile initial bundles, require billing-enabled browser keys, and frequently fail WCAG keyboard/screen-reader requirements.
- **Decision**:
  - Implement 24-hour forecast and dispersion charts (`ForecastChart.tsx`, `ForecastSvgPlot.tsx`, `TrendChartSvg.tsx`) as pure, zero-dependency native SVG components with explicit `<title>`, `<desc>`, `role="img"`, keyboard arrow navigation, and parallel `.sr-only` data summaries.
  - Render spatial station telemetry using **Leaflet + OpenStreetMap** inside a `React.lazy` chunk (`AirQualityMap.tsx` + `Map/MapControls.tsx`) loaded strictly on demand when opening the Live Map tab.
- **Consequences**: Initial entry payload remains well beneath the `300 KB` gzipped performance budget, crisp HiDPI rendering in light and dark modes, zero map billing dependencies, and full WCAG 2.2 AA compliance.

---

## ADR-005: Single-Manifest Monorepo & Automated Architecture Convention Gate

- **Status**: Accepted
- **Context**: Nested stub manifests (`client/package.json`, `server/package.json`, duplicate `tsconfig.json`/`vite.config.ts`), multiple lockfiles (`bun.lock` alongside `package-lock.json`), and overgrown UI files cause CI drift, `npm ci` mismatches, and declining maintainability.
- **Decision**:
  - Standardize strictly on a single root `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, and `.env.example`, with a unified server layout (`server/src/{lib,middleware,routes,services,utils}/`) and canonical test trees (`client/src/tests/`, `server/tests/`).
  - Enforce module size caps (`<= 300` lines hard cap, `<= 260` lines target), zero `any`/unsafe patterns, strict client/server import boundaries, and universal route Zod/rate-limit coverage via an automated Vitest suite (`server/tests/conventions.test.ts`).
- **Consequences**: Deterministic `npm ci` builds across local machines, GitHub Actions, and Docker containers, and continuously verified structural cleanliness.
