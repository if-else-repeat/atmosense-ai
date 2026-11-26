import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { GeminiServiceError } from '../services/geminiService';

export const sensitivitySchema = z.enum(['general', 'respiratory', 'athlete', 'vulnerable']);
export const personaSchema = z.enum(['children', 'elderly', 'asthmatics', 'general']);

export const lifestyleContextSchema = z
  .object({
    commuteMode: z
      .enum(['solo_car', 'motorbike', 'public_transit', 'carpool', 'bike_walk', 'remote'])
      .optional(),
    heatingCookingFuel: z
      .enum(['wood_biomass', 'gas_lpg', 'diesel_backup', 'electric_induction', 'heat_pump'])
      .optional(),
    housingType: z
      .enum(['apartment_highrise', 'suburban_home', 'older_drafty', 'shared_flat'])
      .optional(),
    householdSize: z.number().int().min(1).max(8).optional(),
  })
  .optional();

export const advisoryBodySchema = z.object({
  stationId: z.string().regex(/^[a-zA-Z0-9_-]{2,64}$/),
  sensitivityProfile: sensitivitySchema,
  activityGoal: z.string().trim().max(180).optional(),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
});

export const stationChatBodySchema = z.object({
  stationId: z.string().regex(/^[a-zA-Z0-9_-]{2,64}$/),
  sensitivityProfile: sensitivitySchema,
  message: z.string().trim().min(2).max(600),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(1500),
      }),
    )
    .max(12)
    .default([]),
});

export const zoneDataSchema = z.object({
  name: z.string().trim().min(1).max(160),
  aqi: z.number().finite().min(0).max(500),
  pm25: z.number().finite().min(0).max(2000),
  pm10: z.number().finite().min(0).max(5000).optional(),
  no2: z.number().finite().min(0).max(5000).optional(),
  o3: z.number().finite().min(0).max(5).optional(),
  co: z.number().finite().min(0).max(500).optional(),
  so2: z.number().finite().min(0).max(5000).optional(),
  dominantPollutant: z.string().trim().max(32).optional(),
  temperatureC: z.number().finite().min(-60).max(65).optional(),
  humidityPct: z.number().finite().min(0).max(100).optional(),
  windKph: z.number().finite().min(0).max(300).optional(),
});

export const routineRequestSchema = z.object({
  persona: personaSchema,
  zone: zoneDataSchema,
  language: z.string().trim().min(2).max(24).default('en'),
  lifestyle: lifestyleContextSchema,
});

export const contextChatRequestSchema = z.object({
  message: z.string().trim().min(1).max(1200),
  context: z.object({
    persona: personaSchema,
    zone: zoneDataSchema,
    language: z.string().trim().min(2).max(24).optional(),
  }),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(1200),
        timestamp: z.number().finite().optional(),
      }),
    )
    .max(20)
    .default([]),
});

export const emergencyAdvisoryRequestSchema = z.object({
  zone: zoneDataSchema,
  severity: z.enum(['moderate', 'severe', 'critical']),
  language: z.string().trim().min(2).max(24).default('en'),
});

export const analyzeImageRequestSchema = z.object({
  imageBase64: z.string().trim().min(16).max(6_500_000),
  analysisType: z.enum(['smog-severity', 'aqi-display', 'mask-check']),
});

export const healthInsightsRequestSchema = z.object({
  symptomLogs: z
    .array(
      z.object({
        timestamp: z.number().finite().positive(),
        symptoms: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
        severity: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
        outdoorMinutes: z.number().finite().min(0).max(1440).optional(),
        notes: z.string().max(400).optional(),
      }),
    )
    .max(90),
  aqiHistory: z
    .array(
      z.object({
        timestamp: z.number().finite().positive(),
        aqi: z.number().finite().min(0).max(500),
        pm25: z.number().finite().min(0).max(2000).optional(),
        dominantPollutant: z.string().trim().max(32).optional(),
      }),
    )
    .max(240),
});

export interface AiRateLimitOptions {
  maxRequests: number;
  windowMs: number;
  now?: () => number;
}

/** Resolves a stable per-user key for sliding-window AI rate limiting. */
export function resolveUserIdentifier(req: Request): string {
  const headerUser = req.header('x-user-id')?.trim();
  if (headerUser) {
    return `uid:${headerUser.slice(0, 128)}`;
  }
  return `ip:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
}

/** Creates a sliding-window per-user rate limiter for AI endpoints. */
export function createPerUserRateLimiter(options: AiRateLimitOptions) {
  const { maxRequests, windowMs, now = Date.now } = options;
  const buckets = new Map<string, number[]>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const userKey = resolveUserIdentifier(req);
    const current = now();
    const cutoff = current - windowMs;
    const recent = (buckets.get(userKey) ?? []).filter((ts) => ts > cutoff);

    if (recent.length >= maxRequests) {
      const oldest = recent[0] ?? current;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - current) / 1000));
      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json({
        error: `Rate limit exceeded (${maxRequests} requests per minute per user).`,
        retryAfterSeconds,
      });
      return;
    }

    recent.push(current);
    buckets.set(userKey, recent);
    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - recent.length)));
    next();
  };
}

/** Maps upstream Gemini errors to safe, sanitized HTTP responses. */
export function handleAiRouteError(error: unknown, res: Response): void {
  if (error instanceof GeminiServiceError) {
    if (error.retryAfterSeconds) {
      res.setHeader('Retry-After', String(error.retryAfterSeconds));
    }
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  if (error instanceof Error) {
    const statusProp =
      (error as Error & { statusCode?: number; status?: number }).statusCode ??
      (error as Error & { status?: number }).status;
    if (typeof statusProp === 'number' && statusProp >= 400 && statusProp < 600) {
      res.status(statusProp).json({ error: error.message });
      return;
    }
    if (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED')) {
      res.status(429).json({
        error: 'Gemini API quota exceeded. Check billing or quota in Settings > Secrets.',
      });
      return;
    }
    if (
      error.message.includes('403') ||
      error.message.includes('PERMISSION_DENIED') ||
      error.message.includes('API_KEY_INVALID')
    ) {
      res.status(403).json({
        error: 'Gemini API key was rejected. Verify GEMINI_API_KEY in Settings > Secrets.',
      });
      return;
    }
    res.status(502).json({ error: error.message });
    return;
  }
  res.status(502).json({ error: 'Unexpected upstream Gemini service error.' });
}
