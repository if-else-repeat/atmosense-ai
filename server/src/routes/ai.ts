/**
 * @module aiRoutes
 * Consolidated, strictly server-side Express routes for AtmoSense AI Gemini services.
 *
 * Mounted once under `/api/ai`:
 * - `POST /api/ai/advisory` — Structured respiratory health brief for a station
 * - `POST /api/ai/routine` — Personalized daily routine (`generateDailyRoutine`)
 * - `POST /api/ai/chat` — Conversational pulmonary assistant (station-based & zone-context)
 * - `POST /api/ai/emergency-advisory` — Emergency air quality bulletin (`generateEmergencyAdvisory`)
 * - `POST /api/ai/analyze-image` — Multimodal smog / AQI display / mask fit analysis (`analyzeImage`)
 * - `POST /api/ai/health-insights` — Symptom + AQI history correlation insights (`generateHealthInsights`)
 * - `GET  /api/ai/status` — Sanitized service status & cache metrics (never exposes API keys)
 */

import express, { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { getStationByCoordinates, getStationById } from '../services/airQualityService';
import {
  GeminiService,
  GeminiServiceError,
  geminiService,
  generateAirQualityChatReply,
  generateHealthAdvisory,
  type ChatMessage,
} from '../services/geminiService';

const sensitivitySchema = z.enum(['general', 'respiratory', 'athlete', 'vulnerable']);
const personaSchema = z.enum(['children', 'elderly', 'asthmatics', 'general']);

const advisoryBodySchema = z.object({
  stationId: z.string().regex(/^[a-zA-Z0-9_-]{2,64}$/),
  sensitivityProfile: sensitivitySchema,
  activityGoal: z.string().trim().max(180).optional(),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
});

const stationChatBodySchema = z.object({
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

const zoneDataSchema = z.object({
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

const routineRequestSchema = z.object({
  persona: personaSchema,
  zone: zoneDataSchema,
  language: z.string().trim().min(2).max(24).default('en'),
});

const contextChatRequestSchema = z.object({
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

const emergencyAdvisoryRequestSchema = z.object({
  zone: zoneDataSchema,
  severity: z.enum(['moderate', 'severe', 'critical']),
  language: z.string().trim().min(2).max(24).default('en'),
});

const analyzeImageRequestSchema = z.object({
  imageBase64: z.string().trim().min(16).max(6_500_000),
  analysisType: z.enum(['smog-severity', 'aqi-display', 'mask-check']),
});

const healthInsightsRequestSchema = z.object({
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

interface AiRateLimitOptions {
  maxRequests: number;
  windowMs: number;
  now?: () => number;
}

function resolveUserIdentifier(req: Request): string {
  const headerUser = req.header('x-user-id')?.trim();
  if (headerUser) {
    return `uid:${headerUser.slice(0, 128)}`;
  }
  return `ip:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
}

function createPerUserRateLimiter(options: AiRateLimitOptions) {
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

function extractUpstreamError(error: unknown): { status: number; message: string } {
  if (error instanceof GeminiServiceError) {
    return { status: error.statusCode, message: error.message };
  }
  if (error instanceof Error) {
    const statusProp =
      (error as Error & { statusCode?: number; status?: number }).statusCode ??
      (error as Error & { status?: number }).status;
    if (typeof statusProp === 'number' && statusProp >= 400 && statusProp < 600) {
      return { status: statusProp, message: error.message };
    }
    if (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED')) {
      return {
        status: 429,
        message: 'Gemini API quota exceeded. Check billing or quota in Settings > Secrets.',
      };
    }
    if (
      error.message.includes('403') ||
      error.message.includes('PERMISSION_DENIED') ||
      error.message.includes('API_KEY_INVALID')
    ) {
      return {
        status: 403,
        message: 'Gemini API key was rejected. Verify GEMINI_API_KEY in Settings > Secrets.',
      };
    }
    return { status: 502, message: error.message };
  }
  return { status: 502, message: 'Unexpected upstream Gemini service error.' };
}

function handleAiRouteError(error: unknown, res: Response): void {
  if (error instanceof GeminiServiceError) {
    if (error.retryAfterSeconds) {
      res.setHeader('Retry-After', String(error.retryAfterSeconds));
    }
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  const { status, message } = extractUpstreamError(error);
  res.status(status).json({ error: message });
}

/**
 * Factory creating the unified Express AI router backed by {@link GeminiService}.
 */
export function createAiRouter(
  service: GeminiService = geminiService,
  rateLimitOptions: AiRateLimitOptions = { maxRequests: 30, windowMs: 60_000 },
): Router {
  const router = Router();
  router.use(createPerUserRateLimiter(rateLimitOptions));

  router.post('/advisory', async (req: Request, res: Response) => {
    const parsed = advisoryBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid advisory request payload.',
        details: parsed.error.flatten(),
      });
      return;
    }

    const station =
      (await getStationById(parsed.data.stationId)) ??
      (parsed.data.latitude !== undefined && parsed.data.longitude !== undefined
        ? await getStationByCoordinates(parsed.data.latitude, parsed.data.longitude, {
            id: parsed.data.stationId,
          })
        : null);
    if (!station) {
      res.status(404).json({ error: `Station '${parsed.data.stationId}' not found.` });
      return;
    }

    try {
      const advisory = await generateHealthAdvisory(
        station,
        parsed.data.sensitivityProfile,
        parsed.data.activityGoal,
      );
      res.json({ advisory, stationId: station.id, aqi: station.aqi });
    } catch (error) {
      handleAiRouteError(error, res);
    }
  });

  router.post('/routine', async (req: Request, res: Response) => {
    const parsed = routineRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid daily routine request payload.',
        details: parsed.error.flatten(),
      });
      return;
    }

    try {
      const userId = resolveUserIdentifier(req);
      const routine = await service.generateDailyRoutine(
        parsed.data.persona,
        parsed.data.zone,
        parsed.data.language,
        userId,
      );
      res.json({ routine, generatedAt: new Date().toISOString() });
    } catch (error) {
      handleAiRouteError(error, res);
    }
  });

  router.post('/chat', async (req: Request, res: Response) => {
    const isContextChat =
      req.body &&
      typeof req.body === 'object' &&
      'context' in req.body &&
      !('stationId' in req.body);

    if (isContextChat) {
      const parsed = contextChatRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Invalid chat request payload.',
          details: parsed.error.flatten(),
        });
        return;
      }

      try {
        const userId = resolveUserIdentifier(req);
        const response = await service.chat(
          parsed.data.message,
          { ...parsed.data.context, userId },
          parsed.data.history as ChatMessage[],
        );
        res.json({ response, generatedAt: new Date().toISOString() });
      } catch (error) {
        handleAiRouteError(error, res);
      }
      return;
    }

    const parsed = stationChatBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid chat message payload.',
        details: parsed.error.flatten(),
      });
      return;
    }

    const station =
      (await getStationById(parsed.data.stationId)) ??
      (parsed.data.latitude !== undefined && parsed.data.longitude !== undefined
        ? await getStationByCoordinates(parsed.data.latitude, parsed.data.longitude, {
            id: parsed.data.stationId,
          })
        : null);
    if (!station) {
      res.status(404).json({ error: `Station '${parsed.data.stationId}' not found.` });
      return;
    }

    try {
      const result = await generateAirQualityChatReply(
        station,
        parsed.data.sensitivityProfile,
        parsed.data.history,
        parsed.data.message,
      );
      res.json(result);
    } catch (error) {
      handleAiRouteError(error, res);
    }
  });

  router.post('/emergency-advisory', async (req: Request, res: Response) => {
    const parsed = emergencyAdvisoryRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid emergency advisory request payload.',
        details: parsed.error.flatten(),
      });
      return;
    }

    try {
      const userId = resolveUserIdentifier(req);
      const advisory = await service.generateEmergencyAdvisory(
        parsed.data.zone,
        parsed.data.severity,
        parsed.data.language,
        userId,
      );
      res.json({
        advisory,
        severity: parsed.data.severity,
        zoneName: parsed.data.zone.name,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleAiRouteError(error, res);
    }
  });

  router.post(
    '/analyze-image',
    express.json({ limit: '6mb' }),
    async (req: Request, res: Response) => {
      const parsed = analyzeImageRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Invalid image analysis request payload.',
          details: parsed.error.flatten(),
        });
        return;
      }

      try {
        const userId = resolveUserIdentifier(req);
        const analysis = await service.analyzeImage(
          parsed.data.imageBase64,
          parsed.data.analysisType,
          userId,
        );
        res.json({ analysis, generatedAt: new Date().toISOString() });
      } catch (error) {
        handleAiRouteError(error, res);
      }
    },
  );

  router.post('/health-insights', async (req: Request, res: Response) => {
    const parsed = healthInsightsRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid health insights request payload.',
        details: parsed.error.flatten(),
      });
      return;
    }

    try {
      const userId = resolveUserIdentifier(req);
      const insights = await service.generateHealthInsights(
        parsed.data.symptomLogs,
        parsed.data.aqiHistory,
        userId,
      );
      res.json({
        count: insights.length,
        insights,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleAiRouteError(error, res);
    }
  });

  router.get('/status', (_req: Request, res: Response) => {
    res.json({
      service: 'atmosense-gemini-ai',
      ...service.getServiceStatus(),
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}

/** Default consolidated Express AI router instance. */
export const aiRouter = createAiRouter();
export default aiRouter;
