# Security Architecture, STRIDE Threat Model & OWASP Top 10 Compliance

## 1. Security Posture Summary

**AtmoSense AI** implements defense-in-depth across its Express 5 backend, React 19 SPA, Google Gemini AI integration, and Firebase Firestore persistence layer. Every external boundary is protected by deterministic validation, secret isolation, rate limiting, and privacy-preserving logging.

### Core Security Guarantees

- **Zero Client-Side Secrets**: `GEMINI_API_KEY`, `WAQI_API_TOKEN`, `OPENWEATHER_API_KEY`, `OPENAQ_API_KEY`, and `ATMOSENSE_API_KEY` reside strictly on the server and are never bundled into `dist/`.
- **7-Layer Express Security Middleware Stack** (`server/src/middleware/security.ts` & `server/src/middleware/validate.ts`), enforced across all route files (`airQuality.ts`, `aqi.ts`, `ai.ts`).
- **Prompt Injection Defense, Semantic Output Safety Guardrails & Zod Validation** (`server/src/services/gemini/security.ts` & `server/src/services/gemini/outputGuard.ts`).
- **CWE-209 Compliant Error Handling**: Stack traces, file paths, and internal exceptions are logged server-side only and never returned to HTTP clients.
- **GDPR-Aligned Health Privacy**: Family respiratory logs use AES-256-GCM local encryption (`client/src/utils/healthCrypto.ts`), explicit opt-in AI consent, zero analytics leakage, and one-click complete erasure.
- **Automated Supply-Chain & SAST Controls**: GitHub CodeQL (`.github/workflows/codeql.yml`), Dependency Review (`.github/workflows/dependency-review.yml`), Dependabot (`.github/dependabot.yml`), and RFC 9116 disclosure metadata (`client/public/.well-known/security.txt`).

---

## 2. Layered Express Security Stack

All `/api/*` traffic traverses the following ordered middleware chain defined in `server/src/index.ts` and `server/src/middleware/security.ts`:

