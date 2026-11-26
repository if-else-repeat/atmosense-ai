/**
 * @module security
 * Layered Express security middleware stack for AtmoSense AI:
 * 1. `helmetMiddleware` — Strict Content-Security-Policy and security headers
 * 2. `corsMiddleware` — Dynamic origin whitelist with credentials (no wildcards in prod)
 * 3. `rateLimiter` — Two-tier IP rate limiting (30 req/min AI, 100 req/min Data, skips /api/health)
 * 4. `inputValidator` — Payload sanitization, prototype-pollution stripping, and coordinate/AQI bounds
 * 5. `errorHandler` — CWE-209 compliant error handler (never leaks stack traces in production)
 * 6. `requestLogger` — Morgan custom request logger omitting bodies, tokens, and PII
 * 7. `apiKeyAuth` — Timing-safe `X-API-Key` verification via `crypto.timingSafeEqual`
 */

import cors, { type CorsOptions } from 'cors';
import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import crypto from 'node:crypto';
import { logger } from '../src/utils/logger.ts';
import { sanitizePayloadDeep, validateBody, validateQuery } from './validate.ts';

export { validateBody, validateQuery };

/**
 * 1. Helmet middleware with strict Content Security Policy.
 */
export const helmetMiddleware: RequestHandler = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      workerSrc: ["'self'", 'blob:'],
      frameSrc: ["'self'"],
      frameAncestors: ["'self'", 'https:'],
      upgradeInsecureRequests: null,
      connectSrc: [
        "'self'",
        ...(process.env.NODE_ENV !== 'production' ? ['ws:', 'wss:'] : []),
        'https://api.waqi.info',
        'https://api.openaq.org',
        'https://api.openweathermap.org',
        'https://air-quality-api.open-meteo.com',
        'https://api.open-meteo.com',
        'https://fonts.googleapis.com',
        'https://fonts.gstatic.com',
        'https://*.tile.openstreetmap.org',
        'https://*.openstreetmap.org',
      ],
    },
  },
  // Allow embedding inside AI Studio preview iframe and loading OSM tiles/fonts cleanly
  frameguard: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

/**
 * Computes the dynamic allowed CORS origin set.
 * Never uses `*` wildcards in production.
 */
export function buildAllowedOrigins(extraOrigins: string[] = []): Set<string> {
  const origins = new Set<string>(['http://localhost:3000', 'http://localhost:5173']);

  const envOrigins = [
    process.env.APP_URL,
    process.env.PRODUCTION_ORIGIN,
    ...(process.env.ALLOWED_ORIGINS?.split(',') ?? []),
    ...extraOrigins,
  ];

  for (const candidate of envOrigins) {
    const trimmed = candidate?.trim();
    if (!trimmed || trimmed === '*' || trimmed === 'MY_APP_URL') continue;
    try {
      const parsed = new URL(trimmed);
      origins.add(parsed.origin);
    } catch {
      // Ignore malformed origin entries
    }
  }

  return origins;
}

/**
 * 2. CORS middleware factory with dynamic whitelist and credentials support.
 */
export function createCorsMiddleware(extraOrigins: string[] = []): RequestHandler {
  const allowedOrigins = buildAllowedOrigins(extraOrigins);

  const corsOptions: CorsOptions = {
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-User-Id'],
    origin(origin, callback) {
      // Allow same-origin, server-to-server, and non-browser clients without Origin header
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.has(origin) || /^https:\/\/[a-z0-9.-]+\.run\.app$/i.test(origin)) {
        callback(null, true);
        return;
      }
      // Reject disallowed origins without setting Access-Control-Allow-Origin
      callback(null, false);
    },
  };

  return cors(corsOptions);
}

export const corsMiddleware: RequestHandler = createCorsMiddleware();

export interface TieredRateLimiterOptions {
  aiMaxRequests?: number;
  dataMaxRequests?: number;
  windowMs?: number;
  now?: () => number;
}

