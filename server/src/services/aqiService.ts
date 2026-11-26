/**
 * @module aqiService
 * Multi-source live air quality integration layer with automatic fallback,
 * weighted multi-source data fusion, >50% outlier dampening, full data provenance,
 * SHA-256 100-entry 10-minute LRU caching, retry with backoff, and rate-limit compliance.
 */

import { logger } from '../utils/logger.ts';
import { createAQICacheKey, LRUCache } from './aqi/cache.ts';
import { fuseAirQualityReadings } from './aqi/fusion.ts';
import type { UpstreamFetchContext } from './aqi/httpClient.ts';
import {
  fetchForecastFromOpenWeather,
  fetchForecastFromWAQI,
  fetchReadingFromOpenAQ,
  fetchReadingFromOpenWeather,
  fetchReadingFromWAQI,
  type ProviderCredentials,
} from './aqi/providers.ts';
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
import {
  DEFAULT_RATE_LIMITS,
  SOURCE_RELIABILITY,
  SourceRateLimiter,
  assertValidCoordinates,
  isConfiguredSecret,
  validateAirQualityReading,
} from './aqi/utils.ts';

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

const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_CACHE_MAX_ENTRIES = 100;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BASE_RETRY_DELAY_MS = 250;
const DEFAULT_REQUEST_TIMEOUT_MS = 6000;
const DEFAULT_OUTLIER_THRESHOLD = 0.5;
const DEFAULT_OUTLIER_WEIGHT_FACTOR = 0.2;

const defaultLogger: AQILogger = {
  info: (message, meta) => logger.info(`[AQIService] ${message}`, meta),
  warn: (message, meta) => logger.warn(`[AQIService] ${message}`, meta),
  error: (message, meta) => logger.error(`[AQIService] ${message}`, meta),
};

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

function cloneAirQualityData(data: AirQualityData): AirQualityData {
  return {
    ...data,
    location: { ...data.location },
    provenance: data.provenance ? data.provenance.map((p) => ({ ...p })) : undefined,
  };
}

/** Multi-source live Air Quality Index service with consensus fusion, caching, and rate limiting. */
export class AQIService {
  private readonly creds: ProviderCredentials;
  private readonly logger: AQILogger;
  private readonly outlierThreshold: number;
  private readonly outlierWeightFactor: number;
  private readonly strategy: 'fuse' | 'fallback';
  private readonly fetchCtx: UpstreamFetchContext;
  private readonly currentCache: LRUCache<AirQualityData>;
  private readonly forecastCache: LRUCache<ForecastData[]>;
  private readonly rateLimiters: Record<AQISourceName, SourceRateLimiter>;
  private readonly retiredSources = new Set<AQISourceName>();

  constructor(options: AQIServiceOptions = {}) {
    const now = options.now ?? Date.now;
    this.creds = {
      waqiToken: options.waqiToken ?? process.env.WAQI_API_TOKEN,
      openAqApiKey: options.openAqApiKey ?? process.env.OPENAQ_API_KEY,
      openWeatherApiKey: options.openWeatherApiKey ?? process.env.OPENWEATHER_API_KEY,
      hasCustomFetch: typeof options.fetchFn === 'function',
      now,
    };
    this.logger = options.logger ?? defaultLogger;
    this.outlierThreshold = options.outlierThreshold ?? DEFAULT_OUTLIER_THRESHOLD;
    this.outlierWeightFactor = options.outlierWeightFactor ?? DEFAULT_OUTLIER_WEIGHT_FACTOR;
    this.strategy = options.strategy ?? 'fuse';

    const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    const cacheMaxEntries = options.cacheMaxEntries ?? DEFAULT_CACHE_MAX_ENTRIES;
    this.currentCache = new LRUCache<AirQualityData>(cacheMaxEntries, cacheTtlMs, now);
    this.forecastCache = new LRUCache<ForecastData[]>(cacheMaxEntries, cacheTtlMs, now);

    this.rateLimiters = {
      WAQI: new SourceRateLimiter(options.rateLimits?.WAQI ?? DEFAULT_RATE_LIMITS.WAQI, now),
      OpenAQ: new SourceRateLimiter(options.rateLimits?.OpenAQ ?? DEFAULT_RATE_LIMITS.OpenAQ, now),
      OpenWeather: new SourceRateLimiter(
        options.rateLimits?.OpenWeather ?? DEFAULT_RATE_LIMITS.OpenWeather,
        now,
      ),
    };

    this.fetchCtx = {
      fetchFn: options.fetchFn ?? globalThis.fetch.bind(globalThis),
      sleep: options.sleep ?? defaultSleep,
      logger: this.logger,
      maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
      baseRetryDelayMs: options.baseRetryDelayMs ?? DEFAULT_BASE_RETRY_DELAY_MS,
      requestTimeoutMs: options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
      rateLimiters: this.rateLimiters,
      retiredSources: this.retiredSources,
    };
  }

