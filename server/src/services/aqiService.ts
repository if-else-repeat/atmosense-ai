/**
 * @module aqiService
 * Multi-source live air quality integration layer with automatic fallback,
 * weighted multi-source data fusion, >50% outlier dampening, full data provenance,
 * SHA-256 100-entry 10-minute LRU caching, retry with backoff, and rate-limit compliance.
 *
 * Upstream sources (priority order):
 * 1. PRIMARY: WAQI API — https://api.waqi.info/feed/geo:{lat};{lng}/?token={token}
 * 2. SECONDARY: OpenAQ API — https://api.openaq.org/v2/latest?coordinates={lat},{lng}&radius=10000
 * 3. TERTIARY: OpenWeather Air Pollution — http://api.openweathermap.org/data/2.5/air_pollution?lat={lat}&lon={lng}&appid={key}
 */

import {
  calculateAQI,
  getAQIColor,
  type AQICategoryLabel,
  type PollutantReadings,
} from '../../lib/aqiEngine.ts';
import { logger } from '../utils/logger.ts';
import { createAQICacheKey, LRUCache } from './aqi/cache.ts';
import {
  AQIServiceError,
  type AQILogger,
  type AQIServiceOptions,
  type AQISourceName,
  type AirQualityData,
  type CacheStats,
  type ForecastData,
  type RateLimitConfig,
  type SourceProvenance,
  type SourceStatus,
} from './aqi/types.ts';

export { AQIServiceError, createAQICacheKey, LRUCache };
export type {
  AQILogger,
  AQIServiceOptions,
  AQISourceName,
  AirQualityData,
  CacheStats,
  ForecastData,
  RateLimitConfig,
  SourceProvenance,
  SourceStatus,
};

const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_CACHE_MAX_ENTRIES = 100;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BASE_RETRY_DELAY_MS = 250;
const DEFAULT_REQUEST_TIMEOUT_MS = 6000;
const DEFAULT_OUTLIER_THRESHOLD = 0.5;
const DEFAULT_OUTLIER_WEIGHT_FACTOR = 0.2;

const SOURCE_RELIABILITY: Readonly<Record<AQISourceName, number>> = {
  WAQI: 0.95,
  OpenAQ: 0.85,
  OpenWeather: 0.7,
};

const DEFAULT_RATE_LIMITS: Readonly<Record<AQISourceName, RateLimitConfig>> = {
  WAQI: { maxRequests: 60, windowMs: 60_000 },
  OpenAQ: { maxRequests: 60, windowMs: 60_000 },
  OpenWeather: { maxRequests: 60, windowMs: 60_000 },
};

const OPENWEATHER_AQI_SCALE_MAP: Readonly<Record<number, number>> = {
  1: 25,
  2: 75,
  3: 125,
  4: 175,
  5: 250,
};

const defaultLogger: AQILogger = {
  info: (message, meta) => {
    logger.info(`[AQIService] ${message}`, meta);
  },
  warn: (message, meta) => {
    logger.warn(`[AQIService] ${message}`, meta);
  },
  error: (message, meta) => {
    logger.error(`[AQIService] ${message}`, meta);
  },
};

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Per-provider sliding-window rate limiter with HTTP 429 cooldown tracking.
 */
class SourceRateLimiter {
  private readonly timestamps: number[] = [];
  private blockedUntil: number | null = null;
  private readonly config: RateLimitConfig;
  private readonly now: () => number;

  constructor(config: RateLimitConfig, now: () => number) {
    this.config = config;
    this.now = now;
  }

  /** Attempts to consume one request slot; returns false if rate-limited or cooling down. */
  tryAcquire(): boolean {
    const current = this.now();
    if (this.blockedUntil !== null && current < this.blockedUntil) {
      return false;
    }
    this.blockedUntil = null;
    this.prune(current);

    if (this.timestamps.length >= this.config.maxRequests) {
      return false;
    }

    this.timestamps.push(current);
    return true;
  }

  /** Records an upstream 429 cooldown period in milliseconds. */
  applyCooldown(cooldownMs: number): void {
    const clampedMs = Math.max(1000, Math.min(cooldownMs, 5 * 60_000));
    this.blockedUntil = this.now() + clampedMs;
  }

  /** Returns current rate-limit window status. */
  getStatus(): {
    maxRequests: number;
    windowMs: number;
    remaining: number;
    blockedUntil: number | null;
  } {
    const current = this.now();
    this.prune(current);
    const activeBlockedUntil =
      this.blockedUntil !== null && current < this.blockedUntil ? this.blockedUntil : null;
    return {
      maxRequests: this.config.maxRequests,
      windowMs: this.config.windowMs,
      remaining: Math.max(0, this.config.maxRequests - this.timestamps.length),
      blockedUntil: activeBlockedUntil,
    };
  }

