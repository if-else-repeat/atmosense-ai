/**
 * @module aqiParsers
 * Upstream payload interfaces and pure normalization parsers for WAQI, OpenAQ, and OpenWeather.
 */

import { calculateAQI, type PollutantReadings } from '../../../lib/aqiEngine.ts';
import type { AirQualityData } from './types.ts';
import {
  OPENWEATHER_AQI_SCALE_MAP,
  SOURCE_RELIABILITY,
  normalizeOpenAQUnit,
  roundTo,
  safeNonNegative,
  validateAirQualityReading,
} from './utils.ts';

export interface WAQIResponse {
  status?: string;
  data?: {
    aqi?: number | string;
    city?: { geo?: [number, number]; name?: string };
    time?: { v?: number; iso?: string };
    iaqi?: Record<string, { v?: number }>;
    forecast?: {
      daily?: {
        pm25?: Array<{ avg?: number; day?: string; max?: number; min?: number }>;
        pm10?: Array<{ avg?: number; day?: string; max?: number; min?: number }>;
        o3?: Array<{ avg?: number; day?: string; max?: number; min?: number }>;
      };
    };
  };
}

export interface OpenAQResponse {
  results?: Array<{
    location?: string;
    city?: string;
    coordinates?: { latitude?: number; longitude?: number };
    measurements?: Array<{
      parameter?: string;
      value?: number;
      unit?: string;
      lastUpdated?: string;
    }>;
  }>;
}

export interface OpenWeatherResponse {
  coord?: { lat?: number; lon?: number };
  list?: Array<{
    dt?: number;
    main?: { aqi?: number };
    components?: {
      co?: number;
      no2?: number;
      o3?: number;
      so2?: number;
      pm2_5?: number;
      pm10?: number;
    };
  }>;
}

/** Parses and validates a WAQI geo-feed response into canonical {@link AirQualityData}. */
export function parseWAQIReading(
  payload: WAQIResponse | null,
  lat: number,
  lng: number,
  now: () => number,
): AirQualityData | null {
  if (!payload || payload.status !== 'ok' || !payload.data) return null;

  const { data } = payload;
  const iaqi = data.iaqi ?? {};
  const pm25 = safeNonNegative(iaqi.pm25?.v, 0);
  const pm10 = safeNonNegative(iaqi.pm10?.v, 0);
  const no2 = safeNonNegative(iaqi.no2?.v, 0);
  const co = safeNonNegative(iaqi.co?.v, 0);
  const rawO3 = safeNonNegative(iaqi.o3?.v, 0);
  const o3 = rawO3 > 1 ? roundTo(rawO3 / 1000, 4) : rawO3;
  const so2 = safeNonNegative(iaqi.so2?.v, 0);

  let aqi: number;
  if (typeof data.aqi === 'number' && Number.isFinite(data.aqi) && data.aqi >= 0) {
    aqi = Math.min(500, Math.round(data.aqi));
  } else {
    const readings: PollutantReadings = {};
    if (iaqi.pm25?.v !== undefined) readings.pm25 = pm25;
    if (iaqi.pm10?.v !== undefined) readings.pm10 = pm10;
    if (iaqi.no2?.v !== undefined) readings.no2 = no2;
    if (iaqi.co?.v !== undefined) readings.co = co;
    if (iaqi.o3?.v !== undefined) readings.o3 = o3;
    if (Object.keys(readings).length === 0) return null;
    aqi = calculateAQI(readings).aqi;
  }

  const geoLat = data.city?.geo?.[0];
  const geoLng = data.city?.geo?.[1];
  const parsedTime = data.time?.v
    ? data.time.v * 1000
    : data.time?.iso
      ? Date.parse(data.time.iso)
      : now();

  const reading: AirQualityData = {
    aqi,
    pm25: roundTo(pm25, 2),
    pm10: roundTo(pm10, 2),
    no2: roundTo(no2, 2),
    co: roundTo(co, 3),
    o3: roundTo(o3, 4),
    so2: roundTo(so2, 2),
    source: 'WAQI',
    timestamp: Number.isFinite(parsedTime) ? parsedTime : now(),
    location: {
      lat: typeof geoLat === 'number' && Number.isFinite(geoLat) ? geoLat : lat,
      lng: typeof geoLng === 'number' && Number.isFinite(geoLng) ? geoLng : lng,
      name: data.city?.name?.trim() || `${lat.toFixed(3)}, ${lng.toFixed(3)}`,
    },
    confidence: SOURCE_RELIABILITY.WAQI,
  };

  return validateAirQualityReading(reading) ? reading : null;
}

