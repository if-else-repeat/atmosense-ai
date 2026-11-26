# Code Quality Standards, Modular Architecture & Automated Conventions

## 1. Engineering Quality Charter

**AtmoSense AI** enforces strict, machine-verified code quality across both its React 19 client (`client/src/`) and Express 5 server (`server/src/`). Every production source module adheres to the Single Responsibility Principle (SRP), strict static typing, clean layer boundaries, and zero-warning static analysis.

| Quality Dimension             | Standard Enforced                                                                                                      | Verification Mechanism                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Module Size (SRP)**         | Target `<= 260 lines` (`<= 9.5 KB`), hard cap `<= 300 lines`                                                           | Automated `server/tests/conventions.test.ts`                     |
| **Static Type Safety**        | `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, zero `any`                                | `npx tsc --noEmit` & ESLint `@typescript-eslint/no-explicit-any` |
| **Static Lint Rules**         | Zero warnings (`--max-warnings=0`), `eqeqeq`, `no-var`, `prefer-const`, `no-eval`, `no-console`                        | `npm run lint` (`eslint.config.mjs`)                             |
| **Formatting Consistency**    | Prettier + `.editorconfig` (2-space indent, LF endings, 100-char width, single quotes)                                 | `npm run format:check`                                           |
| **Architecture Boundaries**   | `client/src/` never imports `server/src/`; `server/src/routes/` delegates all domain logic to `server/src/services/`   | `server/tests/conventions.test.ts`                               |
| **Route Security Discipline** | Every `server/src/routes/*.ts` module enforces Zod input validation and sliding-window rate limiting                   | `server/tests/conventions.test.ts`                               |
| **Zero Unsafe Patterns**      | Zero `any`, zero `eslint-disable` bypasses, zero `dangerouslySetInnerHTML`, zero `eval()` / `new Function()`           | `server/tests/conventions.test.ts`                               |
| **Single Source of Truth**    | Single root `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `.env.example` | CI workflow (`.github/workflows/ci.yml`)                         |

---

## 2. Clean Directory & Module Boundaries

```text
atmosense-ai/
├── client/src/
│   ├── components/
│   │   ├── ActionHub/          # Winter Smog Action Hub (SustainableAlternatives, IndoorAirHacks, LifestyleProfileBar)
│   │   ├── Assistant/          # Pulmonary AI Assistant modular views (Chat, Routine, Vision, Emergency)
│   │   ├── Community/          # CommunityHeader, CommunityFeed, EnvironmentalJustice, PledgeSystem, Leaderboard
│   │   ├── Dashboard/          # AQIDashboard, PollutantCard, ForecastChart, ForecastSvgPlot, InversionIndicator
│   │   ├── Family/             # FamilyManager, MemberCard, SymptomTracker, SymptomLogForm, SymptomHistoryList, HealthInsights, InsightCard
│   │   ├── Map/                # MapControls & station marker helpers paired with AirQualityMap.tsx
│   │   ├── Routine/            # RoutineOptimizer
│   │   └── Voice/              # VoiceInterface
│   ├── hooks/                  # useAQI, useStationNetwork, aqiTelemetry, usePWAInstall
│   ├── services/               # Client API clients (apiClient.ts, aiClient.ts)
│   ├── utils/                  # airQuality, dashboardAqi, formatters, healthCrypto, locationStorage, personaGuidance, personaTemplates, smogImpactEngine
│   └── tests/                  # Canonical client Vitest + RTL + axe-core test suites
└── server/
    ├── src/
    │   ├── lib/                # Pure EPA/WHO mathematical engine (aqiEngine.ts)
    │   ├── middleware/         # Layered security stack (security.ts, validate.ts, securityHelpers.ts)
    │   ├── routes/             # Thin Express routers (airQuality.ts, aqi.ts, ai.ts) — Zod + rate limiting on every route
    │   ├── services/
    │   │   ├── aqi/            # Multi-source parsers, fusion, LRU cache, HTTP 410 circuit-breaker
    │   │   ├── fallback/       # Deterministic WHO/EPA/inversion heuristics
    │   │   ├── gemini/         # Prompt sanitization, output safety guardrails, Zod schemas, station brief
    │   │   ├── aqiService.ts   # Unified multi-source AQI orchestrator
    │   │   ├── airQualityService.ts
    │   │   └── geminiService.ts# Single consolidated Gemini AI service entry point
    │   └── utils/              # Station AQI classification & diurnal helpers
    └── tests/                  # Canonical server Vitest suites (unit, integration, security, conventions)
```

---

## 3. Automated Architecture Gate (`server/tests/conventions.test.ts`)

Code quality is treated as an executable invariant rather than an aspirational guideline. Every `npm test` run executes `server/tests/conventions.test.ts`, which statically inspects every TypeScript/TSX production source file under `client/src/` and `server/src/` and asserts:

1. **Line Budget Compliance**: Every production source file is `<= 300` lines (all current modules are kept at `<= 260` lines / `<= 9.5 KB`).
2. **Zero Unsafe Constructs**: No `: any`, `as any`, `dangerouslySetInnerHTML`, `eval(`, `new Function(`, or `eslint-disable` comments exist in production code.
3. **Strict Layer Separation**: No file in `client/src/` imports from `server/`; no file in `server/src/` imports from `client/`.
4. **Universal Route Hardening**: Every router in `server/src/routes/` imports Zod validation and enforces rate limiting.

---

## 4. Continuous Integration & DevSecOps Quality Gates

Every push and pull request runs four automated GitHub workflows:

- **CI Pipeline (`.github/workflows/ci.yml`)**: `npm ci` → `npm run format:check` → `npx tsc --noEmit` → `npm run lint` → `npm test` → `npm run build` → Docker multi-stage image verification.
- **Static Security Analysis (`.github/workflows/codeql.yml`)**: Weekly & PR CodeQL scanning for JavaScript/TypeScript.
- **Supply-Chain Review (`.github/workflows/dependency-review.yml`)**: Blocks PRs introducing high/critical dependency vulnerabilities or denied licenses.
- **Automated Updates (`.github/dependabot.yml`)**: Weekly Dependabot security and maintenance PRs for npm, GitHub Actions, and Docker base images.
