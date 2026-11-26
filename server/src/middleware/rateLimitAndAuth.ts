/**
 * @module rateLimitAndAuth
 * Two-tier IP sliding-window rate limiter, Morgan sanitized request logger, and timing-safe API key auth.
 */

import type { NextFunction, Request, RequestHandler, Response } from 'express';
import morgan from 'morgan';
import crypto from 'node:crypto';

export interface TieredRateLimiterOptions {
  aiMaxRequests?: number;
  dataMaxRequests?: number;
  windowMs?: number;
  now?: () => number;
}

/**
 * Two-tier IP rate limiter:
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

/** Strips sensitive query parameters (tokens, keys, emails) before request logging. */
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

/** Morgan request logger omitting bodies, tokens, and PII. */
export function createRequestLogger(writeStream?: {
  write: (msg: string) => void;
}): RequestHandler {
  return morgan(':method :safe-url :status :response-time ms', {
    stream: writeStream,
    skip: (req) => req.url === '/api/health' && process.env.NODE_ENV === 'test',
  });
}

export const requestLogger: RequestHandler = createRequestLogger();

/** Constant-time string comparison using SHA-256 digests so key lengths never leak via timing. */
export function timingSafeKeyEquals(candidate: string, expected: string): boolean {
  const candidateHash = crypto.createHash('sha256').update(candidate, 'utf8').digest();
  const expectedHash = crypto.createHash('sha256').update(expected, 'utf8').digest();
  return crypto.timingSafeEqual(candidateHash, expectedHash);
}

export interface ApiKeyAuthOptions {
  validKeys?: string[];
  required?: boolean;
}

/** Optional programmatic API key middleware using `crypto.timingSafeEqual`. */
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

    if (
      configuredKeys.length === 0 ||
      !configuredKeys.some((expectedKey) => timingSafeKeyEquals(provided, expectedKey))
    ) {
      res.status(401).json({ error: 'Unauthorized: invalid API key.' });
      return;
    }

    res.locals.apiKeyAuthenticated = true;
    next();
  };
}

export const apiKeyAuth: RequestHandler = createApiKeyAuth({ required: false });
