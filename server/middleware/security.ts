/**
 * @module security
 * Layered Express security middleware stack for AtmoSense AI:
 * Helmet CSP + Permissions-Policy, dynamic CORS whitelist, input sanitization,
 * CWE-209 safe error handling, plus re-exported rate limiting, request logging, and API key auth.
 */

import cors, { type CorsOptions } from 'cors';
import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import helmet from 'helmet';
import { logger } from '../src/utils/logger.ts';
import {
  apiKeyAuth,
  createApiKeyAuth,
  createRateLimiter,
  createRequestLogger,
  rateLimiter,
  requestLogger,
  sanitizeUrlForLog,
  timingSafeKeyEquals,
  type ApiKeyAuthOptions,
  type TieredRateLimiterOptions,
} from './rateLimitAndAuth.ts';
import { sanitizePayloadDeep, validateBody, validateQuery } from './validate.ts';

export {
  apiKeyAuth,
  createApiKeyAuth,
  createRateLimiter,
  createRequestLogger,
  rateLimiter,
  requestLogger,
  sanitizeUrlForLog,
  timingSafeKeyEquals,
  validateBody,
  validateQuery,
};
export type { ApiKeyAuthOptions, TieredRateLimiterOptions };

const helmetBase: RequestHandler = helmet({
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
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
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
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  frameguard: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

/** 1. Helmet CSP + strict Permissions-Policy defense-in-depth middleware. */
export const helmetMiddleware: RequestHandler = (req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(self), microphone=(self), geolocation=(self), payment=(), usb=(), magnetometer=()',
  );
  helmetBase(req, res, next);
};

/** Computes the dynamic allowed CORS origin set (never uses `*` wildcards in production). */
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
      origins.add(new URL(trimmed).origin);
    } catch {
      // Ignore malformed origin entries
    }
  }

  return origins;
}

/** 2. CORS middleware factory with dynamic whitelist and credentials support. */
export function createCorsMiddleware(extraOrigins: string[] = []): RequestHandler {
  const allowedOrigins = buildAllowedOrigins(extraOrigins);
  const corsOptions: CorsOptions = {
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-User-Id'],
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.has(origin) || /^https:\/\/[a-z0-9.-]+\.run\.app$/i.test(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
  };
  return cors(corsOptions);
}

export const corsMiddleware: RequestHandler = createCorsMiddleware();

/** 4. Input validator & deep sanitizer middleware with prototype-pollution protection. */
export function inputValidator(req: Request, res: Response, next: NextFunction): void {
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

/** 5. CWE-209 compliant Express error handler (never leaks stack traces). */
export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  logger.error('[AtmoSense Security ErrorHandler]', {
    error: err instanceof Error ? err.message : String(err),
  });

  if (res.headersSent) return;

  const errorStatus =
    typeof err === 'object' && err !== null && 'status' in err
      ? (err as { status?: unknown }).status
      : undefined;

  if (err instanceof SyntaxError && errorStatus === 400) {
    res.status(400).json({ error: 'Malformed JSON request body.' });
    return;
  }

  const statusCode =
    typeof errorStatus === 'number' && errorStatus >= 400 && errorStatus < 500 ? errorStatus : 500;

  res
    .status(statusCode)
    .json({ error: statusCode >= 500 ? 'Internal Server Error' : 'Bad Request' });
};
