import { Router } from 'express';
import {
  detectLocationByIp,
  getAllStations,
  getStationByCoordinates,
  getStationById,
} from '../services/airQualityService';

export const airQualityRouter = Router();

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
 * Returns live hyperlocal AQI, 24h forecast, weather, and reverse-geocoded place name for any coordinates.
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

    const lat = Number(rawLat);
    const lng = Number(rawLng);
    if (
      !rawLat ||
      !rawLng ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      res.status(400).json({
        error: 'Valid numeric "lat" (-90..90) and "lng" (-180..180) query parameters are required.',
      });
      return;
    }

    const rawStationId = typeof req.query.stationId === 'string' ? req.query.stationId.trim() : '';
    const stationId = /^[a-zA-Z0-9_-]{2,64}$/.test(rawStationId)
      ? rawStationId
      : 'current-location';

    const forceRefresh = req.query.refresh === '1';
    const station = await getStationByCoordinates(lat, lng, {
      id: stationId,
      forceRefresh,
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
    const stationId = req.params.stationId;
    if (!stationId || !/^[a-zA-Z0-9_-]{2,64}$/.test(stationId)) {
      res.status(400).json({ error: 'Invalid stationId parameter.' });
      return;
    }
    const forceRefresh = req.query.refresh === '1';
    const station = await getStationById(stationId, forceRefresh);
    if (!station) {
      res.status(404).json({ error: `Station '${stationId}' was not found.` });
      return;
    }
    res.json({ station });
  } catch (error) {
    next(error);
  }
});
