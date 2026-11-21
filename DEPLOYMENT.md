# Deployment Guide — Docker, Environment Variables & Firebase Setup

## 1. Deployment Overview

**AtmoSense AI** packages its Express 5 API server and Vite-compiled React 19 PWA into a single unified Node.js 20 runtime listening on port `3000`. It supports:

- **Docker & Docker Compose** (multi-stage Alpine build with non-root user & `HEALTHCHECK`)
- **Google Cloud Run** (stateless HTTPS container with `app.set('trust proxy', 1)` and automatic `*.run.app` CORS matching)
- **Bare-metal / VM Node.js 20+** behind Nginx, Caddy, or Cloudflare TLS termination

---

## 2. Environment Variable Reference

Copy `.env.example` to `.env` for local runs, or inject secrets via your cloud secret manager in production. **Never commit `.env` or prefix secret keys with `VITE_`.**

| Variable              | Required    | Default                                                 | Visibility          | Purpose                                                                                                                 |
| --------------------- | ----------- | ------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`            | Yes (prod)  | `development`                                           | Server              | Set to `production` to serve compiled `dist/` assets with `Cache-Control: max-age=1d` and disable dev CSP WebSockets.   |
| `PORT`                | No          | `3000`                                                  | Server              | HTTP listening port (`0.0.0.0:$PORT`).                                                                                  |
| `APP_URL`             | Recommended | `http://localhost:3000`                                 | Server              | Primary public HTTPS origin added to dynamic CORS allowlist.                                                            |
| `PRODUCTION_ORIGIN`   | Optional    | —                                                       | Server              | Additional production origin for strict CORS whitelist (never use `*`).                                                 |
| `ALLOWED_ORIGINS`     | Optional    | —                                                       | Server              | Comma-separated list of extra trusted HTTPS origins.                                                                    |
| `GEMINI_API_KEY`      | Recommended | —                                                       | **Secret (Server)** | Google Gemini API key for server-side pulmonary AI. If omitted, deterministic fallback heuristics engage automatically. |
| `GEMINI_MODEL`        | No          | `gemini-4-hydrogen`                                     | Server              | Gemini model alias used by `GeminiService`.                                                                             |
| `WAQI_API_TOKEN`      | Recommended | —                                                       | **Secret (Server)** | Primary World Air Quality Index (WAQI) geo feed token.                                                                  |
| `OPENWEATHER_API_KEY` | Recommended | —                                                       | **Secret (Server)** | OpenWeather Air Pollution API key (HTTPS current & forecast).                                                           |
| `OPENAQ_API_KEY`      | Optional    | —                                                       | **Secret (Server)** | Optional OpenAQ API key. When omitted, live requests skip the retired unauthenticated v2 endpoint cleanly.              |
| `OPEN_METEO_AQ_URL`   | No          | `https://air-quality-api.open-meteo.com/v1/air-quality` | Server              | Open-Meteo 24h air quality endpoint (no API key required).                                                              |
| `ATMOSENSE_API_KEY`   | Optional    | —                                                       | **Secret (Server)** | Comma-separated API keys for optional programmatic `X-API-Key` header authentication (`crypto.timingSafeEqual`).        |

---

## 3. Docker & Docker Compose Deployment

### 3.1 Multi-Stage `Dockerfile` Highlights

1. **`deps` stage** (`node:20-alpine`): Installs pinned workspace dependencies (`npm ci`).
2. **`builder` stage**: Runs `npm run build` to generate optimized `dist/` chunks and Workbox PWA `sw.js`.
3. **`runner` stage**: Drops privileges to a dedicated non-root user (`atmosense`), exposes port `3000`, configures a built-in Docker `HEALTHCHECK` polling `http://localhost:3000/api/health` every 30s, and starts the unified server (`npx tsx server.ts`).

### 3.2 Launch with Docker Compose

```bash
# 1. Prepare production environment file
cp .env.example .env
# Edit .env with your server-side API keys and APP_URL

# 2. Build and start in detached mode
docker compose up --build -d

# 3. Verify healthcheck status and live probe
docker compose ps
curl -s http://localhost:3000/api/health
```

### 3.3 Standalone Docker Build

