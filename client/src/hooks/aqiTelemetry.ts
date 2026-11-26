/**
 * @module aqiTelemetry
 * Local snapshot persistence, diurnal forecast synthesis, and multi-endpoint AQI fetchers.
 */

import type { AQIDashboardData, ForecastHourlyPoint, PersonaProfile } from '../types/aqi';
import type { AirQualityStation } from '../types/airQuality';
import { buildPollutantMetricCards, getAQIStatusPresentation } from '../utils/dashboardAqi';

const CACHE_STORAGE_PREFIX = 'atmosense:aqi-dashboard:v1:';

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
    location: { lat: number; lng: number; name: string };
    confidence: number;
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

export function getCacheKey(lat: number, lng: number): string {
  return `${CACHE_STORAGE_PREFIX}${lat.toFixed(2)},${lng.toFixed(2)}`;
}

export function readLocalSnapshot(key: string): AQIDashboardData | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AQIDashboardData;
    if (parsed && typeof parsed.aqi === 'number' && Array.isArray(parsed.pollutants)) return parsed;
  } catch {
    // Ignore storage read errors in restricted contexts
  }
  return null;
}

export function writeLocalSnapshot(key: string, value: AQIDashboardData): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota or storage restriction errors
  }
}

export function synthesize24hForecast(
  baseAqi: number,
  basePm25: number,
  basePm10: number,
  baseNo2: number,
  baseO3: number,
  baseCo: number,
): ForecastHourlyPoint[] {
  const now = new Date();
  return Array.from({ length: 24 }, (_, offset) => {
    const dt = new Date(now.getTime() + offset * 60 * 60 * 1000);
    const hour = dt.getHours();
    const mult =
      hour >= 6 && hour <= 9
        ? 1.16
        : hour >= 11 && hour <= 16
          ? 0.82
          : hour >= 17 && hour <= 20
            ? 1.2
            : 0.96;

    return {
      hourLabel: `${String(hour).padStart(2, '0')}:00`,
      isoTime: dt.toISOString(),
      aqi: Math.max(5, Math.min(500, Math.round(baseAqi * mult))),
      pm25: Number(Math.max(1, basePm25 * mult).toFixed(1)),
      pm10: Number(Math.max(2, basePm10 * mult).toFixed(1)),
      no2: Number(Math.max(1, baseNo2 * mult).toFixed(1)),
      o3: Number(Math.max(0.005, baseO3 * (hour >= 12 && hour <= 16 ? 1.18 : 0.92)).toFixed(3)),
      co: Number(Math.max(0.1, baseCo * mult).toFixed(2)),
    };
  });
}

export function mapStationToDashboardData(station: AirQualityStation): AQIDashboardData {
  const { pm25, pm10 } = station.metrics;
  const no2 = Number((station.metrics.no2 / 1.88).toFixed(1));
  const co = Number((station.metrics.co / 1000).toFixed(2));
  const o3 = Number((station.metrics.o3 / 1960).toFixed(3));
  const so2 = Number((station.metrics.so2 / 2.62).toFixed(1));

  const forecast: ForecastHourlyPoint[] =
    station.hourly.length >= 12
      ? station.hourly.slice(0, 24).map((pt) => ({
          hourLabel: pt.hourLabel,
          isoTime: pt.isoTime,
          aqi: pt.aqi,
          pm25: pt.pm25,
          pm10: pt.pm10,
          no2: Number((pt.no2 / 1.88).toFixed(1)),
          o3: Number((pt.o3 / 1960).toFixed(3)),
          co,
        }))
      : synthesize24hForecast(station.aqi, pm25, pm10, no2, o3, co);

  const parsedTime = Date.parse(station.updatedAt);
  return {
    aqi: station.aqi,
    category: getAQIStatusPresentation(station.aqi).category,
    dominantPollutant: station.dominantPollutant,
    pm25,
    pm10,
    no2,
    co,
    o3,
    so2,
    temperatureC: station.temperatureC,
    humidityPct: station.humidityPct,
    windKph: station.windKph,
    location: {
      lat: station.latitude,
      lng: station.longitude,
      name: `${station.city}, ${station.country}`,
      district: station.district,
    },
    source: station.source === 'live-open-meteo' ? 'Open-Meteo' : 'AtmoSense Baseline',
    confidence: station.source === 'live-open-meteo' ? 0.9 : 0.78,
    updatedAt: Number.isFinite(parsedTime) ? parsedTime : Date.now(),
    forecast,
    pollutants: buildPollutantMetricCards({ pm25, pm10, no2, co, o3 }, forecast),
  };
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
    try {
      const q = new URLSearchParams({
        lat: String(lat),
        lng: String(lng),
        stationId: 'current-location',
      });
      if (isManualRefresh) q.set('refresh', '1');
      const byCoordsRes = await fetch(`/api/air-quality/by-coords?${q.toString()}`, { signal });
      if (byCoordsRes.ok) {
        const { station } = (await byCoordsRes.json()) as { station?: AirQualityStation };
        if (station && typeof station.aqi === 'number') {
          const mapped = mapStationToDashboardData(station);
          return {
            ...mapped,
            location: {
              ...mapped.location,
              name: locationName || mapped.location.name,
              district: district || mapped.location.district,
            },
          };
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
    }
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