  private prune(current: number): void {
    const cutoff = current - this.config.windowMs;
    while (this.timestamps.length > 0 && (this.timestamps[0] ?? 0) <= cutoff) {
      this.timestamps.shift();
    }
  }
}

/** Redacts secret query parameters (tokens/appids) before logging URLs. */
function redactUrlSecrets(rawUrl: string): string {
  return rawUrl.replace(/([?&](?:token|appid|api_key)=)[^&]+/gi, '$1[REDACTED]');
}

/** Validates latitude and longitude bounds and finiteness. */
function assertValidCoordinates(lat: number, lng: number): void {
  if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new RangeError(
      `lat must be a finite number between -90 and 90; received ${String(lat)}.`,
    );
  }
  if (typeof lng !== 'number' || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new RangeError(
      `lng must be a finite number between -180 and 180; received ${String(lng)}.`,
    );
  }
}

/** Safely extracts a non-negative finite number, returning `fallback` otherwise. */
function safeNonNegative(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value;
  }
  return fallback;
}

/** Rounds a floating-point number to a fixed number of decimal places. */
function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/** Computes the statistical median of a non-empty numeric array. */
function computeMedian(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid] ?? 0;
  }
  const low = sorted[mid - 1] ?? 0;
  const high = sorted[mid] ?? 0;
  return (low + high) / 2;
}

/** Resolves an EPA category label for a numeric AQI value. */
function classifyAQILabel(aqi: number): AQICategoryLabel {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

/** Normalizes an OpenAQ measurement concentration into AQIService's canonical units. */
function normalizeOpenAQUnit(parameter: string, value: number, unit: string): number {
  const normalizedUnit = unit.trim().toLowerCase();
  switch (parameter) {
    case 'pm25':
    case 'pm10':
      // Canonical: µg/m³
      if (normalizedUnit === 'mg/m³' || normalizedUnit === 'mg/m3') {
        return value * 1000;
      }
      return value;
    case 'no2':
      // Canonical: ppb (1 ppb NO2 ≈ 1.88 µg/m³ at 25°C, 1 atm)
      if (normalizedUnit === 'ppm') return value * 1000;
      if (normalizedUnit === 'µg/m³' || normalizedUnit === 'ug/m3') return value / 1.88;
      return value;
    case 'co':
      // Canonical: mg/m³ (1 ppm CO ≈ 1.145 mg/m³ at 25°C, 1 atm)
      if (normalizedUnit === 'µg/m³' || normalizedUnit === 'ug/m3') return value / 1000;
      if (normalizedUnit === 'ppm') return value * 1.145;
      if (normalizedUnit === 'ppb') return (value * 1.145) / 1000;
      return value;
    case 'o3':
      // Canonical: ppm (1 ppm O3 ≈ 1960 µg/m³ at 25°C, 1 atm)
      if (normalizedUnit === 'ppb') return value / 1000;
      if (normalizedUnit === 'µg/m³' || normalizedUnit === 'ug/m3') return value / 1960;
      return value;
    case 'so2':
      // Canonical: ppb (1 ppb SO2 ≈ 2.62 µg/m³ at 25°C, 1 atm)
      if (normalizedUnit === 'ppm') return value * 1000;
      if (normalizedUnit === 'µg/m³' || normalizedUnit === 'ug/m3') return value / 2.62;
      return value;
    default:
      return value;
  }
}

/** Parses an HTTP `Retry-After` header into milliseconds if valid. */
function parseRetryAfterMs(headerValue: string | null): number | null {
  if (!headerValue) return null;
  const seconds = Number(headerValue);
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds * 1000;
  }
  const dateMs = Date.parse(headerValue);
  if (Number.isFinite(dateMs)) {
    const diff = dateMs - Date.now();
    return diff > 0 ? diff : null;
  }
  return null;
}

/** Checks whether a credential string is genuinely configured (not blank or placeholder). */
function isConfiguredSecret(value: string | undefined): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  const upper = trimmed.toUpperCase();
  return !upper.startsWith('YOUR_') && !upper.startsWith('MY_');
}