  /** Fetches live fused air quality data for coordinates with 10-minute SHA-256 LRU caching. */
  async getCurrentAQI(lat: number, lng: number): Promise<AirQualityData> {
    assertValidCoordinates(lat, lng);
    const cacheKey = createAQICacheKey('current', lat, lng);
    const cached = this.currentCache.get(cacheKey);
    if (cached) return cloneAirQualityData(cached);

    const readings = await this.collectReadings(lat, lng);
    if (readings.length === 0) {
      this.logger.error('All upstream air quality sources failed', { lat, lng });
      throw new AQIServiceError(
        'Unable to retrieve live air quality data from WAQI, OpenAQ, or OpenWeather.',
        503,
        { lat, lng, sourcesAttempted: ['WAQI', 'OpenAQ', 'OpenWeather'] },
      );
    }

    const fused = fuseAirQualityReadings(readings, {
      outlierThreshold: this.outlierThreshold,
      outlierWeightFactor: this.outlierWeightFactor,
      logger: this.logger,
    });
    this.currentCache.set(cacheKey, fused);
    return cloneAirQualityData(fused);
  }

  /** Fetches multi-day/hourly air quality forecast with WAQI primary and OpenWeather fallback. */
  async getForecast(lat: number, lng: number): Promise<ForecastData[]> {
    assertValidCoordinates(lat, lng);
    const cacheKey = createAQICacheKey('forecast', lat, lng);
    const cached = this.forecastCache.get(cacheKey);
    if (cached) return cached.map((entry) => ({ ...entry }));

    const waqiForecast = await fetchForecastFromWAQI(this.fetchCtx, this.creds, lat, lng);
    if (waqiForecast && waqiForecast.length > 0) {
      this.forecastCache.set(cacheKey, waqiForecast);
      return waqiForecast.map((entry) => ({ ...entry }));
    }

    const owForecast = await fetchForecastFromOpenWeather(this.fetchCtx, this.creds, lat, lng);
    if (owForecast && owForecast.length > 0) {
      this.forecastCache.set(cacheKey, owForecast);
      return owForecast.map((entry) => ({ ...entry }));
    }

    this.logger.error('All air quality forecast sources failed', { lat, lng });
    throw new AQIServiceError(
      'Unable to retrieve air quality forecast from WAQI or OpenWeather.',
      503,
      { lat, lng, sourcesAttempted: ['WAQI', 'OpenWeather'] },
    );
  }

  getCacheStats(): { current: CacheStats; forecast: CacheStats } {
    return { current: this.currentCache.stats(), forecast: this.forecastCache.stats() };
  }

  getSourceStatuses(): SourceStatus[] {
    return [
      {
        name: 'WAQI',
        priority: 1,
        configured: isConfiguredSecret(this.creds.waqiToken),
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
        configured: isConfiguredSecret(this.creds.openWeatherApiKey),
        reliability: SOURCE_RELIABILITY.OpenWeather,
        rateLimit: this.rateLimiters.OpenWeather.getStatus(),
      },
    ];
  }

  clearCache(): void {
    this.currentCache.clear();
    this.forecastCache.clear();
  }

  private async collectReadings(lat: number, lng: number): Promise<AirQualityData[]> {
    const providers = [
      () => fetchReadingFromWAQI(this.fetchCtx, this.creds, lat, lng),
      () => fetchReadingFromOpenAQ(this.fetchCtx, this.creds, lat, lng),
      () => fetchReadingFromOpenWeather(this.fetchCtx, this.creds, lat, lng),
    ];

    const readings: AirQualityData[] = [];
    if (this.strategy === 'fallback') {
      for (const provider of providers) {
        const reading = await provider();
        if (reading && validateAirQualityReading(reading)) {
          readings.push(reading);
          break;
        }
      }
      return readings;
    }

    const settled = await Promise.allSettled(providers.map((fn) => fn()));
    for (const outcome of settled) {
      if (
        outcome.status === 'fulfilled' &&
        outcome.value &&
        validateAirQualityReading(outcome.value)
      ) {
        readings.push(outcome.value);
      }
    }
    return readings;
  }
}

export const aqiService = new AQIService();