| Layer | Middleware             | Configuration & Security Control                                                                                                                                                                                                                                                             |
| ----- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | `helmetMiddleware`     | Strict Content-Security-Policy (`default-src 'self'`, explicit `connect-src` allowlist for WAQI, OpenAQ, OpenWeather, Open-Meteo, Firebase, OSM tiles), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-DNS-Prefetch-Control`, `Cross-Origin-Resource-Policy`.                      |
| **2** | `corsMiddleware`       | Dynamic origin whitelist (`localhost:3000`, `localhost:5173`, `APP_URL`, `PRODUCTION_ORIGIN`, `ALLOWED_ORIGINS`, Cloud Run `*.run.app`). **Zero `*` wildcards** permitted; `credentials: true` for authenticated sessions.                                                                   |
| **3** | Scoped Body Parsers    | `256 KB` JSON body limit on all standard API routes; dedicated `6 MB` JSON parser restricted exclusively to `POST /api/ai/analyze-image` to prevent memory exhaustion DoS.                                                                                                                   |
| **4** | `requestLogger`        | Custom Morgan format (`:method :safe-url :status :response-time ms`). Strips sensitive query keys (`token`, `key`, `apikey`, `appid`, `email`, `auth`, `secret`) and **never logs request bodies, cookies, Authorization headers, or PII**.                                                  |
| **5** | `rateLimiter`          | Two-tier sliding-window IP limiter: **30 req/min** on `/api/ai/*`, **100 req/min** on `/api/aqi/*` and `/api/air-quality/*`, exempting `/api/health`. Returns standard `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `Retry-After` headers with HTTP `429`.                              |
| **6** | `apiKeyAuth`           | Optional programmatic `X-API-Key` authentication using SHA-256 digest normalization + `crypto.timingSafeEqual()` to prevent timing side-channel attacks and key-length oracle leaks.                                                                                                         |
| **7** | `inputValidator` + Zod | Strips prototype pollution keys (`__proto__`, `constructor`, `prototype`), trims and HTML-escapes strings recursively (`sanitizePayloadDeep`), enforces physical range bounds (`lat` `[-90, 90]`, `lng` `[-180, 180]`, `aqi` `[0, 500]`), and rejects unknown fields via strict Zod schemas. |
| **8** | `errorHandler`         | CWE-209 safe terminal error handler: logs full error stack server-side only; returns `{ error: "Malformed JSON request body." }` (400) or `{ error: "Internal Server Error" }` (500) to clients.                                                                                             |

---

## 3. AI Prompt-Injection & Clinical Output Guardrails

Every LLM request and response passes through a two-stage safety firewall in `server/src/services/gemini/security.ts` and `server/src/services/gemini/outputGuard.ts`:

1. **Input Guard (`sanitizePromptInput` & `scanPromptInjection`)**: Strips system/role override attempts (`ignore previous instructions`, `<|im_start|>`, `system:`, jailbreak delimiters) and neutralizes control characters before constructing model prompts.
2. **Output Guard (`validateGeminiOutputSafety`)**: Inspects parsed Gemini responses before returning them to clients:
   - **Hallucinated AQI Divergence Gate**: Flags outputs whose stated current AQI diverges by more than `40` points from verified live sensor telemetry.
   - **Clinical Medication Safety Gate**: Flags dangerous medical directives (e.g., advising asthmatic/COPD patients to stop prescribed rescue inhalers or alter prescription dosing).
   - **Fail-Safe Fallback**: Any flagged or schema-invalid response automatically falls back to deterministic WHO/EPA atmospheric heuristics (`server/src/services/fallback/`).

---

## 4. STRIDE Threat Model

| Threat Category                | Attack Scenario                                                                                  | Attack Surface                                       | Mitigation Implemented                                                                                                                                                                       | Verification                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **S — Spoofing**               | Attacker impersonates another user to read/modify saved monitoring zones or advisories           | Firebase Firestore `/users/{uid}/*`                  | Firebase ID token verification via `firestore.rules` (`request.auth != null && request.auth.uid == userId && email_verified == true`); immutable `uid` enforcement                           | `firestore.rules.test.ts`                                  |
| **S — Spoofing**               | Attacker brute-forces programmatic `X-API-Key` via response timing differences                   | `/api/*` with `X-API-Key` header                     | Constant-time comparison of SHA-256 digests (`timingSafeKeyEquals` using `crypto.timingSafeEqual`)                                                                                           | `server/tests/security.test.ts`                            |
| **T — Tampering**              | Prototype pollution (`{"__proto__": {"isAdmin": true}}`) or XSS payload injection in JSON bodies | All `POST /api/*` routes                             | `sanitizePayloadDeep` strips dangerous keys and escapes HTML special characters (`<`, `>`, `&`, `"`, `'`); strict Zod schemas reject unknown keys                                            | `server/tests/security.test.ts`                            |
| **T — Tampering**              | Prompt injection or hallucinated medical advice in AI endpoints                                  | `POST /api/ai/*`                                     | `sanitizePromptInput` + `scanPromptInjection` + strict Zod schemas + `validateGeminiOutputSafety` (AQI drift >40 & unsafe dosing check) with deterministic fallback                          | `server/tests/geminiSecurity.test.ts`                      |
| **R — Repudiation**            | Abuse or anomalous scraping goes undetected while health logs leak PII                           | API request logs & AI calls                          | Morgan logs method, sanitized URL, status, and response time; `GeminiService` logs SHA-256 truncated `userTag` and operation name without raw messages or PII                                | `server/tests/security.test.ts`, `geminiRunner.test.ts`    |
| **I — Information Disclosure** | Unhandled exception leaks stack trace, internal paths, or DB/API credentials (CWE-209)           | Express error pipeline                               | Terminal `errorHandler` always returns generic JSON messages without stack traces; URL redactor (`redactUrlSecrets`) masks `token=` and `appid=` in upstream warnings                        | `server/tests/security.test.ts`, `aqiProviders.test.ts`    |
| **I — Information Disclosure** | Family respiratory symptoms exposed in browser storage or sent to AI without consent             | `FamilyManager`, `HealthInsights`, `healthCrypto.ts` | Local AES-256-GCM encryption, explicit consent checkbox required prior to `/api/ai/health-insights`, zero health metrics in analytics, GDPR one-click delete                                 | `client/src/tests/utils/healthCrypto.test.ts`              |
| **D — Denial of Service**      | Flood of expensive Gemini requests or oversized JSON payloads exhausts server memory/quota       | `/api/ai/*`, `/api/aqi/*`, `/api/air-quality/*`      | Two-tier IP rate limiter (`30/m` AI, `100/m` Data) + per-user Gemini limiter (`30/m`) + SHA-256 response caching + strict `256KB`/`6MB` body limits + `6s` upstream AbortController timeouts | `server/tests/security.test.ts`, `aqiCache.test.ts`        |
| **E — Elevation of Privilege** | Client attempts to overwrite another user's profile role or bypass server route restrictions     | Firestore & Express API                              | Firestore rules enforce owner-only paths, `allow list: if false` on user roots, strict `hasOnly(...)` + `hasValidSize(...)` field guards; Docker runs as non-root `atmosense` user           | `firestore.rules`, `firestore.rules.test.ts`, `Dockerfile` |

---

## 5. Cloud Firestore Security Invariants & "Dirty Dozen" Adversarial Checklist

All Cloud Firestore collections enforce default-deny (`match /{document=**} { allow read, write: if false; }`) with owner-scoped, email-verified access (`request.auth.token.email_verified == true`), bounded payload keys (`hasValidSize(...)`), and append-only advisories (`allow update: if false` on `/advisories/{advisoryId}`). The 12 adversarial security invariants verified in `firestore.rules.test.ts` are:

1. **Identity Spoofing**: Creating `/users/{userId}` with `uid != request.auth.uid` is denied.
2. **Shadow Field Injection**: Extra unexpected keys (e.g. `role: "admin"`, `isPro: true`) rejected by `hasOnly(...)` / `hasValidSize(...)`.
3. **PII Blanket Read/List**: `allow list: if false` on `/users` prevents enumerating user profiles across tenants.
4. **Unverified Email Write**: Writes with `email_verified != true` are rejected.
5. **Timestamp Forgery**: `createdAt` must be bounded and immutable after creation.
6. **Immutable Field Tampering**: Updating `uid` or `createdAt` on an existing document is denied.
7. **Orphaned Subcollection Write**: Creating subcollection documents without matching owner UID is denied.
8. **Cross-Tenant Subcollection Read/List**: Reading or listing `/users/{otherUid}/savedLocations` or `/advisories` is denied.
9. **Path Variable Poisoning**: Document path `userId` must match authenticated `request.auth.uid` and payload `uid`.
10. **Value Poisoning on Update**: Invalid alert thresholds, out-of-range strings, or oversized community report descriptions (`> 500` chars) are rejected.
11. **Coordinate Out-of-Bounds Injection**: Saved locations with `lat` outside `[-90, 90]` or `lng` outside `[-180, 180]` are denied.
12. **Append-Only Advisory Tampering**: Updating existing `/users/{userId}/advisories/{advisoryId}` records is explicitly forbidden (`allow update: if false`).

---

## 6. OWASP Top 10 (2021) Compliance Matrix

| OWASP Category                                          | Risk                                                                          | AtmoSense AI Controls                                                                                                                                                                                                                                                                        | Status    |
| ------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| **A01:2021 — Broken Access Control**                    | Unauthorized access to user zones/advisories or cross-origin credential theft | Owner-scoped, email-verified Firestore rules (`allow list: if false` on `/users`), dynamic CORS allowlist with zero wildcards, non-root container execution                                                                                                                                  | Mitigated |
| **A02:2021 — Cryptographic Failures**                   | Exposed API keys, plaintext upstream credentials, weak key checks             | HTTPS for WAQI/OpenAQ/OpenWeather/Open-Meteo, SHA-256 timing-safe API key verification, AES-256-GCM local health storage, `.env` excluded in `.gitignore`                                                                                                                                    | Mitigated |
| **A03:2021 — Injection**                                | XSS, HTML injection, prototype pollution, LLM prompt injection                | Recursive HTML escaping (`sanitizePayloadDeep`), strict Zod schemas on all inputs & AI outputs, `scanPromptInjection` + `validateGeminiOutputSafety`, React auto-escaping, Helmet CSP                                                                                                        | Mitigated |
| **A04:2021 — Insecure Design**                          | Unbounded LLM cost or unsafe single-sensor health advice                      | Deterministic fallback heuristics, >50% sensor outlier dampening, explicit AI health consent gate, two-tier rate limits, SHA-256 caching                                                                                                                                                     | Mitigated |
| **A05:2021 — Security Misconfiguration**                | Permissive CORS, missing headers, stack trace leakage                         | Helmet CSP active, CWE-209 safe `errorHandler`, `trust proxy` configured cleanly, strict TypeScript + ESLint zero warnings                                                                                                                                                                   | Mitigated |
| **A06:2021 — Vulnerable & Outdated Components**         | Known CVEs in dependencies                                                    | Modern LTS stack (`Express 5`, `React 19`, `Vite 8`, `Helmet 8`, `Zod 4`, `Node 20 Alpine`), single pinned lockfile (`package-lock.json`), CodeQL + Dependency Review + Dependabot                                                                                                           | Mitigated |
| **A07:2021 — Identification & Authentication Failures** | Weak custom password storage or timing attacks                                | Delegated OAuth 2.0 via Firebase Google Sign-In (zero custom password hashes); timing-safe `X-API-Key` validation for programmatic access                                                                                                                                                    | Mitigated |
| **A08:2021 — Software & Data Integrity Failures**       | Untrusted AI JSON structures or corrupted sensor payloads                     | Runtime physical bounds validation (`validateReading` in `AQIService`), strict Zod + `validateGeminiOutputSafety` checks, deterministic `npm ci` builds                                                                                                                                      | Mitigated |
| **A09:2021 — Security Logging & Monitoring Failures**   | Missing audit trail or accidental secret/PII logging                          | Morgan `:safe-url` redaction, `redactUrlSecrets` on upstream errors, server-side error logging without client exposure, `/api/health` monitoring                                                                                                                                             | Mitigated |
| **A10:2021 — Server-Side Request Forgery (SSRF)**       | Attacker forces backend to fetch arbitrary internal URLs                      | Upstream URLs are strictly hardcoded to vetted hosts (`api.waqi.info`, `api.openaq.org`, `api.openweathermap.org`, `air-quality-api.open-meteo.com`, `ipwho.is`, `get.geojs.io`, `api.bigdatacloud.net`, `nominatim.openstreetmap.org`); only validated numeric `lat`/`lng` are interpolated | Mitigated |

---

## 7. Secrets Management & Vulnerability Disclosure (RFC 9116)

- **`.gitignore` Verification**: Blocks `.env*`, `node_modules/`, `dist/`, `build/`, `coverage/`, and `*.log` while explicitly allowing `!.env.example`.
- **Single Root `.env.example`**: Documents every required and optional variable with placeholder values only (`YOUR_SERVER_SIDE_*`).
- **Log Redaction**: `sanitizeUrlForLog` and `redactUrlSecrets` replace `token`, `key`, `apikey`, `appid`, `email`, `auth`, and `secret` query parameters with `[REDACTED]` prior to writing to stdout/stderr.
- **RFC 9116 Disclosure Endpoint**: Served at `/.well-known/security.txt` (`client/public/.well-known/security.txt`).

If you discover a security vulnerability in AtmoSense AI:

1. **Do not** open a public GitHub issue containing exploit details.
2. Contact the security maintainers using the address listed in `/.well-known/security.txt` with reproduction steps, affected endpoint/component, and suggested remediation.
3. Maintainers acknowledge receipt within **48 hours** and target a coordinated patch release within **7 days** for critical/high findings.
