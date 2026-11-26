/**
 * @module aqiTypes
 * Shared TypeScript interfaces, provenance models, and error types for {@link AQIService}.
 */

import type { AQICategoryLabel } from '../../lib/aqiEngine.ts';

/** Identifier for supported upstream air quality providers. */
export type AQISourceName = 'WAQI' | 'OpenAQ' | 'OpenWeather';

/** Provenance record tracking each upstream source's contribution to a fused reading. */
export interface SourceProvenance {
  /** Upstream provider name. */
  source: AQISourceName;
  /** Raw AQI reported or computed for this source. */
  aqi: number;
  /** PM2.5 concentration (µg/m³) reported by this source. */
  pm25: number;
  /** PM10 concentration (µg/m³) reported by this source. */
  pm10: number;
  /** Epoch timestamp (ms) of the source measurement. */
  timestamp: number;
  /** Base reliability score (0–1) assigned to this provider. */
  reliability: number;
  /** Final normalized weight applied during fusion (0–1). */
  appliedWeight: number;
  /** True when the reading deviated by >50% from the consensus baseline and was down-weighted. */
  isOutlier: boolean;
  /** Percentage deviation relative to the consensus baseline. */
  deviationPercent: number;
}

/** Normalized live air quality reading returned by {@link AQIService}. */
export interface AirQualityData {
  /** Composite US EPA Air Quality Index (0–500). */
  aqi: number;
  /** Fine particulate matter PM2.5 (µg/m³). */
  pm25: number;
  /** Coarse particulate matter PM10 (µg/m³). */
  pm10: number;
  /** Nitrogen dioxide NO2 (ppb). */
  no2: number;
  /** Carbon monoxide CO (mg/m³). */
  co: number;
  /** Ground-level ozone O3 (ppm). */
  o3: number;
  /** Sulfur dioxide SO2 (ppb). */
  so2: number;
  /** Provider name or fused provider list (e.g. `'WAQI'` or `'WAQI+OpenAQ'`). */
  source: string;
  /** Reading timestamp in epoch milliseconds. */
  timestamp: number;
  /** Geographic coordinates and human-readable station/area label. */
  location: { lat: number; lng: number; name: string };
  /** Confidence score (0–1) derived from source reliability and multi-source agreement. */
  confidence: number;
  /** Optional per-source provenance audit trail. */
  provenance?: SourceProvenance[];
}

/** Normalized air quality forecast entry. */
export interface ForecastData {
  /** Forecast point timestamp in epoch milliseconds. */
  timestamp: number;
  /** ISO-8601 date or datetime string for this forecast interval. */
  date: string;
  /** Predicted composite AQI (0–500). */
  aqi: number;
  /** US EPA category label corresponding to the predicted AQI. */
  category: AQICategoryLabel;
  /** Hex UI color (#RRGGBB) corresponding to the predicted AQI. */
  color: string;
  /** Predicted PM2.5 (µg/m³). */
  pm25: number;
  /** Predicted PM10 (µg/m³). */
  pm10: number;
  /** Predicted NO2 (ppb). */
  no2: number;
  /** Predicted CO (mg/m³). */
  co: number;
  /** Predicted O3 (ppm). */
  o3: number;
  /** Predicted SO2 (ppb). */
  so2: number;
  /** Upstream source that generated this forecast point. */
  source: string;
  /** Forecast confidence score (0–1). */
  confidence: number;
}

/** Per-provider sliding-window rate limit configuration. */
export interface RateLimitConfig {
  /** Maximum number of upstream HTTP requests allowed per window. */
  maxRequests: number;
  /** Window duration in milliseconds. */
  windowMs: number;
}

/** Structured logger interface for observability and clean testing. */
export interface AQILogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/** Cache diagnostics snapshot. */
export interface CacheStats {
  size: number;
  maxEntries: number;
  ttlMs: number;
  hits: number;
  misses: number;
  evictions: number;
}

/** Public source status summary (never exposes API keys). */
export interface SourceStatus {
  name: AQISourceName;
  priority: number;
  configured: boolean;
  reliability: number;
  rateLimit: {
    maxRequests: number;
    windowMs: number;
    remaining: number;
    blockedUntil: number | null;
  };
}

/** Configuration options for {@link AQIService}. */
export interface AQIServiceOptions {
  /** Server-side WAQI API token. Defaults to `process.env.WAQI_API_TOKEN`. */
  waqiToken?: string;
  /** Optional server-side OpenAQ API key. Defaults to `process.env.OPENAQ_API_KEY`. */
  openAqApiKey?: string;
  /** Server-side OpenWeather API key. Defaults to `process.env.OPENWEATHER_API_KEY`. */
  openWeatherApiKey?: string;
  /** Fetch implementation (injectable for mocked unit tests). */
  fetchFn?: typeof fetch;
  /** Clock provider returning epoch ms (injectable for deterministic cache/rate-limit tests). */
  now?: () => number;
  /** Async sleep function (injectable for zero-delay retry unit tests). */
  sleep?: (ms: number) => Promise<void>;
  /** Logger implementation (defaults to structured logger). */
  logger?: AQILogger;
  /** In-memory cache TTL in ms (default: 10 minutes = 600,000 ms). */
  cacheTtlMs?: number;
  /** Maximum LRU cache entries (default: 100). */
  cacheMaxEntries?: number;
  /** Maximum retry attempts after an initial transient failure (default: 2). */
  maxRetries?: number;
  /** Base exponential backoff delay in ms (default: 250). */
  baseRetryDelayMs?: number;
  /** Per-request HTTP timeout in ms (default: 6000). */
  requestTimeoutMs?: number;
  /** Outlier deviation threshold ratio (default: 0.50 = 50%). */
  outlierThreshold?: number;
  /** Multiplier applied to an outlier source's weight (default: 0.2). */
  outlierWeightFactor?: number;
  /**
   * Acquisition strategy:
   * - `'fuse'` (default): queries all configured sources in parallel and fuses valid readings.
   * - `'fallback'`: queries primary first and only calls secondary/tertiary if earlier sources fail.
   */
  strategy?: 'fuse' | 'fallback';
  /** Custom rate limit overrides per source. */
  rateLimits?: Partial<Record<AQISourceName, RateLimitConfig>>;
}

/** Custom error thrown when upstream AQI retrieval fails or inputs are invalid. */
export class AQIServiceError extends Error {
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, statusCode = 503, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AQIServiceError';
    this.statusCode = statusCode;
    this.details = details;
  }
}