/**
 * 3. Two-tier IP rate limiter:
 * - AI endpoints (`/api/ai/*`): 30 req/min per IP
 * - Data endpoints (all other `/api/*`): 100 req/min per IP
 * - Skips `/api/health`
 */
export function createRateLimiter(options: TieredRateLimiterOptions = {}): RequestHandler {
  const aiMax = options.aiMaxRequests ?? 30;
  const dataMax = options.dataMaxRequests ?? 100;
  const windowMs = options.windowMs ?? 60_000;
  const now = options.now ?? Date.now;

  const buckets = new Map<string, number[]>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const requestPath = req.path || req.originalUrl || '';

    // Always skip health checks and non-API static assets
    if (requestPath === '/api/health' || !requestPath.startsWith('/api')) {
      next();
      return;
    }

    const isAiEndpoint = requestPath.startsWith('/api/ai');
    const limit = isAiEndpoint ? aiMax : dataMax;
    const tier = isAiEndpoint ? 'ai' : 'data';
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const bucketKey = `${tier}:${ip}`;

    const currentTime = now();
    const windowStart = currentTime - windowMs;
    const recent = (buckets.get(bucketKey) ?? []).filter((ts) => ts > windowStart);

    if (recent.length >= limit) {
      const oldest = recent[0] ?? currentTime;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - currentTime) / 1000));
      res.setHeader('X-RateLimit-Limit', String(limit));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json({
        error: `Rate limit exceeded for ${tier} endpoints (${limit} requests per minute).`,
        retryAfterSeconds,
      });
      return;
    }

    recent.push(currentTime);
    buckets.set(bucketKey, recent);
    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - recent.length)));
    next();
  };
}

export const rateLimiter: RequestHandler = createRateLimiter();

/**
 * 4. Input validator & sanitizer middleware.
 * - Sanitizes string values in `req.body` (trim + HTML escape)
 * - Strips prototype pollution keys (`__proto__`, `constructor`, `prototype`)
 * - Validates coordinate ranges (`lat` -90..90, `lng`/`lon` -180..180) and `aqi` (0..500)
 *   whenever present on query or top-level body.
 */
export function inputValidator(req: Request, res: Response, next: NextFunction): void {
  // Validate coordinate bounds in query params when supplied
  const checkRange = (raw: unknown, label: string, min: number, max: number): string | null => {
    if (raw === undefined || raw === null || raw === '') return null;
    const num = typeof raw === 'number' ? raw : Number(String(raw));
    if (!Number.isFinite(num) || num < min || num > max) {
      return `Parameter "${label}" must be a finite number between ${min} and ${max}.`;
    }
    return null;
  };

  const queryErrors = [
    checkRange(req.query.lat, 'lat', -90, 90),
    checkRange(req.query.lng, 'lng', -180, 180),
    checkRange(req.query.lon, 'lon', -180, 180),
    checkRange(req.query.aqi, 'aqi', 0, 500),
  ].filter(Boolean);

  if (queryErrors.length > 0) {
    res.status(400).json({ error: queryErrors[0] });
    return;
  }

  if (req.body && typeof req.body === 'object') {
    const bodyObj = req.body as Record<string, unknown>;
    const bodyErrors = [
      checkRange(bodyObj.lat, 'lat', -90, 90),
      checkRange(bodyObj.lng, 'lng', -180, 180),
      checkRange(bodyObj.aqi, 'aqi', 0, 500),
    ].filter(Boolean);

    if (bodyErrors.length > 0) {
      res.status(400).json({ error: bodyErrors[0] });
      return;
    }

    req.body = sanitizePayloadDeep(req.body);
  }

  next();
}

/**
 * 5. CWE-209 compliant Express error handler.
 * Logs full diagnostics server-side only; never exposes stack traces or internal details to clients.
 */