```bash
docker build -t atmosense-ai:1.0.0 .
docker run -d \
  --name atmosense-ai \
  -p 3000:3000 \
  --env-file .env \
  -e NODE_ENV=production \
  --restart unless-stopped \
  atmosense-ai:1.0.0
```

---

## 4. Google Cloud Run Deployment

AtmoSense AI is pre-configured for Cloud Run (`app.set('trust proxy', 1)` for accurate IP rate limiting behind Google Load Balancers and dynamic `https://*.run.app` CORS verification):

```bash
# 1. Build and push image to Artifact Registry
gcloud builds submit --tag gcr.io/<PROJECT_ID>/atmosense-ai:1.0.0

# 2. Deploy with Secret Manager bindings
gcloud run deploy atmosense-ai \
  --image gcr.io/<PROJECT_ID>/atmosense-ai:1.0.0 \
  --region asia-east1 \
  --port 3000 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,APP_URL=https://<YOUR_SERVICE_URL> \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest,WAQI_API_TOKEN=WAQI_API_TOKEN:latest,OPENWEATHER_API_KEY=OPENWEATHER_API_KEY:latest
```

---

## 5. Firebase Authentication & Cloud Firestore Setup

Firebase is optional for anonymous browsing (real-time AQI, map, family local storage, community hub, and AI guidance all function without signing in) and enables cross-device cloud sync when authenticated.

### 5.1 Configuration Files

- **`firebase-applet-config.json`**: Public Firebase Web SDK configuration (`projectId`, `apiKey`, `authDomain`, `firestoreDatabaseId`).
- **`firebase-blueprint.json`**: Canonical Firestore collection schema (`users/{uid}`, `savedLocations/{stationId}`, `savedAdvisories/{advisoryId}`).
- **`firestore.rules`**: Strict owner-scoped security rules requiring `request.auth != null && request.auth.uid == userId`, validating field types/lengths/ranges, and enforcing immutable `uid`/`createdAt` fields.

### 5.2 Enable Google Sign-In & Authorized Domains

1. Open the Firebase Console → **Authentication** → **Sign-in method** → enable **Google**.
2. Under **Authentication → Settings → Authorized domains**, add your production domain (e.g., `your-domain.com` or `*.run.app`) alongside `localhost`.

### 5.3 Deploy & Verify Firestore Security Rules

```bash
# Install Firebase CLI if needed
npm install -g firebase-tools
firebase login

# Deploy Firestore security rules to your project
firebase deploy --only firestore:rules

# Validate rules against unit tests
npx vitest run firestore.rules.test.ts
```

---

## 6. Post-Deployment Verification Checklist

```bash
# 1. Verify liveness & AI readiness
curl -f https://<YOUR_DOMAIN>/api/health

# 2. Verify multi-source AQI fusion
curl -f "https://<YOUR_DOMAIN>/api/aqi/current?lat=28.6139&lng=77.2090"

# 3. Verify Helmet CSP & security headers
curl -I https://<YOUR_DOMAIN>/api/health | grep -iE "content-security-policy|x-content-type-options|x-ratelimit"

# 4. Verify PWA manifest & service worker availability
curl -f https://<YOUR_DOMAIN>/manifest.webmanifest
curl -f https://<YOUR_DOMAIN>/sw.js
```

---

## 7. Troubleshooting

| Symptom                                                        | Root Cause                                                 | Resolution                                                                                   |
| -------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `Client build missing. Run npm run build first.`               | Running `NODE_ENV=production` before compiling `dist/`     | Run `npm run build` before starting the production server.                                   |
| `403 Blocked request` behind custom domain in dev              | Host header not allowed by Vite                            | Verified fixed via `allowedHosts: true` in `vite.config.ts` and `server/src/index.ts`.       |
| Google Sign-In popup blocked or unauthorized domain            | Production domain missing from Firebase Authorized Domains | Add the exact hostname in Firebase Console → Authentication → Settings → Authorized domains. |
| AI endpoints return heuristic responses instead of live Gemini | `GEMINI_API_KEY` missing or placeholder                    | Set a valid server-side `GEMINI_API_KEY` in `.env` or Cloud Run Secret Manager and restart.  |
