# Contributing to AtmoSense AI

Thank you for your interest in contributing to **AtmoSense AI**. Our mission is to make scientifically grounded, accessible urban air quality protection available to every household and community.

---

## 1. Development Workflow

1. **Fork & Clone** the repository:
   ```bash
   git clone https://github.com/<your-username>/atmosense-ai.git
   cd atmosense-ai
   npm install
   cp .env.example .env
   ```
2. **Create a Descriptive Branch** off `main`:
   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/your-bug-description
   ```
3. **Run the Local Full-Stack Server**:
   ```bash
   npm run dev
   ```
4. **Verify Every Quality Gate** before opening a pull request:
   ```bash
   npm run lint           # TypeScript strict check (0 errors)
   npm run lint:eslint    # ESLint v10 (0 warnings)
   npm run format:check   # Prettier formatting check
   npm run test:ci        # Full Vitest suite (146 tests, 0 skipped)
   npm run build          # Production Vite + PWA bundle (< 300 KB initial gzip)
   ```

---

## 2. Engineering & Code Quality Standards

- **Strict TypeScript Everywhere**: Avoid `any`; export explicit interfaces and JSDoc comments on public functions, classes, and hooks.
- **No Production `console.*` Calls**: Use the structured logger (`server/src/utils/logger.ts`) with secret/PII redaction across all backend services and middleware.
- **Security by Default**:
  - Never expose API keys via `VITE_*` variables or commit `.env` files.
  - Validate every new Express POST body with a strict Zod schema rejecting unknown keys.
  - Preserve CWE-209 error hygiene (never return raw `err.stack` to HTTP clients).
- **Accessibility by Default (WCAG 2.2 AA)**:
  - Never communicate AQI status with color alone—always pair color with text + icon.
  - Ensure full keyboard navigability (`Tab`, `Enter`, `Space`) and visible focus outlines.
  - Include `axe-core` assertions for every new major interactive UI component.
- **Performance Discipline**:
  - Keep initial JS + CSS load under `300 KB` gzipped by using `React.lazy` for secondary views and native SVG over heavy charting packages.
  - Memoize pure metric cards (`React.memo`) and expensive derived calculations (`useMemo`).

---

## 3. Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix  | Usage                                             | Example                                                   |
| ------- | ------------------------------------------------- | --------------------------------------------------------- |
| `feat:` | New user-facing feature or API endpoint           | `feat(family): add physician PDF export summary`          |
| `fix:`  | Bug fix or runtime resilience patch               | `fix(aqi): circuit-break retired HTTP 410 OpenAQ v2`      |
| `perf:` | Bundle size, caching, or rendering optimization   | `perf(client): lazy-load tab views and Firebase SDK`      |
| `sec:`  | Security hardening, CSP, validation, or rules     | `sec(api): enforce timing-safe X-API-Key comparison`      |
| `a11y:` | Accessibility and screen reader enhancements      | `a11y(chart): add sr-only hourly forecast summary`        |
| `test:` | Unit, integration, or accessibility test coverage | `test(aqi): add HTTP 410 circuit-breaker regression test` |
| `docs:` | Documentation updates                             | `docs: add OpenAPI 3.0.3 API specification`               |

---

## 4. Pull Request Checklist

Before requesting a review, confirm all items below:

- [ ] Code builds cleanly with `npm run build` and keeps initial bundle `< 300 KB` gzipped
- [ ] `npm run lint` (`tsc --noEmit`) reports **0 errors**
- [ ] `npm run lint:eslint` reports **0 warnings**
- [ ] `npm run test:ci` passes with **0 skipped** and **0 `.only`** tests
- [ ] New server routes include Zod validation, rate-limit coverage, and OpenAPI updates in `API_DOCUMENTATION.md`
- [ ] New UI features are tested in both light and dark modes with zero horizontal overflow at `390px` and `1440px`
- [ ] No secrets, personal emails, or temporary debug artifacts are included in the diff

---

## 5. Code of Conduct

All contributors agree to uphold a welcoming, respectful, and harassment-free community. Constructive technical critique focuses on code, architecture, and user outcomes—never on individuals.
