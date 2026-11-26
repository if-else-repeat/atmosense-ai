/**
 * @module airQualityOpenMeteo
 * Open-Meteo live air quality, 24-hour forecast, and meteorology fetchers.
 */

import type { HourlyPoint, PollutantMetrics } from '../../types/airQuality.ts';
import { computeCompositeAqi } from '../../utils/aqi.ts';
import type { StationSeed } from './catalog.ts';
import { fetchJsonWithTimeout } from './geolocation.ts';

interface OpenMeteoCurrent {
  pm2_5?: number;
  pm10?: number;
  nitrogen_dioxide?: number;
  ozone?: number;
  sulphur_dioxide?: number;
  carbon_monoxide?: number;
}

interface OpenMeteoHourly {
  time?: string[];
  pm2_5?: Array<number | null>;
  pm10?: Array<number | null>;
  nitrogen_dioxide?: Array<number | null>;
  ozone?: Array<number | null>;
}

interface OpenMeteoResponse {
  current?: OpenMeteoCurrent;
  hourly?: OpenMeteoHourly;
}

interface OpenMeteoWeatherResponse {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
  };
}

export async function fetchLiveMetricsWithForecast(
  latitude: number,
  longitude: number,
  fallbackMetrics: PollutantMetrics,
): Promise<{ metrics: PollutantMetrics; hourly: HourlyPoint[] } | null> {
  const endpoint =
    process.env.OPEN_METEO_AQ_URL ?? 'https://air-quality-api.open-meteo.com/v1/air-quality';
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    current: 'pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide',
    hourly: 'pm2_5,pm10,nitrogen_dioxide,ozone',
    forecast_hours: '24',
    timezone: 'auto',
  });

  const payload = await fetchJsonWithTimeout<OpenMeteoResponse>(
    `${endpoint}?${params.toString()}`,
    3200,
  );
  const cur = payload?.current;
  if (!cur || typeof cur.pm2_5 !== 'number' || typeof cur.pm10 !== 'number') {
    return null;
  }

  const metrics: PollutantMetrics = {
    pm25: Math.round(Math.max(0, cur.pm2_5) * 10) / 10,
    pm10: Math.round(Math.max(0, cur.pm10) * 10) / 10,
    no2: Math.round(Math.max(0, cur.nitrogen_dioxide ?? fallbackMetrics.no2) * 10) / 10,
    o3: Math.round(Math.max(0, cur.ozone ?? fallbackMetrics.o3) * 10) / 10,
    so2: Math.round(Math.max(0, cur.sulphur_dioxide ?? fallbackMetrics.so2) * 10) / 10,
    co: Math.round(Math.max(0, cur.carbon_monoxide ?? fallbackMetrics.co)),
  };

  const hourly: HourlyPoint[] = [];
  const h = payload?.hourly;
  if (h?.time && Array.isArray(h.time) && h.time.length >= 12) {
    const count = Math.min(24, h.time.length);
    for (let i = 0; i < count; i += 1) {
      const isoTime = h.time[i] ?? new Date(Date.now() + i * 3_600_000).toISOString();
      const pm25 = Math.round(Math.max(0, h.pm2_5?.[i] ?? metrics.pm25) * 10) / 10;
      const pm10 = Math.round(Math.max(0, h.pm10?.[i] ?? metrics.pm10) * 10) / 10;
      const no2 = Math.round(Math.max(0, h.nitrogen_dioxide?.[i] ?? metrics.no2) * 10) / 10;
      const o3 = Math.round(Math.max(0, h.ozone?.[i] ?? metrics.o3) * 10) / 10;
      const composite = computeCompositeAqi({
        pm25,
        pm10,
        no2,
        o3,
        so2: metrics.so2,
        co: metrics.co,
      });
      const hhMatch = /T(\d{2}:\d{2})/.exec(isoTime);
      hourly.push({
        hourLabel: hhMatch?.[1] ?? `${String(i).padStart(2, '0')}:00`,
        isoTime,
        aqi: composite.aqi,
        pm25,
        pm10,
        no2,
        o3,
      });
    }
  }

  return { metrics, hourly };
}

export async function fetchLiveWeather(
  latitude: number,
  longitude: number,
): Promise<{ temperatureC: number; humidityPct: number; windKph: number } | null> {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    current: 'temperature_2m,relative_humidity_2m,wind_speed_10m',
    timezone: 'auto',
  });
  const payload = await fetchJsonWithTimeout<OpenMeteoWeatherResponse>(
    `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
    2800,
  );
  const cur = payload?.current;
  if (!cur || typeof cur.temperature_2m !== 'number') return null;
  return {
    temperatureC: Math.round(cur.temperature_2m * 10) / 10,
    humidityPct: Math.round(cur.relative_humidity_2m ?? 55),
    windKph: Math.round((cur.wind_speed_10m ?? 10) * 10) / 10,
  };
}

export async function fetchLiveMetrics(seed: StationSeed): Promise<PollutantMetrics | null> {
  const endpoint =
    process.env.OPEN_METEO_AQ_URL ?? 'https://air-quality-api.open-meteo.com/v1/air-quality';
  const params = new URLSearchParams({
    latitude: String(seed.latitude),
    longitude: String(seed.longitude),
    current: 'pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide',
  });

  const payload = await fetchJsonWithTimeout<OpenMeteoResponse>(
    `${endpoint}?${params.toString()}`,
    2200,
  );
  const cur = payload?.current;
  if (!cur || typeof cur.pm2_5 !== 'number' || typeof cur.pm10 !== 'number') return null;
  return {
    pm25: Math.round(Math.max(0, cur.pm2_5) * 10) / 10,
    pm10: Math.round(Math.max(0, cur.pm10) * 10) / 10,
    no2: Math.round(Math.max(0, cur.nitrogen_dioxide ?? seed.baseMetrics.no2) * 10) / 10,
    o3: Math.round(Math.max(0, cur.ozone ?? seed.baseMetrics.o3) * 10) / 10,
    so2: Math.round(Math.max(0, cur.sulphur_dioxide ?? seed.baseMetrics.so2) * 10) / 10,
    co: Math.round(Math.max(0, cur.carbon_monoxide ?? seed.baseMetrics.co)),
  };
}
