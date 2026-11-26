/**
 * @module aqiForecastParsers
 * Forecast payload normalizers for WAQI daily forecasts and OpenWeather hourly forecasts.
 */

import { calculateAQI, getAQIColor } from '../../../lib/aqiEngine.ts';
import type { OpenWeatherResponse, WAQIResponse } from './parsers.ts';
import type { ForecastData } from './types.ts';
import {
  OPENWEATHER_AQI_SCALE_MAP,
  SOURCE_RELIABILITY,
  classifyAQILabel,
  roundTo,
  safeNonNegative,
} from './utils.ts';

/** Parses daily WAQI forecast data into {@link ForecastData} array. */
export function parseWAQIForecast(
  payload: WAQIResponse | null,
  now: () => number,
): ForecastData[] | null {
  const daily = payload?.data?.forecast?.daily;
  if (!daily) return null;

  const pm10ByDay = new Map((daily.pm10 ?? []).map((item) => [item.day ?? '', item.avg ?? 0]));
  const o3ByDay = new Map((daily.o3 ?? []).map((item) => [item.day ?? '', item.avg ?? 0]));
  const forecast: ForecastData[] = [];

  for (const dayItem of daily.pm25 ?? []) {
    if (
      !dayItem.day ||
      typeof dayItem.avg !== 'number' ||
      !Number.isFinite(dayItem.avg) ||
      dayItem.avg < 0
    ) {
      continue;
    }
    const pm25 = roundTo(dayItem.avg, 2);
    const pm10 = roundTo(safeNonNegative(pm10ByDay.get(dayItem.day), 0), 2);
    const rawO3 = safeNonNegative(o3ByDay.get(dayItem.day), 0);
    const o3 = rawO3 > 1 ? roundTo(rawO3 / 1000, 4) : roundTo(rawO3, 4);
    const aqiResult = calculateAQI({ pm25, pm10, o3 });
    const parsedDate = Date.parse(`${dayItem.day}T12:00:00Z`);

    forecast.push({
      timestamp: Number.isFinite(parsedDate) ? parsedDate : now(),
      date: dayItem.day,
      aqi: aqiResult.aqi,
      category: aqiResult.category,
      color: aqiResult.color,
      pm25,
      pm10,
      no2: 0,
      co: 0,
      o3,
      so2: 0,
      source: 'WAQI',
      confidence: roundTo(SOURCE_RELIABILITY.WAQI * 0.9, 2),
    });
  }

  return forecast.length > 0 ? forecast : null;
}

/** Parses hourly OpenWeather forecast data into {@link ForecastData} array. */
export function parseOpenWeatherForecast(
  payload: OpenWeatherResponse | null,
): ForecastData[] | null {
  if (!payload?.list || payload.list.length === 0) return null;

  const forecast: ForecastData[] = [];
  for (const item of payload.list.slice(0, 48)) {
    if (typeof item.dt !== 'number' || !Number.isFinite(item.dt)) continue;
    const c = item.components;
    const pm25 = roundTo(safeNonNegative(c?.pm2_5, 0), 2);
    const pm10 = roundTo(safeNonNegative(c?.pm10, 0), 2);
    const no2 = roundTo(safeNonNegative(c?.no2, 0) / 1.88, 2);
    const co = roundTo(safeNonNegative(c?.co, 0) / 1000, 3);
    const o3 = roundTo(safeNonNegative(c?.o3, 0) / 1960, 4);
    const so2 = roundTo(safeNonNegative(c?.so2, 0) / 2.62, 2);

    const aqi = c
      ? calculateAQI({ pm25, pm10, no2, co, o3 }).aqi
      : (OPENWEATHER_AQI_SCALE_MAP[item.main?.aqi ?? 2] ?? 75);

    const timestamp = item.dt * 1000;
    forecast.push({
      timestamp,
      date: new Date(timestamp).toISOString(),
      aqi,
      category: classifyAQILabel(aqi),
      color: getAQIColor(aqi),
      pm25,
      pm10,
      no2,
      co,
      o3,
      so2,
      source: 'OpenWeather',
      confidence: roundTo(SOURCE_RELIABILITY.OpenWeather * 0.9, 2),
    });
  }

  return forecast.length > 0 ? forecast : null;
}