/** Parses and validates an OpenAQ latest-measurements payload into canonical {@link AirQualityData}. */
export function parseOpenAQReading(
  payload: OpenAQResponse | null,
  lat: number,
  lng: number,
  now: () => number,
): AirQualityData | null {
  const station = payload?.results?.find(
    (item) => Array.isArray(item.measurements) && item.measurements.length > 0,
  );
  if (!station?.measurements) return null;

  const values: Partial<Record<'pm25' | 'pm10' | 'no2' | 'co' | 'o3' | 'so2', number>> = {};
  let latestTimestamp = 0;

  for (const m of station.measurements) {
    if (!m.parameter || typeof m.value !== 'number' || !Number.isFinite(m.value) || m.value < 0) {
      continue;
    }
    const param = m.parameter.toLowerCase();
    if (
      param === 'pm25' ||
      param === 'pm10' ||
      param === 'no2' ||
      param === 'co' ||
      param === 'o3' ||
      param === 'so2'
    ) {
      const normalized = normalizeOpenAQUnit(param, m.value, m.unit ?? '');
      if (Number.isFinite(normalized) && normalized >= 0) {
        values[param] = normalized;
      }
    }
    if (m.lastUpdated) {
      const parsed = Date.parse(m.lastUpdated);
      if (Number.isFinite(parsed) && parsed > latestTimestamp) latestTimestamp = parsed;
    }
  }

  const aqiInput: PollutantReadings = {};
  if (values.pm25 !== undefined) aqiInput.pm25 = values.pm25;
  if (values.pm10 !== undefined) aqiInput.pm10 = values.pm10;
  if (values.no2 !== undefined) aqiInput.no2 = values.no2;
  if (values.co !== undefined) aqiInput.co = values.co;
  if (values.o3 !== undefined) aqiInput.o3 = values.o3;
  if (Object.keys(aqiInput).length === 0) return null;

  const computed = calculateAQI(aqiInput);
  const stationName =
    [station.location, station.city].filter(Boolean).join(', ') ||
    `${lat.toFixed(3)}, ${lng.toFixed(3)}`;

  const reading: AirQualityData = {
    aqi: computed.aqi,
    pm25: roundTo(values.pm25 ?? 0, 2),
    pm10: roundTo(values.pm10 ?? 0, 2),
    no2: roundTo(values.no2 ?? 0, 2),
    co: roundTo(values.co ?? 0, 3),
    o3: roundTo(values.o3 ?? 0, 4),
    so2: roundTo(values.so2 ?? 0, 2),
    source: 'OpenAQ',
    timestamp: latestTimestamp > 0 ? latestTimestamp : now(),
    location: {
      lat:
        typeof station.coordinates?.latitude === 'number' &&
        Number.isFinite(station.coordinates.latitude)
          ? station.coordinates.latitude
          : lat,
      lng:
        typeof station.coordinates?.longitude === 'number' &&
        Number.isFinite(station.coordinates.longitude)
          ? station.coordinates.longitude
          : lng,
      name: stationName,
    },
    confidence: SOURCE_RELIABILITY.OpenAQ,
  };

  return validateAirQualityReading(reading) ? reading : null;
}

/** Parses and validates an OpenWeather Air Pollution payload into canonical {@link AirQualityData}. */
export function parseOpenWeatherReading(
  payload: OpenWeatherResponse | null,
  lat: number,
  lng: number,
  now: () => number,
): AirQualityData | null {
  const entry = payload?.list?.[0];
  if (!entry) return null;

  const c = entry.components;
  const pm25 = safeNonNegative(c?.pm2_5, 0);
  const pm10 = safeNonNegative(c?.pm10, 0);
  const no2 = safeNonNegative(c?.no2, 0) / 1.88;
  const co = safeNonNegative(c?.co, 0) / 1000;
  const o3 = safeNonNegative(c?.o3, 0) / 1960;
  const so2 = safeNonNegative(c?.so2, 0) / 2.62;

  let aqi: number;
  if (
    c &&
    (c.pm2_5 !== undefined ||
      c.pm10 !== undefined ||
      c.no2 !== undefined ||
      c.o3 !== undefined ||
      c.co !== undefined)
  ) {
    const readings: PollutantReadings = {};
    if (c.pm2_5 !== undefined && c.pm2_5 >= 0) readings.pm25 = pm25;
    if (c.pm10 !== undefined && c.pm10 >= 0) readings.pm10 = pm10;
    if (c.no2 !== undefined && c.no2 >= 0) readings.no2 = no2;
    if (c.co !== undefined && c.co >= 0) readings.co = co;
    if (c.o3 !== undefined && c.o3 >= 0) readings.o3 = o3;
    aqi =
      Object.keys(readings).length > 0
        ? calculateAQI(readings).aqi
        : (OPENWEATHER_AQI_SCALE_MAP[entry.main?.aqi ?? 2] ?? 75);
  } else if (
    entry.main?.aqi !== undefined &&
    OPENWEATHER_AQI_SCALE_MAP[entry.main.aqi] !== undefined
  ) {
    aqi = OPENWEATHER_AQI_SCALE_MAP[entry.main.aqi] ?? 75;
  } else {
    return null;
  }

  const reading: AirQualityData = {
    aqi,
    pm25: roundTo(pm25, 2),
    pm10: roundTo(pm10, 2),
    no2: roundTo(no2, 2),
    co: roundTo(co, 3),
    o3: roundTo(o3, 4),
    so2: roundTo(so2, 2),
    source: 'OpenWeather',
    timestamp: typeof entry.dt === 'number' && Number.isFinite(entry.dt) ? entry.dt * 1000 : now(),
    location: {
      lat: typeof payload?.coord?.lat === 'number' ? payload.coord.lat : lat,
      lng: typeof payload?.coord?.lon === 'number' ? payload.coord.lon : lng,
      name: `${lat.toFixed(3)}, ${lng.toFixed(3)}`,
    },
    confidence: SOURCE_RELIABILITY.OpenWeather,
  };

  return validateAirQualityReading(reading) ? reading : null;
}
