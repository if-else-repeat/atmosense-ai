/**
 * @module airQualityService
 * Station orchestrator fusing multi-source AQIService telemetry, Open-Meteo forecasts,
 * live meteorology, and reverse geocoding with 5-minute TTL caching.
 */

import { aqiService } from './aqiService.ts';
import type { AirQualityStation, PollutantMetrics } from '../types/airQuality.ts';
import {
  classifyAqi,
  computeCompositeAqi,
  computeWhoRatio,
  findBestOutdoorWindow,
} from '../utils/aqi.ts';
import {
  URBAN_STATIONS,
  buildHourlySeries,
  hydrateStation,
  type StationSeed,
} from './airQuality/catalog.ts';
import {
  detectLocationByIp,
  reverseGeocodeCoordinates,
  type ReverseGeocodedPlace,
} from './airQuality/geolocation.ts';
import {
  fetchLiveMetrics,
  fetchLiveMetricsWithForecast,
  fetchLiveWeather,
} from './airQuality/openMeteo.ts';

export { detectLocationByIp, reverseGeocodeCoordinates };
export type { ReverseGeocodedPlace };

interface CachedStations {
  stations: AirQualityStation[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let stationCache: CachedStations | null = null;
const dynamicStationCache = new Map<string, { station: AirQualityStation; fetchedAt: number }>();

/** Fetches live air quality, 24h forecast, weather, and reverse-geocoded place name for coordinates. */
export async function getStationByCoordinates(
  latitude: number,
  longitude: number,
  options: {
    id?: string;
    placeHint?: Partial<ReverseGeocodedPlace>;
    forceRefresh?: boolean;
  } = {},
): Promise<AirQualityStation> {
  const id = options.id ?? 'current-location';
  const cacheKey = `${id}:${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  const cached = dynamicStationCache.get(cacheKey);
  if (!options.forceRefresh && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    dynamicStationCache.set(id, cached);
    return cached.station;
  }

  const fallbackMetrics: PollutantMetrics = {
    pm25: 14.5,
    pm10: 29.0,
    no2: 24.0,
    o3: 58.0,
    so2: 4.5,
    co: 320,
  };

  const [multiSource, aqResult, weatherResult, geocoded] = await Promise.all([
    aqiService.getCurrentAQI(latitude, longitude).catch(() => null),
    fetchLiveMetricsWithForecast(latitude, longitude, fallbackMetrics),
    fetchLiveWeather(latitude, longitude),
    options.placeHint?.city && options.placeHint?.country
      ? Promise.resolve({
          city: options.placeHint.city,
          country: options.placeHint.country,
          district: options.placeHint.district || 'Current Location',
        })
      : reverseGeocodeCoordinates(latitude, longitude),
  ]);

  const metrics: PollutantMetrics = multiSource
    ? {
        pm25: Math.round(Math.max(0, multiSource.pm25) * 10) / 10,
        pm10: Math.round(Math.max(0, multiSource.pm10) * 10) / 10,
        no2: Math.round(Math.max(0, multiSource.no2 * 1.88) * 10) / 10,
        o3: Math.round(Math.max(0, multiSource.o3 * 1960) * 10) / 10,
        so2: Math.round(Math.max(0, multiSource.so2 * 2.62) * 10) / 10,
        co: Math.round(Math.max(0, multiSource.co * 1000)),
      }
    : (aqResult?.metrics ?? fallbackMetrics);

  const seed: StationSeed = {
    id,
    city: geocoded.city,
    country: geocoded.country,
    district: geocoded.district,
    latitude: Math.round(latitude * 10000) / 10000,
    longitude: Math.round(longitude * 10000) / 10000,
    baseMetrics: metrics,
    temperatureC: weatherResult?.temperatureC ?? 22.0,
    humidityPct: weatherResult?.humidityPct ?? 55,
    windKph: weatherResult?.windKph ?? 10.5,
  };

  const composite = computeCompositeAqi(metrics);
  const aqi =
    multiSource && Number.isFinite(multiSource.aqi) && multiSource.aqi >= 0
      ? Math.round(multiSource.aqi)
      : composite.aqi;
  const hourly =
    aqResult?.hourly && aqResult.hourly.length >= 12
      ? aqResult.hourly
      : buildHourlySeries(seed, metrics);

  const station: AirQualityStation = {
    id: seed.id,
    city: seed.city,
    country: seed.country,
    district: seed.district,
    latitude: seed.latitude,
    longitude: seed.longitude,
    aqi,
    category: classifyAqi(aqi),
    dominantPollutant: composite.dominantPollutant,
    whoPm25Ratio: computeWhoRatio(metrics.pm25),
    metrics,
    temperatureC: seed.temperatureC,
    humidityPct: seed.humidityPct,
    windKph: seed.windKph,
    hourly,
    bestOutdoorWindow: findBestOutdoorWindow(hourly),
    source: multiSource || aqResult ? 'live-open-meteo' : 'calibrated-baseline',
    updatedAt: new Date().toISOString(),
  };

  const entry = { station, fetchedAt: Date.now() };
  dynamicStationCache.set(cacheKey, entry);
  dynamicStationCache.set(id, entry);
  return station;
}

/** Returns all curated global monitoring stations enriched with live Open-Meteo readings. */
export async function getAllStations(forceRefresh = false): Promise<AirQualityStation[]> {
  if (!forceRefresh && stationCache && Date.now() - stationCache.fetchedAt < CACHE_TTL_MS) {
    return stationCache.stations;
  }

  const results = await Promise.all(
    URBAN_STATIONS.map(async (seed) => {
      const live = await fetchLiveMetrics(seed);
      return hydrateStation(
        seed,
        live ?? seed.baseMetrics,
        live ? 'live-open-meteo' : 'calibrated-baseline',
      );
    }),
  );

  stationCache = { stations: results, fetchedAt: Date.now() };
  return results;
}

/** Looks up a dynamic or curated monitoring station by ID. */
export async function getStationById(
  stationId: string,
  forceRefresh = false,
): Promise<AirQualityStation | null> {
  const dynamic = dynamicStationCache.get(stationId);
  if (dynamic) {
    if (!forceRefresh && Date.now() - dynamic.fetchedAt < CACHE_TTL_MS) {
      return dynamic.station;
    }
    return getStationByCoordinates(dynamic.station.latitude, dynamic.station.longitude, {
      id: stationId,
      forceRefresh,
    });
  }

  const stations = await getAllStations(forceRefresh);
  return stations.find((station) => station.id === stationId) ?? null;
}
