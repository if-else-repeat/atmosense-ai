/**
 * @module aiRoutes
 * Consolidated, strictly server-side Express routes for AtmoSense AI Gemini services.
 */

import express, { Router, type Request, type Response } from 'express';
import { getStationByCoordinates, getStationById } from '../services/airQualityService.ts';
import {
  GeminiService,
  geminiService,
  generateAirQualityChatReply,
  generateHealthAdvisory,
  type ChatMessage,
} from '../services/geminiService.ts';
import {
  advisoryBodySchema,
  analyzeImageRequestSchema,
  contextChatRequestSchema,
  createPerUserRateLimiter,
  emergencyAdvisoryRequestSchema,
  handleAiRouteError,
  healthInsightsRequestSchema,
  resolveUserIdentifier,
  routineRequestSchema,
  stationChatBodySchema,
  type AiRateLimitOptions,
} from './aiSchemas.ts';

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