interface WAQIResponse {
  status?: string;
  data?: {
    aqi?: number | string;
    city?: {
      geo?: [number, number];
      name?: string;
    };
    time?: {
      v?: number;
      iso?: string;
    };
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

interface OpenAQResponse {
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

interface OpenWeatherResponse {
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

/**
 * Multi-source live Air Quality Index service with automatic provider fallback,
 * consensus fusion with >50% outlier dampening, SHA-256 LRU caching, retries, and rate limiting.
 */
export class AQIService {
  private readonly waqiToken?: string;
  private readonly openAqApiKey?: string;
  private readonly openWeatherApiKey?: string;
  private readonly fetchFn: typeof fetch;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly logger: AQILogger;
  private readonly maxRetries: number;
  private readonly baseRetryDelayMs: number;
  private readonly requestTimeoutMs: number;
  private readonly outlierThreshold: number;
  private readonly outlierWeightFactor: number;
  private readonly strategy: 'fuse' | 'fallback';
  private readonly hasCustomFetch: boolean;

  private readonly currentCache: LRUCache<AirQualityData>;
  private readonly forecastCache: LRUCache<ForecastData[]>;
  private readonly rateLimiters: Record<AQISourceName, SourceRateLimiter>;
  private readonly retiredSources = new Set<AQISourceName>();

  constructor(options: AQIServiceOptions = {}) {
    this.waqiToken = options.waqiToken ?? process.env.WAQI_API_TOKEN;
    this.openAqApiKey = options.openAqApiKey ?? process.env.OPENAQ_API_KEY;
    this.openWeatherApiKey = options.openWeatherApiKey ?? process.env.OPENWEATHER_API_KEY;
    this.hasCustomFetch = typeof options.fetchFn === 'function';
    this.fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis);
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? defaultSleep;
    this.logger = options.logger ?? defaultLogger;

    const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    const cacheMaxEntries = options.cacheMaxEntries ?? DEFAULT_CACHE_MAX_ENTRIES;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.baseRetryDelayMs = options.baseRetryDelayMs ?? DEFAULT_BASE_RETRY_DELAY_MS;
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.outlierThreshold = options.outlierThreshold ?? DEFAULT_OUTLIER_THRESHOLD;
    this.outlierWeightFactor = options.outlierWeightFactor ?? DEFAULT_OUTLIER_WEIGHT_FACTOR;
    this.strategy = options.strategy ?? 'fuse';

    this.currentCache = new LRUCache<AirQualityData>(cacheMaxEntries, cacheTtlMs, this.now);
    this.forecastCache = new LRUCache<ForecastData[]>(cacheMaxEntries, cacheTtlMs, this.now);

    this.rateLimiters = {
      WAQI: new SourceRateLimiter(options.rateLimits?.WAQI ?? DEFAULT_RATE_LIMITS.WAQI, this.now),
      OpenAQ: new SourceRateLimiter(
        options.rateLimits?.OpenAQ ?? DEFAULT_RATE_LIMITS.OpenAQ,
        this.now,
      ),
      OpenWeather: new SourceRateLimiter(
        options.rateLimits?.OpenWeather ?? DEFAULT_RATE_LIMITS.OpenWeather,
        this.now,
      ),
    };
  }

  /**
   * Fetches live air quality data for the given coordinates.
   * Checks the 10-minute SHA-256 LRU cache first, then queries upstream providers
   * (WAQI → OpenAQ → OpenWeather) with automatic fallback and multi-source fusion.
   *
   * @param lat - Latitude in degrees `[-90, 90]`.
   * @param lng - Longitude in degrees `[-180, 180]`.
   * @returns Normalized and fused {@link AirQualityData}.
   * @throws {RangeError} When coordinates are out of range or non-finite.
   * @throws {AQIServiceError} When all upstream providers fail or return invalid payloads.
   */
  async getCurrentAQI(lat: number, lng: number): Promise<AirQualityData> {
    assertValidCoordinates(lat, lng);

    const cacheKey = createAQICacheKey('current', lat, lng);
    const cached = this.currentCache.get(cacheKey);
    if (cached) {
      return {
        ...cached,
        location: { ...cached.location },
        provenance: cached.provenance ? cached.provenance.map((p) => ({ ...p })) : undefined,
      };
    }

    const readings: AirQualityData[] = [];

    if (this.strategy === 'fallback') {
      const providers: Array<() => Promise<AirQualityData | null>> = [
        () => this.fetchFromWAQI(lat, lng),
        () => this.fetchFromOpenAQ(lat, lng),
        () => this.fetchFromOpenWeather(lat, lng),
      ];

      for (const provider of providers) {
        const reading = await provider();
        if (reading && this.validateReading(reading)) {
          readings.push(reading);
          break;
        }
      }
    } else {
      const settled = await Promise.allSettled([
        this.fetchFromWAQI(lat, lng),
        this.fetchFromOpenAQ(lat, lng),
        this.fetchFromOpenWeather(lat, lng),
      ]);

      for (const outcome of settled) {
        if (
          outcome.status === 'fulfilled' &&
          outcome.value &&
          this.validateReading(outcome.value)
        ) {
          readings.push(outcome.value);
        }
      }
    }

    if (readings.length === 0) {
      this.logger.error('All upstream air quality sources failed', { lat, lng });
      throw new AQIServiceError(
        'Unable to retrieve live air quality data from WAQI, OpenAQ, or OpenWeather.',
        503,
        { lat, lng, sourcesAttempted: ['WAQI', 'OpenAQ', 'OpenWeather'] },
      );
    }

    const fused = this.fuseData(readings);
    this.currentCache.set(cacheKey, fused);
    return {
      ...fused,
      location: { ...fused.location },
      provenance: fused.provenance ? fused.provenance.map((p) => ({ ...p })) : undefined,
    };
  }

  /**
   * Fetches air quality forecast data for the given coordinates.
   * Uses WAQI daily forecasts as primary and automatically falls back to
   * OpenWeather hourly air pollution forecasts if WAQI is unavailable.
   *
   * @param lat - Latitude in degrees `[-90, 90]`.
   * @param lng - Longitude in degrees `[-180, 180]`.
   * @returns Ordered array of {@link ForecastData} entries.
   * @throws {RangeError} When coordinates are invalid.
   * @throws {AQIServiceError} When all forecast sources fail.
   */
  async getForecast(lat: number, lng: number): Promise<ForecastData[]> {
    assertValidCoordinates(lat, lng);

    const cacheKey = createAQICacheKey('forecast', lat, lng);
    const cached = this.forecastCache.get(cacheKey);
    if (cached) {
      return cached.map((entry) => ({ ...entry }));
    }

    const waqiForecast = await this.fetchForecastFromWAQI(lat, lng);
    if (waqiForecast && waqiForecast.length > 0) {
      this.forecastCache.set(cacheKey, waqiForecast);
      return waqiForecast.map((entry) => ({ ...entry }));
    }

    const openWeatherForecast = await this.fetchForecastFromOpenWeather(lat, lng);
    if (openWeatherForecast && openWeatherForecast.length > 0) {
      this.forecastCache.set(cacheKey, openWeatherForecast);
      return openWeatherForecast.map((entry) => ({ ...entry }));
    }

    this.logger.error('All air quality forecast sources failed', { lat, lng });
    throw new AQIServiceError(
      'Unable to retrieve air quality forecast from WAQI or OpenWeather.',
      503,
      { lat, lng, sourcesAttempted: ['WAQI', 'OpenWeather'] },
    );
  }

  /** Returns cache statistics for both current and forecast LRU caches. */
  getCacheStats(): { current: CacheStats; forecast: CacheStats } {
    return {
      current: this.currentCache.stats(),
      forecast: this.forecastCache.stats(),
    };
  }

  /** Returns sanitized health and rate-limit metadata for all configured sources. */
  getSourceStatuses(): SourceStatus[] {
    return [
      {
        name: 'WAQI',
        priority: 1,
        configured: isConfiguredSecret(this.waqiToken),
        reliability: SOURCE_RELIABILITY.WAQI,
        rateLimit: this.rateLimiters.WAQI.getStatus(),
      },
      {
        name: 'OpenAQ',
        priority: 2,
        configured: !this.retiredSources.has('OpenAQ'),
        reliability: SOURCE_RELIABILITY.OpenAQ,
        rateLimit: this.rateLimiters.OpenAQ.getStatus(),
      },
      {
        name: 'OpenWeather',
        priority: 3,
        configured: isConfiguredSecret(this.openWeatherApiKey),
        reliability: SOURCE_RELIABILITY.OpenWeather,
        rateLimit: this.rateLimiters.OpenWeather.getStatus(),
      },
    ];
  }

  /** Clears both in-memory LRU caches. */
  clearCache(): void {
    this.currentCache.clear();
    this.forecastCache.clear();
  }

  /**
   * PRIMARY source: World Air Quality Index (WAQI) geo feed.
   * Endpoint: `https://api.waqi.info/feed/geo:{lat};{lng}/?token={token}`
   */
  private async fetchFromWAQI(lat: number, lng: number): Promise<AirQualityData | null> {
    if (!isConfiguredSecret(this.waqiToken)) {
      this.logger.warn('Skipping WAQI source: WAQI_API_TOKEN is not configured');
      return null;
    }

    const url = `https://api.waqi.info/feed/geo:${lat};${lng}/?token=${encodeURIComponent(this.waqiToken)}`;
    const payload = await this.fetchJsonWithRetry<WAQIResponse>('WAQI', url);
    if (!payload || payload.status !== 'ok' || !payload.data) {
      return null;
    }

    const { data } = payload;
    const iaqi = data.iaqi ?? {};
    const pm25 = safeNonNegative(iaqi.pm25?.v, 0);
    const pm10 = safeNonNegative(iaqi.pm10?.v, 0);
    const no2 = safeNonNegative(iaqi.no2?.v, 0);
    const co = safeNonNegative(iaqi.co?.v, 0);
    const rawO3 = safeNonNegative(iaqi.o3?.v, 0);
    // WAQI reports O3 as an AQI sub-index or ppb; normalize values > 1 to ppm
    const o3 = rawO3 > 1 ? roundTo(rawO3 / 1000, 4) : rawO3;
    const so2 = safeNonNegative(iaqi.so2?.v, 0);

    let aqi: number;
    if (typeof data.aqi === 'number' && Number.isFinite(data.aqi) && data.aqi >= 0) {
      aqi = Math.min(500, Math.round(data.aqi));
    } else {
      const readingsForCalc: PollutantReadings = {};
      if (iaqi.pm25?.v !== undefined) readingsForCalc.pm25 = pm25;
      if (iaqi.pm10?.v !== undefined) readingsForCalc.pm10 = pm10;
      if (iaqi.no2?.v !== undefined) readingsForCalc.no2 = no2;
      if (iaqi.co?.v !== undefined) readingsForCalc.co = co;
      if (iaqi.o3?.v !== undefined) readingsForCalc.o3 = o3;
      if (Object.keys(readingsForCalc).length === 0) {
        return null;
      }
      aqi = calculateAQI(readingsForCalc).aqi;
    }

    const geoLat = data.city?.geo?.[0];
    const geoLng = data.city?.geo?.[1];
    const parsedTime = data.time?.v
      ? data.time.v * 1000
      : data.time?.iso
        ? Date.parse(data.time.iso)
        : this.now();

    const reading: AirQualityData = {
      aqi,
      pm25: roundTo(pm25, 2),
      pm10: roundTo(pm10, 2),
      no2: roundTo(no2, 2),
      co: roundTo(co, 3),
      o3: roundTo(o3, 4),
      so2: roundTo(so2, 2),
      source: 'WAQI',
      timestamp: Number.isFinite(parsedTime) ? parsedTime : this.now(),
      location: {
        lat: typeof geoLat === 'number' && Number.isFinite(geoLat) ? geoLat : lat,
        lng: typeof geoLng === 'number' && Number.isFinite(geoLng) ? geoLng : lng,
        name: data.city?.name?.trim() || `${lat.toFixed(3)}, ${lng.toFixed(3)}`,
      },
      confidence: SOURCE_RELIABILITY.WAQI,
    };

    return this.validateReading(reading) ? reading : null;
  }

  /**
   * SECONDARY source: OpenAQ v2 latest measurements within 10km radius.
   * Endpoint: `https://api.openaq.org/v2/latest?coordinates={lat},{lng}&radius=10000`
   */
  private async fetchFromOpenAQ(lat: number, lng: number): Promise<AirQualityData | null> {
    if (this.retiredSources.has('OpenAQ')) {
      return null;
    }
    // OpenAQ permanently retired unauthenticated v2 endpoints (HTTP 410 Gone);
    // avoid hitting the retired live endpoint when no API key is configured.
    if (!this.hasCustomFetch && !isConfiguredSecret(this.openAqApiKey)) {
      return null;
    }

    const url = `https://api.openaq.org/v2/latest?coordinates=${lat},${lng}&radius=10000`;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (isConfiguredSecret(this.openAqApiKey)) {
      headers['X-API-Key'] = this.openAqApiKey;
    }

    const payload = await this.fetchJsonWithRetry<OpenAQResponse>('OpenAQ', url, { headers });
    const station = payload?.results?.find(
      (item) => Array.isArray(item.measurements) && item.measurements.length > 0,
    );
    if (!station || !station.measurements) {
      return null;
    }

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
        if (Number.isFinite(parsed) && parsed > latestTimestamp) {
          latestTimestamp = parsed;
        }
      }
    }

    const aqiInput: PollutantReadings = {};
    if (values.pm25 !== undefined) aqiInput.pm25 = values.pm25;
    if (values.pm10 !== undefined) aqiInput.pm10 = values.pm10;
    if (values.no2 !== undefined) aqiInput.no2 = values.no2;
    if (values.co !== undefined) aqiInput.co = values.co;
    if (values.o3 !== undefined) aqiInput.o3 = values.o3;

    if (Object.keys(aqiInput).length === 0) {
      return null;
    }

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
      timestamp: latestTimestamp > 0 ? latestTimestamp : this.now(),
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

    return this.validateReading(reading) ? reading : null;
  }

  /**
   * TERTIARY source: OpenWeather Air Pollution API.
   * Endpoint: `http://api.openweathermap.org/data/2.5/air_pollution?lat={lat}&lon={lng}&appid={key}`
   */
  private async fetchFromOpenWeather(lat: number, lng: number): Promise<AirQualityData | null> {
    if (!isConfiguredSecret(this.openWeatherApiKey)) {
      this.logger.warn('Skipping OpenWeather source: OPENWEATHER_API_KEY is not configured');
      return null;
    }

    const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lng}&appid=${encodeURIComponent(this.openWeatherApiKey)}`;
    const payload = await this.fetchJsonWithRetry<OpenWeatherResponse>('OpenWeather', url);
    const entry = payload?.list?.[0];
    if (!entry) {
      return null;
    }

    const c = entry.components;
    const pm25 = safeNonNegative(c?.pm2_5, 0);
    const pm10 = safeNonNegative(c?.pm10, 0);
    // OpenWeather components are reported in µg/m³
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
      const readingsForCalc: PollutantReadings = {};
      if (c.pm2_5 !== undefined && c.pm2_5 >= 0) readingsForCalc.pm25 = pm25;
      if (c.pm10 !== undefined && c.pm10 >= 0) readingsForCalc.pm10 = pm10;
      if (c.no2 !== undefined && c.no2 >= 0) readingsForCalc.no2 = no2;
      if (c.co !== undefined && c.co >= 0) readingsForCalc.co = co;
      if (c.o3 !== undefined && c.o3 >= 0) readingsForCalc.o3 = o3;
      aqi =
        Object.keys(readingsForCalc).length > 0
          ? calculateAQI(readingsForCalc).aqi
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
      timestamp:
        typeof entry.dt === 'number' && Number.isFinite(entry.dt) ? entry.dt * 1000 : this.now(),
      location: {
        lat: typeof payload?.coord?.lat === 'number' ? payload.coord.lat : lat,
        lng: typeof payload?.coord?.lon === 'number' ? payload.coord.lon : lng,
        name: `${lat.toFixed(3)}, ${lng.toFixed(3)}`,
      },
      confidence: SOURCE_RELIABILITY.OpenWeather,
    };

    return this.validateReading(reading) ? reading : null;
  }

  /** Fetches multi-day forecast entries from WAQI's embedded forecast feed. */
  private async fetchForecastFromWAQI(lat: number, lng: number): Promise<ForecastData[] | null> {
    if (!isConfiguredSecret(this.waqiToken)) {
      return null;
    }

    const url = `https://api.waqi.info/feed/geo:${lat};${lng}/?token=${encodeURIComponent(this.waqiToken)}`;
    const payload = await this.fetchJsonWithRetry<WAQIResponse>('WAQI', url);
    const daily = payload?.data?.forecast?.daily;
    if (!daily) {
      return null;
    }

    const pm25Series = daily.pm25 ?? [];
    const pm10ByDay = new Map((daily.pm10 ?? []).map((item) => [item.day ?? '', item.avg ?? 0]));
    const o3ByDay = new Map((daily.o3 ?? []).map((item) => [item.day ?? '', item.avg ?? 0]));

    const forecast: ForecastData[] = [];
    for (const dayItem of pm25Series) {
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
        timestamp: Number.isFinite(parsedDate) ? parsedDate : this.now(),
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

  /** Fallback forecast source: OpenWeather Air Pollution Forecast endpoint. */
  private async fetchForecastFromOpenWeather(
    lat: number,
    lng: number,
  ): Promise<ForecastData[] | null> {
    if (!isConfiguredSecret(this.openWeatherApiKey)) {
      return null;
    }

    const url = `https://api.openweathermap.org/data/2.5/air_pollution/forecast?lat=${lat}&lon=${lng}&appid=${encodeURIComponent(this.openWeatherApiKey)}`;
    const payload = await this.fetchJsonWithRetry<OpenWeatherResponse>('OpenWeather', url);
    if (!payload?.list || payload.list.length === 0) {
      return null;
    }

    const forecast: ForecastData[] = [];
    for (const item of payload.list.slice(0, 48)) {
      if (typeof item.dt !== 'number' || !Number.isFinite(item.dt)) {
        continue;
      }
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

  /**
   * Fuses one or more validated upstream readings using reliability weights
   * and >50% outlier detection/down-weighting, preserving complete data provenance.
   */
  private fuseData(readings: AirQualityData[]): AirQualityData {
    if (readings.length === 0) {
      throw new AQIServiceError('Cannot fuse an empty list of air quality readings.', 500);
    }

    // Sort by source reliability descending so primary station metadata leads
    const ordered = [...readings].sort((a, b) => b.confidence - a.confidence);
    const primary = ordered[0];
    if (!primary) {
      throw new AQIServiceError('Primary air quality reading missing during fusion.', 500);
    }

    if (ordered.length === 1) {
      const singleProvenance: SourceProvenance = {
        source: (primary.source as AQISourceName) || 'WAQI',
        aqi: primary.aqi,
        pm25: primary.pm25,
        pm10: primary.pm10,
        timestamp: primary.timestamp,
        reliability: primary.confidence,
        appliedWeight: 1,
        isOutlier: false,
        deviationPercent: 0,
      };
      return {
        ...primary,
        provenance: [singleProvenance],
      };
    }

    // Determine consensus baseline:
    // - With >=3 sources: median AQI resists any single corrupted sensor/model.
    // - With 2 sources: anchor on the higher-reliability reference monitor.
    const baselineAqi =
      ordered.length >= 3 ? computeMedian(ordered.map((r) => r.aqi)) : primary.aqi;

    const rawWeights: Array<{
      reading: AirQualityData;
      weight: number;
      isOutlier: boolean;
      deviationPercent: number;
    }> = ordered.map((reading) => {
      const denominator = Math.max(baselineAqi, 1);
      const deviationRatio = Math.abs(reading.aqi - baselineAqi) / denominator;
      const isOutlier = deviationRatio > this.outlierThreshold;
      const baseWeight = Math.max(0.1, Math.min(1, reading.confidence));
      const adjustedWeight = isOutlier ? baseWeight * this.outlierWeightFactor : baseWeight;

      if (isOutlier) {
        this.logger.warn('Outlier air quality reading detected and down-weighted', {
          source: reading.source,
          readingAqi: reading.aqi,
          baselineAqi,
          deviationPercent: roundTo(deviationRatio * 100, 1),
        });
      }

      return {
        reading,
        weight: adjustedWeight,
        isOutlier,
        deviationPercent: roundTo(deviationRatio * 100, 1),
      };
    });

    const totalWeight = rawWeights.reduce((sum, item) => sum + item.weight, 0);

    let aqi = 0;
    let pm25 = 0;
    let pm10 = 0;
    let no2 = 0;
    let co = 0;
    let o3 = 0;
    let so2 = 0;
    let weightedReliability = 0;
    let outlierCount = 0;

    const provenance: SourceProvenance[] = rawWeights.map((item) => {
      const normalizedWeight = totalWeight > 0 ? item.weight / totalWeight : 1 / rawWeights.length;
      aqi += item.reading.aqi * normalizedWeight;
      pm25 += item.reading.pm25 * normalizedWeight;
      pm10 += item.reading.pm10 * normalizedWeight;
      no2 += item.reading.no2 * normalizedWeight;
      co += item.reading.co * normalizedWeight;
      o3 += item.reading.o3 * normalizedWeight;
      so2 += item.reading.so2 * normalizedWeight;
      weightedReliability += item.reading.confidence * normalizedWeight;
      if (item.isOutlier) outlierCount += 1;

      return {
        source: item.reading.source as AQISourceName,
        aqi: item.reading.aqi,
        pm25: item.reading.pm25,
        pm10: item.reading.pm10,
        timestamp: item.reading.timestamp,
        reliability: item.reading.confidence,
        appliedWeight: roundTo(normalizedWeight, 4),
        isOutlier: item.isOutlier,
        deviationPercent: item.deviationPercent,
      };
    });

    // Multi-source agreement increases confidence; outlier disagreement slightly reduces it
    const agreementBonus = outlierCount === 0 ? Math.min(0.06, (ordered.length - 1) * 0.03) : 0;
    const outlierPenalty = outlierCount * 0.05;
    const finalConfidence = roundTo(
      Math.max(0.1, Math.min(0.99, weightedReliability + agreementBonus - outlierPenalty)),
      3,
    );

    const latestTimestamp = Math.max(...ordered.map((r) => r.timestamp));
    const fusedSourceLabel = ordered.map((r) => r.source).join('+');

    return {
      aqi: Math.min(500, Math.max(0, Math.round(aqi))),
      pm25: roundTo(pm25, 2),
      pm10: roundTo(pm10, 2),
      no2: roundTo(no2, 2),
      co: roundTo(co, 3),
      o3: roundTo(o3, 4),
      so2: roundTo(so2, 2),
      source: fusedSourceLabel,
      timestamp: latestTimestamp,
      location: { ...primary.location },
      confidence: finalConfidence,
      provenance,
    };
  }

  /**
   * Runtime schema and physical-bounds validator for an {@link AirQualityData} object.
   * Rejects missing fields, negative/non-finite concentrations, out-of-range AQI/confidence,
   * or invalid geographic coordinates.
   */
  private validateReading(data: unknown): boolean {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return false;
    }

    const candidate = data as Record<string, unknown>;

    const isFiniteInRange = (val: unknown, min: number, max: number): val is number =>
      typeof val === 'number' && Number.isFinite(val) && val >= min && val <= max;

    if (!isFiniteInRange(candidate.aqi, 0, 500)) return false;
    if (!isFiniteInRange(candidate.pm25, 0, 2000)) return false;
    if (!isFiniteInRange(candidate.pm10, 0, 5000)) return false;
    if (!isFiniteInRange(candidate.no2, 0, 5000)) return false;
    if (!isFiniteInRange(candidate.co, 0, 500)) return false;
    if (!isFiniteInRange(candidate.o3, 0, 5)) return false;
    if (!isFiniteInRange(candidate.so2, 0, 5000)) return false;
    if (!isFiniteInRange(candidate.confidence, 0, 1)) return false;
    if (
      typeof candidate.timestamp !== 'number' ||
      !Number.isFinite(candidate.timestamp) ||
      candidate.timestamp <= 0
    ) {
      return false;
    }
    if (typeof candidate.source !== 'string' || candidate.source.trim().length === 0) {
      return false;
    }

    const loc = candidate.location as Record<string, unknown> | undefined;
    if (!loc || typeof loc !== 'object' || Array.isArray(loc)) return false;
    if (!isFiniteInRange(loc.lat, -90, 90)) return false;
    if (!isFiniteInRange(loc.lng, -180, 180)) return false;
    if (typeof loc.name !== 'string' || loc.name.trim().length === 0) return false;

    return true;
  }

  /**
   * Executes an upstream JSON request with per-source rate limiting, timeouts,
   * exponential backoff retries on transient errors, and secret-redacted logging.
   */
  private async fetchJsonWithRetry<T>(
    source: AQISourceName,
    url: string,
    init?: RequestInit,
  ): Promise<T | null> {
    if (this.retiredSources.has(source)) {
      return null;
    }

    const safeUrl = redactUrlSecrets(url);
    const limiter = this.rateLimiters[source];

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (!limiter.tryAcquire()) {
        this.logger.warn(`Rate limit active for ${source}; skipping upstream call`, {
          source,
          url: safeUrl,
        });
        return null;
      }

      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), this.requestTimeoutMs);

      try {
        const response = await this.fetchFn(url, {
          ...init,
          signal: controller.signal,
        });

        if (response.status === 429) {
          const retryAfterMs =
            parseRetryAfterMs(response.headers?.get?.('retry-after') ?? null) ??
            this.baseRetryDelayMs * Math.pow(2, attempt + 1);
          limiter.applyCooldown(retryAfterMs);
          this.logger.warn(`Upstream ${source} returned HTTP 429 (rate limited)`, {
            source,
            attempt: attempt + 1,
            retryAfterMs,
          });
          return null;
        }

        if (response.status === 410) {
          // Endpoint is permanently retired (HTTP 410 Gone); circuit-break cleanly
          // so subsequent calls skip it without generating recurring warning logs.
          this.retiredSources.add(source);
          return null;
        }

        if (!response.ok) {
          const isRetryable = response.status >= 500 || response.status === 408;
          this.logger.warn(`Upstream ${source} HTTP error ${response.status}`, {
            source,
            status: response.status,
            attempt: attempt + 1,
            url: safeUrl,
          });
          if (!isRetryable || attempt === this.maxRetries) {
            return null;
          }
          await this.sleep(this.baseRetryDelayMs * Math.pow(2, attempt));
          continue;
        }

        const json = (await response.json()) as T;
        return json;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Upstream ${source} request failed`, {
          source,
          attempt: attempt + 1,
          error: errorMessage,
          url: safeUrl,
        });
        if (attempt === this.maxRetries) {
          this.logger.error(`Upstream ${source} exhausted all retry attempts`, {
            source,
            attempts: attempt + 1,
            url: safeUrl,
          });
          return null;
        }
        await this.sleep(this.baseRetryDelayMs * Math.pow(2, attempt));
      } finally {
        clearTimeout(timeoutHandle);
      }
    }

    return null;
  }
}

/** Shared singleton instance configured from server-side environment variables. */
export const aqiService = new AQIService();
