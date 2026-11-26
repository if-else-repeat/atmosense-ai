/**
 * @module aqiSnapshotHelpers
 * Local snapshot persistence, diurnal forecast synthesis, and station-to-dashboard mappers.
 */

import type { AQIDashboardData, ForecastHourlyPoint } from '../types/aqi';
import type { AirQualityStation } from '../types/airQuality';
import { buildPollutantMetricCards, getAQIStatusPresentation } from '../utils/dashboardAqi';

const CACHE_STORAGE_PREFIX = 'atmosense:aqi-dashboard:v1:';

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
    const dt = new Date(now.getTime() + offset * 3_600_000);
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