export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // Log full error server-side only via structured logger
  logger.error('[AtmoSense Security ErrorHandler]', {
    error: err instanceof Error ? err.message : String(err),
  });

  if (res.headersSent) {
    return;
  }

  const errorStatus =
    typeof err === 'object' && err !== null && 'status' in err
      ? (err as { status?: unknown }).status
      : undefined;

  const isBodyParseError = err instanceof SyntaxError && errorStatus === 400;

  if (isBodyParseError) {
    res.status(400).json({ error: 'Malformed JSON request body.' });
    return;
  }

  const statusCode =
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    typeof (err as { status: unknown }).status === 'number' &&
    (err as { status: number }).status >= 400 &&
    (err as { status: number }).status < 500
      ? (err as { status: number }).status
      : 500;

  if (statusCode >= 500) {
    res.status(500).json({ error: 'Internal Server Error' });
    return;
  }

  res.status(statusCode).json({ error: 'Bad Request' });
};

/**
 * Strips sensitive query parameters (tokens, keys, emails) before request logging.
 */
export function sanitizeUrlForLog(rawUrl: string): string {
  const [pathname, queryString] = rawUrl.split('?');
  if (!queryString) return pathname || '/';

  const params = new URLSearchParams(queryString);
  const redactedKeys = ['token', 'key', 'apikey', 'api_key', 'appid', 'email', 'auth', 'secret'];
  for (const key of Array.from(params.keys())) {
    if (redactedKeys.some((r) => key.toLowerCase().includes(r))) {
      params.set(key, '[REDACTED]');
    }
  }
  const serialized = params.toString();
  return serialized ? `${pathname}?${serialized}` : pathname || '/';
}

morgan.token('safe-url', (req) => sanitizeUrlForLog(req.url || '/'));

/**
 * 6. Morgan request logger.
 * Logs method, sanitized URL, HTTP status, and response time ONLY — never bodies, tokens, or PII.
 */
export function createRequestLogger(writeStream?: {
  write: (msg: string) => void;
}): RequestHandler {
  return morgan(':method :safe-url :status :response-time ms', {
    stream: writeStream,
    skip: (req) => req.url === '/api/health' && process.env.NODE_ENV === 'test',
  });
}

export const requestLogger: RequestHandler = createRequestLogger();

/**
 * Constant-time string comparison using SHA-256 digests so key lengths never leak via timing.
 */
export function timingSafeKeyEquals(candidate: string, expected: string): boolean {
  const candidateHash = crypto.createHash('sha256').update(candidate, 'utf8').digest();
  const expectedHash = crypto.createHash('sha256').update(expected, 'utf8').digest();
  return crypto.timingSafeEqual(candidateHash, expectedHash);
}

export interface ApiKeyAuthOptions {
  /** Allowed API keys; defaults to `process.env.ATMOSENSE_API_KEY` if configured. */
  validKeys?: string[];
  /** When true, missing `X-API-Key` header is rejected with 401. Defaults to false (optional programmatic access). */
  required?: boolean;
}

/**
 * 7. Optional programmatic API key middleware using `crypto.timingSafeEqual`.
 * - If `required: true`: always requires a valid `X-API-Key`.
 * - If `required: false` (default): if `X-API-Key` is provided, verifies it in constant time and
 *   marks `res.locals.apiKeyAuthenticated = true`; invalid keys are rejected with 401.
 */
export function createApiKeyAuth(options: ApiKeyAuthOptions = {}): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const provided = req.header('x-api-key')?.trim();
    const configuredKeys = (
      options.validKeys ??
      (process.env.ATMOSENSE_API_KEY ? process.env.ATMOSENSE_API_KEY.split(',') : [])
    )
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    if (!provided) {
      if (options.required) {
        res.status(401).json({ error: 'Unauthorized: X-API-Key header required.' });
        return;
      }
      next();
      return;
    }

    if (configuredKeys.length === 0) {
      res.status(401).json({ error: 'Unauthorized: invalid API key.' });
      return;
    }

    const matched = configuredKeys.some((expectedKey) =>
      timingSafeKeyEquals(provided, expectedKey),
    );
    if (!matched) {
      res.status(401).json({ error: 'Unauthorized: invalid API key.' });
      return;
    }

    res.locals.apiKeyAuthenticated = true;
    next();
  };
}

export const apiKeyAuth: RequestHandler = createApiKeyAuth({ required: false });
