import { Router } from 'express';
import { z } from 'zod';
import { createRateLimiter } from '../middleware/rateLimitAndAuth.ts';
import {
  detectLocationByIp,
  getAllStations,
  getStationByCoordinates,
  getStationById,
} from '../services/airQualityService.ts';

const stationIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{2,64}$/);

const coordsQuerySchema = z.object({
  lat: z.coerce.number().finite().min(-90).max(90),
  lng: z.coerce.number().finite().min(-180).max(180),
  stationId: z.string().trim().optional(),
  refresh: z.string().optional(),
});

export const airQualityRouter = Router();
airQualityRouter.use(createRateLimiter({ dataMaxRequests: 120, windowMs: 60_000 }));

airQualityRouter.get('/', async (req, res, next) => {
  try {
    const forceRefresh = req.query.refresh === '1';
    const stations = await getAllStations(forceRefresh);
    res.json({
      count: stations.length,
      stations,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/air-quality/by-coords?lat=12.9716&lng=77.5946
 * Returns live hyperlocal AQI, 24h forecast, weather, and reverse-geocoded place name.
 */
airQualityRouter.get('/by-coords', async (req, res, next) => {
  try {
    const rawLat = typeof req.query.lat === 'string' ? req.query.lat.trim() : '';
    const rawLng =
      typeof req.query.lng === 'string'
        ? req.query.lng.trim()
        : typeof req.query.lon === 'string'
          ? req.query.lon.trim()
          : '';

    const parsed = coordsQuerySchema.safeParse({
      lat: rawLat || undefined,
      lng: rawLng || undefined,
      stationId: typeof req.query.stationId === 'string' ? req.query.stationId : undefined,
      refresh: typeof req.query.refresh === 'string' ? req.query.refresh : undefined,
    });

    if (!parsed.success) {
      res.status(400).json({
        error: 'Valid numeric "lat" (-90..90) and "lng" (-180..180) query parameters are required.',
      });
      return;
    }

    const stationIdCheck = stationIdSchema.safeParse(parsed.data.stationId ?? '');
    const stationId = stationIdCheck.success ? stationIdCheck.data : 'current-location';

    const station = await getStationByCoordinates(parsed.data.lat, parsed.data.lng, {
      id: stationId,
      forceRefresh: parsed.data.refresh === '1',
    });
    res.json({
      station,
      method: 'coords',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/air-quality/detect-location
 * Server-side IP geolocation fallback when browser GPS is unavailable or denied.
 */
airQualityRouter.get('/detect-location', async (req, res, next) => {
  try {
    const forwardedFor = req.header('x-forwarded-for');
    const clientIp = forwardedFor || req.ip || req.socket?.remoteAddress || undefined;
    const detected = await detectLocationByIp(clientIp);
    if (!detected) {
      res.json({
        detected: false,
        station: null,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const station = await getStationByCoordinates(detected.latitude, detected.longitude, {
      id: 'current-location',
      placeHint: {
        city: detected.city,
        country: detected.country,
        district: detected.district,
      },
      forceRefresh: req.query.refresh === '1',
    });

    res.json({
      detected: true,
      method: 'ip',
      station,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

airQualityRouter.get('/:stationId', async (req, res, next) => {
  try {
    const parsedId = stationIdSchema.safeParse(req.params.stationId);
    if (!parsedId.success) {
      res.status(400).json({ error: 'Invalid stationId parameter.' });
      return;
    }
    const forceRefresh = req.query.refresh === '1';
    const station = await getStationById(parsedId.data, forceRefresh);
    if (!station) {
      res.status(404).json({ error: `Station '${parsedId.data}' was not found.` });
      return;
    }
    res.json({ station });
  } catch (error) {
    next(error);
  }
});
