import { describe, expect, it, vi } from 'vitest';
import { AQIService, AQIServiceError } from '../src/services/aqiService';
import {
  createSilentLogger,
  jsonResponse,
  makeOpenAqPayload,
  makeOpenWeatherPayload,
  makeWaqiPayload,
} from './helpers/aqiFixtures';

describe('AQIService — Upstream Provider Resilience, Retries & Forecasts', () => {
  it('retries transient 5xx errors with exponential backoff and redacts tokens in logs', async () => {
    const delays: number[] = [];
    const logger = createSilentLogger();
    let waqiAttempts = 0;

    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('api.waqi.info')) {
        waqiAttempts += 1;
        if (waqiAttempts < 3) return jsonResponse({ error: 'temporary outage' }, 503);
        return jsonResponse(makeWaqiPayload({ aqi: 55 }));
      }
      return jsonResponse({ results: [] }, 200);
    });

    const service = new AQIService({
      waqiToken: 'super-secret-token-xyz',
      openWeatherApiKey: '',
      strategy: 'fallback',
      maxRetries: 2,
      baseRetryDelayMs: 100,
      fetchFn: mockFetch as unknown as typeof fetch,
      sleep: async (ms) => {
        delays.push(ms);
      },
      logger,
    });

    const result = await service.getCurrentAQI(35.6762, 139.6503);
    expect(result.aqi).toBe(55);
    expect(waqiAttempts).toBe(3);
    expect(delays).toEqual([100, 200]);

    const serializedLogs = JSON.stringify(logger.warns);
    expect(serializedLogs).not.toContain('super-secret-token-xyz');
    expect(serializedLogs).toContain('[REDACTED]');
  });

  it('complies with per-source rate limits and HTTP 429 Retry-After cooldowns', async () => {
    const currentTime = 1_760_000_000_000;
    let waqiCalls = 0;

    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('api.waqi.info')) {
        waqiCalls += 1;
        return jsonResponse({ status: 'error' }, 429, { 'retry-after': '30' });
      }
      if (url.includes('api.openaq.org')) return jsonResponse(makeOpenAqPayload({ pm25: 22 }));
      return jsonResponse({}, 404);
    });

    const service = new AQIService({
      waqiToken: 'test-waqi-token',
      openWeatherApiKey: '',
      fetchFn: mockFetch as unknown as typeof fetch,
      now: () => currentTime,
      sleep: async () => undefined,
      logger: createSilentLogger(),
    });

    const first = await service.getCurrentAQI(28.61, 77.21);
    expect(first.source).toBe('OpenAQ');
    expect(waqiCalls).toBe(1);

    const second = await service.getCurrentAQI(19.07, 72.87);
    expect(second.source).toBe('OpenAQ');
    expect(waqiCalls).toBe(1);

    const waqiStatus = service.getSourceStatuses().find((s) => s.name === 'WAQI');
    expect(waqiStatus?.rateLimit.blockedUntil).toBe(currentTime + 30_000);
  });

  it('validates coordinates and rejects malformed/invalid upstream payloads', async () => {
    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('api.waqi.info')) {
        return jsonResponse({ status: 'ok', data: { aqi: '-', iaqi: {} } }, 200);
      }
      if (url.includes('api.openaq.org')) {
        return jsonResponse(
          {
            results: [
              {
                location: 'Broken Sensor',
                measurements: [{ parameter: 'pm25', value: -99, unit: 'µg/m³' }],
              },
            ],
          },
          200,
        );
      }
      return jsonResponse({}, 500);
    });

    const service = new AQIService({
      waqiToken: 'test-waqi-token',
      openWeatherApiKey: 'test-owm-key',
      fetchFn: mockFetch as unknown as typeof fetch,
      sleep: async () => undefined,
      logger: createSilentLogger(),
      maxRetries: 0,
    });

    await expect(service.getCurrentAQI(95, 0)).rejects.toThrow(RangeError);
    await expect(service.getCurrentAQI(0, -181)).rejects.toThrow(RangeError);
    await expect(service.getCurrentAQI(Number.NaN, 10)).rejects.toThrow(RangeError);
    await expect(service.getCurrentAQI(28.6139, 77.209)).rejects.toThrow(AQIServiceError);
  });

  it('fetches forecast from WAQI and falls back to OpenWeather when WAQI is unavailable', async () => {
    let waqiHealthy = true;
    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('api.waqi.info')) {
        return waqiHealthy
          ? jsonResponse(makeWaqiPayload({ includeForecast: true }))
          : jsonResponse({ status: 'error' }, 503);
      }
      if (url.includes('air_pollution/forecast')) {
        return jsonResponse(makeOpenWeatherPayload({ pm25: 42.0 }));
      }
      return jsonResponse({}, 404);
    });

    const service = new AQIService({
      waqiToken: 'test-waqi-token',
      openWeatherApiKey: 'test-owm-key',
      fetchFn: mockFetch as unknown as typeof fetch,
      sleep: async () => undefined,
      logger: createSilentLogger(),
      maxRetries: 0,
    });

    const waqiForecast = await service.getForecast(28.6139, 77.209);
    expect(waqiForecast).toHaveLength(2);
    expect(waqiForecast[0]?.source).toBe('WAQI');
    expect(waqiForecast[0]?.date).toBe('2026-11-19');
    expect(waqiForecast[0]?.color).toMatch(/^#[0-9A-F]{6}$/);

    service.clearCache();
    waqiHealthy = false;
    const owmForecast = await service.getForecast(28.6139, 77.209);
    expect(owmForecast).toHaveLength(1);
    expect(owmForecast[0]?.source).toBe('OpenWeather');
    expect(owmForecast[0]?.aqi).toBeGreaterThan(100);
  });

  it('circuit-breaks retired HTTP 410 Gone endpoints silently on subsequent requests', async () => {
    const logger = createSilentLogger();
    let openAqCalls = 0;

    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('api.waqi.info'))
        return jsonResponse(makeWaqiPayload({ aqi: 92, pm25: 31.5 }));
      if (url.includes('api.openaq.org')) {
        openAqCalls += 1;
        return jsonResponse({ message: 'Gone. Version 2 has been retired.' }, 410);
      }
      if (url.includes('api.openweathermap.org')) {
        return jsonResponse(makeOpenWeatherPayload({ pm25: 30.0, pm10: 55.0 }));
      }
      return jsonResponse({}, 404);
    });

    const service = new AQIService({
      waqiToken: 'test-waqi-token',
      openWeatherApiKey: 'test-owm-key',
      fetchFn: mockFetch as unknown as typeof fetch,
      sleep: async () => undefined,
      logger,
    });

    const first = await service.getCurrentAQI(28.6139, 77.209);
    expect(first.source).toBe('WAQI+OpenWeather');
    expect(openAqCalls).toBe(1);
    expect(logger.warns).toHaveLength(0);
    expect(logger.errors).toHaveLength(0);
    expect(service.getSourceStatuses().find((s) => s.name === 'OpenAQ')?.configured).toBe(false);

    const second = await service.getCurrentAQI(12.9716, 77.5946);
    expect(second.source).toBe('WAQI+OpenWeather');
    expect(openAqCalls).toBe(1);
  });
});
