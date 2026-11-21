/**
 * @module aqiRoutes
 * Express REST API routes for the multi-source live Air Quality integration layer.
 *
 * Mounted under `/api/aqi`:
 * - `GET /api/aqi/current?lat=&lng=&persona=` — Fused live air quality with provenance & health advice
 * - `GET /api/aqi/forecast?lat=&lng=` — Multi-interval air quality forecast with automatic fallback
 * - `GET /api/aqi/sources` — Upstream provider configuration, rate-limit status, and cache metrics
 */

import { Router, type NextFunction, type Request, type Response } from 'express';
import {
  calculateAQI,
  getAQIColor,
  getHealthRecommendation,
  type PersonaProfile,
} from '../../lib/aqiEngine';
import { AQIService, AQIServiceError, aqiService } from '../services/aqiService';

const VALID_PERSONAS: ReadonlySet<PersonaProfile> = new Set([
  'children',
  'elderly',
  'asthmatics',
  'general',
]);

interface RouteRateLimitOptions {
  maxRequests: number;
  windowMs: number;
  now?: () => number;
}

/**
 * Lightweight sliding-window Express rate limiter protecting upstream AQI quotas per client IP.
 */
function createClientRateLimiter(options: RouteRateLimitOptions) {
  const { maxRequests, windowMs, now = Date.now } = options;
  const buckets = new Map<string, number[]>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const clientKey = req.ip || req.socket?.remoteAddress || 'unknown';
    const current = now();
    const cutoff = current - windowMs;

    const timestamps = (buckets.get(clientKey) ?? []).filter((ts) => ts > cutoff);
    if (timestamps.length >= maxRequests) {
      const oldest = timestamps[0] ?? current;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - current) / 1000));
      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json({
        error: 'Too many air quality requests. Please retry shortly.',
        retryAfterSeconds,
      });
      return;
    }

    timestamps.push(current);
    buckets.set(clientKey, timestamps);
    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - timestamps.length)));
    next();
  };
}

/**
 * Parses and validates `lat` and `lng` (or `lon`) query parameters.
 */
function parseCoordinatesQuery(
  query: Request['query'],
): { ok: true; lat: number; lng: number } | { ok: false; error: string } {
  const rawLat = typeof query.lat === 'string' ? query.lat.trim() : '';
  const rawLng =
    typeof query.lng === 'string'
      ? query.lng.trim()
      : typeof query.lon === 'string'
        ? query.lon.trim()
        : '';

  if (!rawLat || !rawLng) {
    return {
      ok: false,
      error: 'Query parameters "lat" and "lng" (or "lon") are required.',
    };
  }

  const lat = Number(rawLat);
  const lng = Number(rawLng);

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return {
      ok: false,
      error: 'Query parameter "lat" must be a finite number between -90 and 90.',
    };
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return {
      ok: false,
      error: 'Query parameter "lng" must be a finite number between -180 and 180.',
    };
  }

  return { ok: true, lat, lng };
}

/**
 * Creates an Express router wired to the provided {@link AQIService} instance.
 * Factory pattern enables isolated testing with mocked services and custom rate limits.
 */
export function createAqiRouter(
  service: AQIService = aqiService,
  rateLimitOptions: RouteRateLimitOptions = { maxRequests: 60, windowMs: 60_000 },
): Router {
  const router = Router();
  router.use(createClientRateLimiter(rateLimitOptions));

  /**
   * GET /api/aqi/current?lat=28.6139&lng=77.2090&persona=general
   * Returns fused live air quality readings, EPA category metadata, and persona health advice.
   */
  router.get('/current', async (req: Request, res: Response) => {
    const coords = parseCoordinatesQuery(req.query);
    if (!coords.ok) {
      res.status(400).json({ error: coords.error });
      return;
    }

    const rawPersona = typeof req.query.persona === 'string' ? req.query.persona.trim() : 'general';
    if (!VALID_PERSONAS.has(rawPersona as PersonaProfile)) {
      res.status(400).json({
        error: 'Query parameter "persona" must be one of: children, elderly, asthmatics, general.',
      });
      return;
    }
    const persona = rawPersona as PersonaProfile;

    try {
      const data = await service.getCurrentAQI(coords.lat, coords.lng);
      const calculated = calculateAQI({
        pm25: data.pm25,
        pm10: data.pm10,
        no2: data.no2,
        co: data.co,
        o3: data.o3,
      });

      res.setHeader('Cache-Control', 'public, max-age=120');
      res.json({
        data,
        aqiSummary: {
          aqi: data.aqi,
          category: calculated.category,
          dominantPollutant: calculated.dominantPollutant,
          color: getAQIColor(data.aqi),
          persona,
          recommendation: getHealthRecommendation(data.aqi, persona),
        },
        fetchedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof AQIServiceError) {
        res.status(error.statusCode).json({
          error: error.message,
          details: error.details,
        });
        return;
      }
      const message = error instanceof Error ? error.message : 'Failed to fetch live AQI data.';
      res.status(502).json({ error: message });
    }
  });

  /**
   * GET /api/aqi/forecast?lat=28.6139&lng=77.2090
   * Returns multi-interval air quality forecast with automatic WAQI → OpenWeather fallback.
   */
  router.get('/forecast', async (req: Request, res: Response) => {
    const coords = parseCoordinatesQuery(req.query);
    if (!coords.ok) {
      res.status(400).json({ error: coords.error });
      return;
    }

    try {
      const forecast = await service.getForecast(coords.lat, coords.lng);
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.json({
        location: { lat: coords.lat, lng: coords.lng },
        count: forecast.length,
        forecast,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof AQIServiceError) {
        res.status(error.statusCode).json({
          error: error.message,
          details: error.details,
        });
        return;
      }
      const message = error instanceof Error ? error.message : 'Failed to fetch AQI forecast.';
      res.status(502).json({ error: message });
    }
  });

  /**
   * GET /api/aqi/sources
   * Returns sanitized upstream source health, reliability scores, rate limits, and LRU cache stats.
   */
  router.get('/sources', (_req: Request, res: Response) => {
    res.json({
      sources: service.getSourceStatuses(),
      cache: service.getCacheStats(),
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}

/** Default Express router instance backed by the shared {@link aqiService}. */
export const aqiRouter = createAqiRouter();
export default aqiRouter;
