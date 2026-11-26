/**
 * @module aqiUtils
 * Rate limiting, coordinate validation, unit normalization, and reading validation for AQIService.
 */

import type { AQICategoryLabel } from '../../lib/aqiEngine.ts';
import type { AQISourceName, AirQualityData, RateLimitConfig } from './types.ts';

export const SOURCE_RELIABILITY: Readonly<Record<AQISourceName, number>> = {
  WAQI: 0.95,
  OpenAQ: 0.85,
  OpenWeather: 0.7,
};

export const DEFAULT_RATE_LIMITS: Readonly<Record<AQISourceName, RateLimitConfig>> = {
  WAQI: { maxRequests: 60, windowMs: 60_000 },
  OpenAQ: { maxRequests: 60, windowMs: 60_000 },
  OpenWeather: { maxRequests: 60, windowMs: 60_000 },
};

export const OPENWEATHER_AQI_SCALE_MAP: Readonly<Record<number, number>> = {
  1: 25,
  2: 75,
  3: 125,
  4: 175,
  5: 250,
};

/** Per-provider sliding-window rate limiter with HTTP 429 cooldown tracking. */
export class SourceRateLimiter {
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
export function redactUrlSecrets(rawUrl: string): string {
  return rawUrl.replace(/([?&](?:token|appid|api_key)=)[^&]+/gi, '$1[REDACTED]');
}

/** Validates latitude and longitude bounds and finiteness. */
export function assertValidCoordinates(lat: number, lng: number): void {
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
export function safeNonNegative(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value;
  }
  return fallback;
}

/** Rounds a floating-point number to a fixed number of decimal places. */
export function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/** Computes the statistical median of a non-empty numeric array. */
export function computeMedian(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid] ?? 0;
  }
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/** Resolves an EPA category label for a numeric AQI value. */
export function classifyAQILabel(aqi: number): AQICategoryLabel {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

/** Normalizes an OpenAQ measurement concentration into canonical units. */
export function normalizeOpenAQUnit(parameter: string, value: number, unit: string): number {
  const normalizedUnit = unit.trim().toLowerCase();
  switch (parameter) {
    case 'pm25':
    case 'pm10':
      return normalizedUnit === 'mg/m³' || normalizedUnit === 'mg/m3' ? value * 1000 : value;
    case 'no2':
      if (normalizedUnit === 'ppm') return value * 1000;
      if (normalizedUnit === 'µg/m³' || normalizedUnit === 'ug/m3') return value / 1.88;
      return value;
    case 'co':
      if (normalizedUnit === 'µg/m³' || normalizedUnit === 'ug/m3') return value / 1000;
      if (normalizedUnit === 'ppm') return value * 1.145;
      if (normalizedUnit === 'ppb') return (value * 1.145) / 1000;
      return value;
    case 'o3':
      if (normalizedUnit === 'ppb') return value / 1000;
      if (normalizedUnit === 'µg/m³' || normalizedUnit === 'ug/m3') return value / 1960;
      return value;
    case 'so2':
      if (normalizedUnit === 'ppm') return value * 1000;
      if (normalizedUnit === 'µg/m³' || normalizedUnit === 'ug/m3') return value / 2.62;
      return value;
    default:
      return value;
  }
}

/** Parses an HTTP `Retry-After` header into milliseconds if valid. */
export function parseRetryAfterMs(headerValue: string | null): number | null {
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
export function isConfiguredSecret(value: string | undefined): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  const upper = trimmed.toUpperCase();
  return !upper.startsWith('YOUR_') && !upper.startsWith('MY_');
}

/** Runtime schema and physical-bounds validator for an {@link AirQualityData} reading. */
export function validateAirQualityReading(data: unknown): data is AirQualityData {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return false;
  }

  const candidate = data as Record<string, unknown>;
  const inRange = (val: unknown, min: number, max: number): val is number =>
    typeof val === 'number' && Number.isFinite(val) && val >= min && val <= max;

  if (
    !inRange(candidate.aqi, 0, 500) ||
    !inRange(candidate.pm25, 0, 2000) ||
    !inRange(candidate.pm10, 0, 5000) ||
    !inRange(candidate.no2, 0, 5000) ||
    !inRange(candidate.co, 0, 500) ||
    !inRange(candidate.o3, 0, 5) ||
    !inRange(candidate.so2, 0, 5000) ||
    !inRange(candidate.confidence, 0, 1)
  ) {
    return false;
  }

  if (
    typeof candidate.timestamp !== 'number' ||
    !Number.isFinite(candidate.timestamp) ||
    candidate.timestamp <= 0 ||
    typeof candidate.source !== 'string' ||
    candidate.source.trim().length === 0
  ) {
    return false;
  }

  const loc = candidate.location as Record<string, unknown> | undefined;
  if (!loc || typeof loc !== 'object' || Array.isArray(loc)) return false;
  if (!inRange(loc.lat, -90, 90) || !inRange(loc.lng, -180, 180)) return false;
  return typeof loc.name === 'string' && loc.name.trim().length > 0;
}
