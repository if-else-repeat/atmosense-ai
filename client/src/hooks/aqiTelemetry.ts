/**
 * @module aqiTelemetry
 * Local snapshot persistence, diurnal forecast synthesis, and multi-endpoint AQI fetchers.
 */

import type { AQIDashboardData, ForecastHourlyPoint, PersonaProfile } from '../types/aqi';
import type { AirQualityStation } from '../types/airQuality';
import { buildPollutantMetricCards, getAQIStatusPresentation } from '../utils/dashboardAqi';
import {
  getCacheKey,
  mapStationToDashboardData,
  readLocalSnapshot,
  synthesize24hForecast,
  writeLocalSnapshot,
} from './aqiSnapshotHelpers';

export {
  getCacheKey,
  mapStationToDashboardData,
  readLocalSnapshot,
  synthesize24hForecast,
  writeLocalSnapshot,
};

interface MultiSourceCurrentResponse {
  data?: {
    aqi: number;
    pm25: number;
    pm10: number;
    no2: number;
    co: number;
    o3: number;
    so2: number;
    source: string;
    timestamp: number;
    confidence: number;
    location: { lat: number; lng: number; name: string };
  };
}

interface MultiSourceForecastResponse {
  forecast?: Array<{
    timestamp: number;
    date: string;
    aqi: number;
    pm25: number;
    pm10: number;
    no2: number;
    co: number;
    o3: number;
  }>;
}

export interface TelemetryFetchParams {
  lat: number;
  lng: number;
  locationName?: string;
  district?: string;
  persona: PersonaProfile;
  stationId?: string;
  isManualRefresh: boolean;
  weatherTemp?: number;
  weatherHumidity?: number;
  weatherWind?: number;
  signal: AbortSignal;
}

async function fetchHourlyForecast(
  forecastUrl: string,
  signal: AbortSignal,
): Promise<ForecastHourlyPoint[]> {
  try {
    const res = await fetch(forecastUrl, { signal });
    if (!res.ok) return [];
    const json = (await res.json()) as MultiSourceForecastResponse;
    if (!Array.isArray(json.forecast) || json.forecast.length < 12) return [];
    const intervalHours =
      Math.abs((json.forecast[1]?.timestamp ?? 0) - (json.forecast[0]?.timestamp ?? 0)) / 3_600_000;
    if (intervalHours <= 0 || intervalHours > 3.5) return [];
    return json.forecast.slice(0, 24).map((pt) => ({
      hourLabel: `${String(new Date(pt.timestamp).getHours()).padStart(2, '0')}:00`,
      isoTime: pt.date,
      aqi: pt.aqi,
      pm25: pt.pm25,
      pm10: pt.pm10,
      no2: pt.no2,
      o3: pt.o3,
      co: pt.co,
    }));
  } catch {
    return [];
  }
}

async function fetchStationByCoordsFallback(
  params: TelemetryFetchParams,
): Promise<AQIDashboardData | null> {
  try {
    const q = new URLSearchParams({
      lat: String(params.lat),
      lng: String(params.lng),
      stationId: 'current-location',
    });
    if (params.isManualRefresh) q.set('refresh', '1');
    const res = await fetch(`/api/air-quality/by-coords?${q.toString()}`, {
      signal: params.signal,
    });
    if (!res.ok) return null;
    const { station } = (await res.json()) as { station?: AirQualityStation };
    if (!station || typeof station.aqi !== 'number') return null;
    const mapped = mapStationToDashboardData(station);
    return {
      ...mapped,
      location: {
        ...mapped.location,
        name: params.locationName || mapped.location.name,
        district: params.district || mapped.location.district,
      },
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    return null;
  }
}

/** Fetches live telemetry across primary multi-source, coordinate, and station-list fallbacks. */
export async function fetchDashboardTelemetry(
  params: TelemetryFetchParams,
): Promise<AQIDashboardData> {
  const { lat, lng, locationName, district, persona, stationId, isManualRefresh, signal } = params;
  const currentUrl = `/api/aqi/current?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&persona=${encodeURIComponent(persona)}`;
  const forecastUrl = `/api/aqi/forecast?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`;
  const currentRes = await fetch(currentUrl, { signal });

  if (currentRes.ok) {
    const { data: d } = (await currentRes.json()) as MultiSourceCurrentResponse;
    if (d) {
      const liveForecast = await fetchHourlyForecast(forecastUrl, signal);
      const forecast =
        liveForecast.length >= 12
          ? liveForecast
          : synthesize24hForecast(d.aqi, d.pm25, d.pm10, d.no2, d.o3, d.co);

      return {
        aqi: d.aqi,
        category: getAQIStatusPresentation(d.aqi).category,
        dominantPollutant: d.pm25 >= d.pm10 * 0.45 ? 'PM2.5' : 'PM10',
        pm25: d.pm25,
        pm10: d.pm10,
        no2: d.no2,
        co: d.co,
        o3: d.o3,
        so2: d.so2,
        temperatureC: params.weatherTemp ?? 24,
        humidityPct: params.weatherHumidity ?? 58,
        windKph: params.weatherWind ?? 9,
        location: {
          lat: d.location.lat,
          lng: d.location.lng,
          name: locationName || d.location.name,
          district,
        },
        source: d.source,
        confidence: d.confidence,
        updatedAt: d.timestamp || Date.now(),
        forecast,
        pollutants: buildPollutantMetricCards(
          { pm25: d.pm25, pm10: d.pm10, no2: d.no2, co: d.co, o3: d.o3 },
          forecast,
        ),
      };
    }
  }

  if (stationId === 'current-location') {
    const byCoords = await fetchStationByCoordsFallback(params);
    if (byCoords) return byCoords;
  }

  const stationsRes = await fetch(`/api/air-quality${isManualRefresh ? '?refresh=1' : ''}`, {
    signal,
  });
  if (!stationsRes.ok) throw new Error(`Air quality telemetry returned HTTP ${stationsRes.status}`);
  const { stations = [] } = (await stationsRes.json()) as { stations?: AirQualityStation[] };
  if (stations.length === 0) throw new Error('No monitoring stations available in telemetry feed.');

  const matched =
    (stationId ? stations.find((st) => st.id === stationId) : undefined) ??
    stations.reduce((best, cur) =>
      Math.hypot(cur.latitude - lat, cur.longitude - lng) <
      Math.hypot(best.latitude - lat, best.longitude - lng)
        ? cur
        : best,
    );

  return mapStationToDashboardData(matched);
}
