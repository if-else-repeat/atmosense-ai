# AtmoSense AI — Urban Air Quality Intelligence & Respiratory Protection Platform

> **Breathe with foresight.** Hyperlocal multi-source air quality telemetry, atmospheric inversion physics, family respiratory protection, and evidence-based pulmonary guidance—engineered for everyday urban resilience.

[![CI Pipeline](https://img.shields.io/badge/CI-Passing-16a34a?style=flat-square&logo=githubactions&logoColor=white)](./TESTING.md)
[![Test Suite](https://img.shields.io/badge/Tests-146%20Passing-16a34a?style=flat-square&logo=vitest&logoColor=white)](./TESTING.md)
[![Code Coverage](https://img.shields.io/badge/Coverage-89.0%25%20Stmts%20%7C%2091.6%25%20Lines-0e7490?style=flat-square)](./TESTING.md)
[![Initial Bundle](https://img.shields.io/badge/Initial%20Bundle-171.4%20KB%20gzip-0e7490?style=flat-square)](./EFFICIENCY.md)
[![Accessibility](https://img.shields.io/badge/WCAG%202.2-AA%20Compliant-2563eb?style=flat-square)](./ACCESSIBILITY.md)
[![Security](https://img.shields.io/badge/Security-OWASP%20%2B%20STRIDE%20Hardened-0f172a?style=flat-square)](./SECURITY.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-0284c7?style=flat-square)](#license)

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [The AtmoSense AI Solution](#the-atmosense-ai-solution)
3. [Visual Walkthrough & Screenshots](#visual-walkthrough--screenshots)
4. [24 Core & Differentiating Features](#24-core--differentiating-features)
5. [System Architecture](#system-architecture)
6. [Technology Stack](#technology-stack)
7. [Getting Started](#getting-started)
8. [API Reference](#api-reference)
9. [Testing & Quality Verification](#testing--quality-verification)
10. [Deployment Guide](#deployment-guide)
11. [Documentation Suite](#documentation-suite)
12. [Scientific & Public Health References](#scientific--public-health-references)
13. [License](#license)

---

## Problem Statement

Urban air pollution is one of the largest preventable environmental health risks in the modern world. According to the **World Health Organization (WHO)**, 99% of the global population breathes air that exceeds the 2021 WHO Global Air Quality Guidelines, contributing to an estimated **6.7 million premature deaths annually** from ambient and household fine particulate matter ($\text{PM}_{2.5}$), nitrogen dioxide ($\text{NO}_2$), and ground-level ozone ($\text{O}_3$).

> _"Build an intelligent, resilient urban air quality assistant that transforms raw multi-pollutant sensor data into personalized, scientifically grounded, accessible respiratory protection—empowering families, vulnerable individuals, and communities to act before hazardous exposure occurs."_

Despite the proliferation of weather apps displaying a single generic AQI number, urban residents still confront **six structural failures** in existing air quality tools:

1. **Single-Source Blindness & Sensor Drift**: Most consumer apps rely on a single upstream feed. When a neighborhood reference monitor goes offline, drifts by >50%, or suffers API deprecation (such as OpenAQ v2's retirement), users either see stale data or an error screen.
2. **No Atmospheric Inversion Awareness**: A static AQI reading at 07:00 fails to explain _why_ urban smog spikes during calm, cool mornings (nocturnal radiation inversion trapping traffic emissions beneath a thermal lid) or _when_ solar convection breaks the inversion layer to open a safer afternoon outdoor window (typically 11:00–16:00).
3. **One-Size-Fits-All Advisories**: An AQI of 115 ("Unhealthy for Sensitive Groups") carries fundamentally different clinical implications for a 9-year-old child with allergic asthma, a 71-year-old grandparent with ischemic heart disease, and a healthy adult runner—yet standard apps surface the same generic sentence to everyone.
4. **Disconnected Symptom & Exposure History**: Families managing asthma, COPD, or seasonal allergies lack a private, structured way to correlate daily coughing, wheezing, eye irritation, and dyspnea logs against timestamped ambient AQI spikes—and cannot easily export clinician-ready summaries for pulmonologist appointments.
5. **Environmental Justice Blind Spots**: Neighborhood AQI disparities inside the same metropolitan region frequently exceed 3×–4× between green residential zones and industrial/highway corridors. Without crowdsourced hyperlocal visibility and neighborhood disparity mapping, communities cannot coordinate mutual aid or low-emission pledges.
6. **Fragility Under Real-World Constraints**: Client-side LLM keys leak secrets, uncached API calls exhaust quotas, bloated bundles fail on 3G mobile networks, and color-only AQI badges exclude roughly 1 in 12 men with color vision deficiency.

---

## The AtmoSense AI Solution

**AtmoSense AI** is a full-stack, security-hardened, offline-capable Progressive Web Application (PWA) built with **React 19, TypeScript, Tailwind CSS v4, Express 5, Leaflet/OpenStreetMap, AES-256-GCM browser-local storage, and server-side Google Gemini AI** with deterministic scientific fallback heuristics.

Rather than merely echoing an AQI integer, AtmoSense AI establishes an end-to-end **Atmospheric Intelligence Pipeline**:

- **Live Multi-Source Telemetry Fusion (`WAQI` + `OpenAQ` + `OpenWeather` + `Open-Meteo`)**: Automatically detects the user's current coordinates (browser GPS primary with seamless server-side IP geolocation fallback), reverse-geocodes the exact neighborhood, queries upstream air-quality providers in parallel with reliability weighting, dampens >50% sensor outliers, silently circuit-breaks permanently retired endpoints (HTTP 410 Gone), and caches normalized responses in a SHA-256 100-entry 10-minute LRU cache.
- **Exact US EPA & WHO 2021 Calculation Engine**: Implements official US EPA linear breakpoint interpolation across $\text{PM}_{2.5}$, $\text{PM}_{10}$, $\text{NO}_2$, $\text{CO}$, and $\text{O}_3$, computes WHO 2021 24-hour guideline exceedance ratios ($\text{PM}_{2.5} > 15\,\mu\text{g/m}^3$), detects thermal inversion risk from diurnal meteorology, and identifies the lowest-exposure outdoor window.
- **Server-Side Pulmonary AI & Deterministic Fallback**: Exposes five Zod-validated, prompt-injection-sanitized, SHA-256-cached, rate-limited (`30 req/min/user`) Gemini endpoints—personalized daily routines, conversational pulmonary assistant, emergency bulletins, multimodal smog/AQI-meter/mask-fit image analysis, and symptom-AQI correlation insights. If the LLM is unreachable or unconfigured, a deterministic atmospheric physics fallback engine guarantees uninterrupted, WHO/EPA-cited guidance.
- **Privacy-First Family Health Protection**: Tracks multi-member household profiles with sensitivity badges, logs five clinical respiratory symptoms linked automatically to current ambient AQI, requires explicit user opt-in before transmitting de-identified symptom data for AI correlation, encrypts local health data with AES-256-GCM, exports printable PDF visit reports for physicians, and provides one-click GDPR complete data erasure.
- **Community Resilience & Environmental Justice Hub**: Enables crowdsourced AQI reporting, photo sharing of local visibility/smog, neighborhood disparity comparison heatmaps, geotargeted emergency broadcasts, streak/badge gamification, opt-in anonymous leaderboards (accessible in tabular form), and collective $\text{CO}_2$ avoidance pledges.

---

## Visual Walkthrough & Screenshots

All screenshots below were captured directly from the live running AtmoSense AI application in headless Chromium at `1440×900` with zero console errors or warnings.

### 1. Real-Time Air Quality Monitor (Light Mode)

Auto-detects the user's current location (`My Location`), fuses live `WAQI+OpenWeather` telemetry, displays accessible numeric AQI with icon + text status badges, renders five memoized pollutant cards with trend sparklines and WHO/EPA threshold bars, and plots a lazy-loaded native SVG 24-hour forecast highlighting the 11:00–16:00 solar convection mixing window.

![AtmoSense AI Real-Time Dashboard — Light Mode](./docs/screenshots/dashboard-light.png)

### 2. Full Dark Mode Support

Low-glare dark palette tuned to exceed WCAG 2.2 AA contrast ratios (`> 4.5:1`) for evening and overnight respiratory monitoring without eye strain.

![AtmoSense AI Real-Time Dashboard — Dark Mode](./docs/screenshots/dashboard-dark.png)

### 3. Interactive OpenStreetMap & Leaflet Station Network

Zero-API-key OpenStreetMap tiles with live AQI dispersion radius overlays, interactive current-location pinpointing, station jump list, and one-click transition into the AI Health Brief for any selected zone.

![AtmoSense AI Interactive OpenStreetMap View](./docs/screenshots/map-view.png)

### 4. Family Health Protection, Symptom Tracker & AI Correlation Insights

Manage vulnerable household members, log coughing/wheezing/eye irritation/shortness of breath/headache linked to live AQI, review correlation strength with explicit AI consent controls, export doctor-ready PDF summaries, or erase all health data under GDPR.

![AtmoSense AI Family Health Protection Tab](./docs/screenshots/family-health.png)

---

## 24 Core & Differentiating Features

| #   | Category                  | Feature                                           | Engineering Implementation                                                                                                                                                     |
| --- | ------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Location Intelligence** | Automatic GPS + IP Geolocation                    | Browser `navigator.geolocation` primary with automatic server-side IP fallback (`ipwho.is` → `geojs.io`) and reverse geocoding (`BigDataCloud` → `Nominatim`).                 |
| 2   | **Telemetry Engine**      | Multi-Source Weighted Fusion                      | Parallel ingestion of WAQI (`0.95`), OpenAQ (`0.85`), and OpenWeather (`0.70`) with full per-source provenance audit trails.                                                   |
| 3   | **Data Integrity**        | >50% Outlier Detection & Dampening                | Computes consensus baseline across active providers and down-weights divergent sensors (`×0.2` weight factor) so broken monitors cannot skew advisories.                       |
| 4   | **Resilience**            | Silent HTTP 410 Circuit-Breaker                   | Detects permanently retired endpoints (`410 Gone`, e.g., OpenAQ v2), circuit-breaks them in memory, and eliminates recurring latency and log noise.                            |
| 5   | **Scientific Accuracy**   | Official US EPA Breakpoint Calculator             | Exact piecewise linear interpolation for $\text{PM}_{2.5}$, $\text{PM}_{10}$, $\text{NO}_2$, $\text{CO}$, and $\text{O}_3$ plus WHO 2021 24h guideline exceedance multipliers. |
| 6   | **Atmospheric Physics**   | Thermal Inversion Risk Indicator                  | Evaluates diurnal inversion trapping (06:00–10:00 morning lid, 17:00–20:00 evening settling) vs. 11:00–16:00 solar convection mixing in plain language.                        |
| 7   | **Visualization**         | Zero-Dependency Native SVG Forecast               | Lazy-loaded 24-hour trajectory chart with interactive hover/keyboard scrubbing, convection window band, and `.sr-only` accessible summary table.                               |
| 8   | **Mobile UX**             | Pull-to-Refresh & 10-Min Auto-Refresh             | Touch pull-to-refresh gesture handler on mobile viewports plus background 10-minute polling aligned with server LRU cache TTL.                                                 |
| 9   | **Offline PWA**           | Workbox Service Worker & Offline Banner           | Precaches app shell, caches `/api/air-quality` with `NetworkFirst`, displays live online/offline banner, and supports standalone home-screen installation.                     |
| 10  | **Server-Side AI**        | Personalized Daily Routine Optimizer              | Generates time-blocked safe/caution/danger schedules tailored to `children`, `elderly`, `asthmatics`, or `general` personas with mask/HEPA recommendations.                    |
| 11  | **Server-Side AI**        | Conversational Pulmonary Assistant                | Context-aware multi-turn chat injecting live zone pollutants, persona profile, and WHO/EPA citations with strict prompt-injection sanitization.                                |
| 12  | **Server-Side AI**        | Emergency Severity Advisory Generator             | Produces structured `moderate`, `severe`, or `critical` public health bulletins in multiple languages for acute smog or wildfire smoke episodes.                               |
| 13  | **Multimodal AI**         | Vision Analysis (`smog` / `aqi-display` / `mask`) | Analyzes base64 photographs (up to 6 MB route limit) to estimate haze severity, read physical AQI monitor screens, or check N95/KN95 seal fit.                                 |
| 14  | **Clinical Analytics**    | AI Symptom–AQI Correlation Engine                 | Correlates logged household symptom timestamps and severities against ambient AQI history and classifies correlation strength (`weak`, `moderate`, `strong`).                  |
| 15  | **Zero-Downtime AI**      | Deterministic Heuristic Fallback                  | Automatically engages scientifically calibrated atmospheric heuristics whenever Gemini is unconfigured, throttled, or returns invalid JSON.                                    |
| 16  | **Family Health**         | Multi-Member Household Profiles                   | Color-coded avatars, age/relationship tags, clinical conditions (asthma, COPD, heart disease, allergies), activity schedules, and high-sensitivity badges.                     |
| 17  | **Family Health**         | 5-Symptom Timestamped Logger                      | Captures coughing, wheezing, eye irritation, shortness of breath, and headache (`none`/`mild`/`moderate`/`severe`) automatically linked to live AQI.                           |
| 18  | **Family Health**         | Clinician PDF Export & GDPR Erasure               | Generates printable doctor-visit health summaries, enforces explicit AI consent checkbox, encrypts local data, and provides one-click GDPR full wipe.                          |
| 19  | **Community**             | Crowdsourced AQI & Smog Photo Feed                | Allows residents to submit hyperlocal AQI readings and local visibility photos to fill gaps between sparse government monitoring stations.                                     |
| 20  | **Environmental Justice** | Neighborhood Disparity Heatmap                    | Compares average AQI across urban districts and surfaces actionable inequity alerts (e.g., _"Zone A averages 45 AQI vs. Zone B at 180 AQI"_).                                  |
| 21  | **Community Safety**      | Geotargeted Emergency Broadcasts                  | Publishes zone-scoped severe pollution alerts with shelter-in-place and vulnerable-neighbor check-in protocols.                                                                |
| 22  | **Behavioral Design**     | Gamification, Streaks & Eco-Pledges               | Tracks daily check-in streaks, 6 unlockable achievement badges, opt-in anonymous neighborhood leaderboards (table-accessible), and collective $\text{CO}_2$ pledges.           |
| 23  | **Voice Accessibility**   | Hands-Free Voice Interface                        | Supports Web Speech API voice queries and spoken AQI readouts for visually impaired users and hands-free morning checks.                                                       |
| 24  | **Cloud Persistence**     | Firebase Auth + Firestore Saved Zones             | Optional Google Sign-In syncing saved monitoring zones, alert thresholds, sensitivity preferences, and archived advisories protected by strict Firestore security rules.       |

---

## System Architecture

```text
+---------------------------------------------------------------------------------------------------+
|                               CLIENT LAYER (React 19 + Vite 8 PWA)                                |
|  Initial Entry Bundle: 153.3 KB JS + 16.8 KB CSS gzipped  |  Workbox Service Worker (Offline)     |
|                                                                                                   |
|  +-----------------------+  +-----------------------+  +-------------------+  +----------------+  |
|  | AQIDashboard (Eager)  |  | Lazy Route Chunks     |  | AuthContext       |  | Accessibility  |  |
|  | - AQI Hero (aria-live)|  | - AirQualityMap       |  | - Lazy Firebase   |  | - WCAG 2.2 AA  |  |
|  | - 5 PollutantCards    |  | - FamilyManager       |  |   Auth & Sync     |  | - Keyboard Nav |  |
|  | - Lazy ForecastChart  |  | - CommunityHub        |  | - AES-256-GCM     |  | - Icon + Text  |  |
|  | - InversionIndicator  |  | - HealthAssistant     |  |   Health Privacy  |  |   Status Badges|  |
|  | - HealthRecommendation|  | - SavedZonesPanel     |  | - GDPR Erasure    |  | - ReducedMotion|  |
|  +-----------+-----------+  +-----------+-----------+  +---------+---------+  +----------------+  |
+--------------|--------------------------|------------------------|--------------------------------+
               | HTTPS / JSON             | HTTPS / JSON           | Firebase SDK (Client-Side Auth)
               v                          v                        v
+------------------------------------------------------------------+  +-----------------------------+
|            EXPRESS 5 API SERVER (TypeScript / Node 20)           |  |     FIREBASE PLATFORM       |
|  Layered Security Stack (server/middleware/security.ts):         |  | - Google Sign-In OAuth      |
|   [1] Helmet Strict CSP  [2] Dynamic CORS  [3] Morgan Safe Logs  |  | - Cloud Firestore Database  |
|   [4] Two-Tier Rate Limiter (30/m AI | 100/m Data, skip /health) |  | - Owner-Scoped Rules        |
|   [5] Timing-Safe X-API-Key  [6] Deep Sanitizer + Zod Schemas    |  |   (firestore.rules)         |
|   [7] CWE-209 Safe Error Handler (zero stack trace exposure)     |  +-----------------------------+
|                                                                  |
|  +-------------------------------+  +-------------------------+  |
|  | /api/aqi/* & /api/air-quality |  | /api/ai/*               |  |
|  |  - AQIService (Fusion + LRU)  |  |  - GeminiService        |  |
|  |  - EPA aqiEngine (Breakpoints)|  |  - Prompt Sanitizer     |  |
|  |  - Geolocation & Reverse Geo  |  |  - Zod Output Validator |  |
|  |  - HTTP 410 Circuit-Breaker   |  |  - SHA-256 Cache        |  |
|  |  - >50% Outlier Dampening     |  |  - HeuristicFallback    |  |
|  +---------------+---------------+  +------------+------------+  |
+------------------|-------------------------------|---------------+
                   |                               | Server-Side Secret Only (NEVER in client)
                   v                               v
+--------------------------------------+  +------------------------+
| UPSTREAM TELEMETRY & GEO PROVIDERS   |  | GOOGLE GEMINI AI       |
| - WAQI API (Primary, rel. 0.95)      |  | - @google/genai SDK    |
| - OpenWeather Air Poll. (rel. 0.70)  |  | - Temp 0.3, 2048 tok   |
| - OpenAQ (Circuit-broken on 410)     |  | - Structured JSON Out  |
| - Open-Meteo AQ & Weather (24h)      |  | - Multimodal Vision    |
| - BigDataCloud / Nominatim / ipwho   |  +------------------------+
+--------------------------------------+
```

For deep component diagrams, data lifecycle sequences, and Architecture Decision Records (ADRs 001–008), see **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

---

## Technology Stack

| Layer                   | Technology                                      | Version               | Purpose & Rationale                                                                                                      |
| ----------------------- | ----------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Frontend Framework**  | React + TypeScript                              | React 19 / TS 7       | Strict static typing, `React.memo`, `React.lazy`, and concurrent `<Suspense>` boundaries.                                |
| **Build & Bundling**    | Vite + Rolldown + vite-plugin-pwa               | Vite 8.3 / PWA 2.0    | Sub-2s production builds, automatic code-splitting (`153.3 KB` gzipped initial JS), and Workbox SW generation.           |
| **Styling System**      | Tailwind CSS                                    | v4.3                  | Utility-first atomic CSS (`16.8 KB` gzipped total), dark mode class strategy, zero runtime CSS-in-JS overhead.           |
| **Mapping**             | Leaflet + OpenStreetMap                         | Leaflet 1.9.4         | Zero-API-key interactive urban station map loaded strictly on demand (`46.7 KB` gzipped lazy chunk).                     |
| **Charting**            | Native SVG                                      | Custom                | Zero third-party charting dependencies (`3.0 KB` gzipped lazy chunk) with full keyboard scrubbing and `.sr-only` tables. |
| **Backend Server**      | Express + Node.js                               | Express 5 / Node 20   | Unified full-stack runtime serving REST APIs and compiled SPA assets with Express trust proxy and Helmet CSP.            |
| **AI Engine**           | Google GenAI SDK (`@google/genai`)              | v3.6                  | Server-side structured JSON generation, multimodal image inspection, and deterministic heuristic fallback.               |
| **Validation**          | Zod                                             | v4.6                  | Runtime schema validation for all POST request bodies and all structured LLM responses.                                  |
| **Security Middleware** | Helmet + CORS + Morgan + `node:crypto`          | Helmet 8.3            | Strict CSP, dynamic origin allowlist, PII-redacted request logs, SHA-256 timing-safe API key verification.               |
| **Auth & Database**     | Firebase Auth + Cloud Firestore                 | Firebase 13.4         | Client-side Google OAuth, real-time synced saved zones and advisories, strict owner-only Firestore rules.                |
| **Testing & A11y**      | Vitest + React Testing Library + MSW + axe-core | Vitest 5.1 / axe 4.14 | 142 automated unit, integration, API-mocked, and WCAG accessibility tests with V8 coverage reporting.                    |
| **Containers & CI**     | Docker + Docker Compose + ESLint 10             | Node 20 Alpine        | Multi-stage non-root container (`HEALTHCHECK` on `/api/health`) and strict zero-warning linting.                         |

---

## Getting Started

### Prerequisites

- **Node.js** `>= 20.0.0` (LTS recommended) and **npm** `>= 10` (or **Bun**)
- Optional server-side API keys for live multi-source fusion and Gemini AI (the platform gracefully degrades using Open-Meteo telemetry and deterministic pulmonary heuristics even without paid API keys)

### 1. Clone & Install

```bash
git clone https://github.com/<your-org>/atmosense-ai.git
cd atmosense-ai
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and populate your server-side secrets (never prefix secret keys with `VITE_` and never commit `.env`):

```bash
cp .env.example .env
```

```dotenv
# Server runtime
NODE_ENV="development"
PORT="3000"

# Google Gemini AI (SERVER-SIDE ONLY)
GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL="gemini-4-hydrogen"

# CORS & Public Origin
APP_URL="http://localhost:3000"

# Multi-Source Live Air Quality APIs (SERVER-SIDE ONLY)
OPEN_METEO_AQ_URL="https://air-quality-api.open-meteo.com/v1/air-quality"
WAQI_API_TOKEN="your-waqi-token"
OPENAQ_API_KEY=""
OPENWEATHER_API_KEY="your-openweather-api-key"

# Optional programmatic API key (constant-time verified via X-API-Key header)
# ATMOSENSE_API_KEY="your-strong-random-key"
```

### 3. Run Locally in Development Mode

```bash
npm run dev
```

Express starts on **`http://localhost:3000`**, mounting Vite middleware for the client SPA alongside all `/api/*` routes.

### 4. Build & Run in Production Mode

```bash
npm run build
NODE_ENV=production npm run dev
```

Verify server health:

```bash
curl http://localhost:3000/api/health
```

---

## API Reference

AtmoSense AI provides a fully documented REST API under `/api/*`, backed by an **OpenAPI 3.0.3 specification** in **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)**.

| Method | Endpoint                           | Rate Limit  | Description                                                                                     |
| ------ | ---------------------------------- | ----------- | ----------------------------------------------------------------------------------------------- |
| `GET`  | `/api/health`                      | Exempt      | Server liveness probe and sanitized AI configuration status                                     |
| `GET`  | `/api/air-quality`                 | 100 req/min | Live telemetry across 8 curated global urban monitoring stations                                |
| `GET`  | `/api/air-quality/by-coords`       | 100 req/min | Live fused AQI, 24h forecast, weather, and reverse geocoding for any `lat`/`lng`                |
| `GET`  | `/api/air-quality/detect-location` | 100 req/min | Server-side IP geolocation fallback returning hyperlocal station telemetry                      |
| `GET`  | `/api/air-quality/:stationId`      | 100 req/min | Single station telemetry lookup with optional `?refresh=1` cache bypass                         |
| `GET`  | `/api/aqi/current`                 | 100 req/min | Multi-source fused reading (`WAQI` + `OpenAQ` + `OpenWeather`) with provenance & persona advice |
| `GET`  | `/api/aqi/forecast`                | 100 req/min | Multi-day/hourly AQI forecast with automatic WAQI → OpenWeather fallback                        |
| `GET`  | `/api/aqi/sources`                 | 100 req/min | Provider health, reliability weights, rate-limit budgets, and LRU cache hit stats               |
| `POST` | `/api/ai/routine`                  | 30 req/min  | Personalized daily activity schedule (`RoutinePlan`) with safe/danger windows                   |
| `POST` | `/api/ai/chat`                     | 30 req/min  | Multi-turn conversational pulmonary health assistant with WHO/EPA citations                     |
| `POST` | `/api/ai/emergency-advisory`       | 30 req/min  | Structured emergency bulletin for `moderate`, `severe`, or `critical` smog episodes             |
| `POST` | `/api/ai/analyze-image`            | 30 req/min  | Multimodal vision analysis (`smog-severity`, `aqi-display`, `mask-check`; up to 6 MB)           |
| `POST` | `/api/ai/health-insights`          | 30 req/min  | Correlates household symptom logs with historical AQI readings                                  |
| `POST` | `/api/ai/advisory`                 | 30 req/min  | Quick clinical health brief for the currently inspected monitoring station                      |
| `GET`  | `/api/ai/status`                   | 30 req/min  | Sanitized Gemini service status, cache statistics, and fallback state                           |

---

## Testing & Quality Verification

AtmoSense AI enforces automated unit, integration, security, and accessibility testing using **Vitest 5**, **React Testing Library**, **MSW 3**, and **axe-core 4**:

```bash
# Run the complete 142-test suite
npm run test:ci

# Run with V8 code coverage report
npx vitest run --coverage

# TypeScript strict type-checking (zero errors)
npm run lint

# ESLint code quality verification (zero warnings)
npm run lint:eslint

# Verify formatting
npm run format:check
```

### Verified Test Metrics

- **15 test suites / 142 tests passing** (0 skipped, 0 `.only`)
- **Code Coverage (V8)**: **89.02% Statements** · **90.21% Functions** · **91.57% Lines**
- **Core Modules**: `aqiEngine.ts` (`98.85%` stmts / `100%` funcs), `security.ts` (`96.89%` stmts / `100%` funcs), `formatters.ts` (`100%` stmts / `100%` lines)
- **Accessibility**: Automated `axe-core` WCAG 2.2 AA audit passes across core dashboard, routine, voice, and family workflows

See **[TESTING.md](./TESTING.md)** for full test suite structure and mocking architecture.

---

## Deployment Guide

AtmoSense AI ships with a production multi-stage **Docker** build (`node:20-alpine`, non-root `atmosense` user, built-in `/api/health` `HEALTHCHECK`) and **`docker-compose.yml`**:

```bash
# Build and launch production container
docker compose up --build -d

# Verify container health
docker compose ps
curl http://localhost:3000/api/health
```

For Google Cloud Run, Firebase Firestore Rules deployment (`firestore.rules`), TLS reverse proxy headers, and secret rotation procedures, see **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

---

## Documentation Suite

| Document                                           | Description                                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **[PROBLEM_ALIGNMENT.md](./PROBLEM_ALIGNMENT.md)** | Requirements Traceability Matrix (RTM) mapping 100% of problem requirements to code & tests      |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)**           | System topology, multi-source fusion math, data flows, and Architecture Decision Records (ADRs)  |
| **[SECURITY.md](./SECURITY.md)**                   | STRIDE threat model, OWASP Top 10 mapping, CWE-209 compliance, and privacy controls              |
| **[EFFICIENCY.md](./EFFICIENCY.md)**               | Production bundle benchmarks, caching architecture, complexity analysis, and Lighthouse strategy |
| **[TESTING.md](./TESTING.md)**                     | Testing pyramid, 142-test catalog, V8 coverage breakdown, and CI execution guide                 |
| **[ACCESSIBILITY.md](./ACCESSIBILITY.md)**         | WCAG 2.2 Level AA checklist, axe-core verification, keyboard maps, and contrast audit            |
| **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** | Complete OpenAPI 3.0.3 YAML specification with request/response schemas and examples             |
| **[DEPLOYMENT.md](./DEPLOYMENT.md)**               | Docker, Cloud Run, environment variable reference, and Firebase Auth/Firestore setup             |
| **[CONTRIBUTING.md](./CONTRIBUTING.md)**           | Open-source contribution guidelines, style standards, and pull request checklist                 |
| **[CHANGELOG.md](./CHANGELOG.md)**                 | Semantic version history and engineering release notes                                           |

---

## Scientific & Public Health References

AtmoSense AI's calculations, health advisories, inversion explanations, and pollutant threshold indicators are grounded in peer-reviewed atmospheric science and official public health standards:

1. **World Health Organization (WHO)** — _WHO Global Air Quality Guidelines: Particulate Matter ($\text{PM}*{2.5}$ and $\text{PM}*{10}$), Ozone, Nitrogen Dioxide, Sulfur Dioxide and Carbon Monoxide_ (Geneva, September 2021). 24-hour guideline thresholds: $\text{PM}_{2.5} \le 15\,\mu\text{g/m}^3$, $\text{PM}_{10} \le 45\,\mu\text{g/m}^3$, $\text{NO}_2 \le 25\,\mu\text{g/m}^3$, $\text{CO} \le 4\,\text{mg/m}^3$.
2. **United States Environmental Protection Agency (US EPA)** — _Technical Assistance Document for the Reporting of Daily Air Quality — the Air Quality Index (AQI)_, EPA-454/B-24-002 (May 2024 update, including tightened 2024 $\text{PM}_{2.5}$ NAAQS breakpoints). Used for exact piecewise linear AQI sub-index computation and dominant pollutant attribution.
3. **Central Pollution Control Board (CPCB), Ministry of Environment, Forest and Climate Change (India)** — _National Air Quality Index (NAQI) Technical Report_ (2014) & _Graded Response Action Plan (GRAP)_ protocols for severe urban particulate episodes and winter boundary-layer inversions.
4. **Seinfeld, J. H., & Pandis, S. N.** — _Atmospheric Chemistry and Physics: From Air Pollution to Climate Change_, 3rd Edition (Wiley, 2016). Planetary boundary layer (PBL) dynamics, nocturnal radiation inversions (06:00–10:00), daytime convective mixing height expansion (11:00–16:00), and evening rush-hour pollutant accumulation (17:00–20:00).
5. **American Thoracic Society (ATS) & European Respiratory Society (ERS)** — Clinical consensus guidance on particulate exposure mitigation (HEPA H13 filtration CADR sizing, NIOSH N95 / FFP2 respirator fit, rescue inhaler readiness for pediatric asthma and elderly COPD/cardiovascular populations).

---

## License

This project is released under the **MIT License**.

```text
MIT License

Copyright (c) 2026 AtmoSense AI Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
