import express from 'express';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it, vi } from 'vitest';
import { createAqiRouter } from '../src/routes/aqi';
import {
  AQIService,
  AQIServiceError,
  LRUCache,
  createAQICacheKey,
  type AQILogger,
} from '../src/services/aqiService';

function createSilentLogger(): AQILogger & {
  infos: Array<{ message: string; meta?: Record<string, unknown> }>;
  warns: Array<{ message: string; meta?: Record<string, unknown> }>;
  errors: Array<{ message: string; meta?: Record<string, unknown> }>;
} {
  const infos: Array<{ message: string; meta?: Record<string, unknown> }> = [];
  const warns: Array<{ message: string; meta?: Record<string, unknown> }> = [];
  const errors: Array<{ message: string; meta?: Record<string, unknown> }> = [];
  return {
    infos,
    warns,
    errors,
    info: (message, meta) => infos.push({ message, meta }),
    warn: (message, meta) => warns.push({ message, meta }),
    error: (message, meta) => errors.push({ message, meta }),
  };
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function makeWaqiPayload(overrides?: {
  aqi?: number | string;
  pm25?: number;
  pm10?: number;
  no2?: number;
  co?: number;
  o3?: number;
  so2?: number;
  name?: string;
  includeForecast?: boolean;
}) {
  return {
    status: 'ok',
    data: {
      aqi: overrides?.aqi ?? 88,
      city: {
        geo: [28.6139, 77.209],
        name: overrides?.name ?? 'New Delhi US Embassy',
      },
      time: { v: 1_760_000_000 },
      iaqi: {
        pm25: { v: overrides?.pm25 ?? 29.8 },
        pm10: { v: overrides?.pm10 ?? 74 },
        no2: { v: overrides?.no2 ?? 31 },
        co: { v: overrides?.co ?? 1.1 },
        o3: { v: overrides?.o3 ?? 0.042 },
        so2: { v: overrides?.so2 ?? 8.5 },
      },
      forecast:
        overrides?.includeForecast === false
          ? undefined
          : {
              daily: {
                pm25: [
                  { day: '2026-11-19', avg: 30, min: 20, max: 45 },
                  { day: '2026-11-20', avg: 48, min: 35, max: 62 },
                ],
                pm10: [
                  { day: '2026-11-19', avg: 68, min: 50, max: 85 },
                  { day: '2026-11-20', avg: 112, min: 90, max: 140 },
                ],
                o3: [
                  { day: '2026-11-19', avg: 38, min: 20, max: 55 },
                  { day: '2026-11-20', avg: 45, min: 25, max: 65 },
                ],
              },
            },
    },
  };
}

function makeOpenAqPayload(overrides?: {
  pm25?: number;
  pm10?: number;
  no2?: number;
  co?: number;
  o3?: number;
  so2?: number;
  location?: string;
}) {
  return {
    results: [
      {
        location: overrides?.location ?? 'Connaught Place Monitor',
        city: 'New Delhi',
        coordinates: { latitude: 28.6304, longitude: 77.2177 },
        measurements: [
          {
            parameter: 'pm25',
            value: overrides?.pm25 ?? 30.2,
            unit: 'µg/m³',
            lastUpdated: '2026-11-19T08:00:00Z',
          },
          {
            parameter: 'pm10',
            value: overrides?.pm10 ?? 76,
            unit: 'µg/m³',
            lastUpdated: '2026-11-19T08:00:00Z',
          },
          {
            parameter: 'no2',
            value: overrides?.no2 ?? 32,
            unit: 'ppb',
            lastUpdated: '2026-11-19T08:00:00Z',
          },
          {
            parameter: 'co',
            value: overrides?.co ?? 1.0,
            unit: 'mg/m³',
            lastUpdated: '2026-11-19T08:00:00Z',
          },
          {
            parameter: 'o3',
            value: overrides?.o3 ?? 0.044,
            unit: 'ppm',
            lastUpdated: '2026-11-19T08:00:00Z',
          },
          {
            parameter: 'so2',
            value: overrides?.so2 ?? 9.0,
            unit: 'ppb',
            lastUpdated: '2026-11-19T08:00:00Z',
          },
        ],
      },
    ],
  };
}

function makeOpenWeatherPayload(overrides?: {
  pm25?: number;
  pm10?: number;
  no2Ug?: number;
  coUg?: number;
  o3Ug?: number;
  so2Ug?: number;
  mainAqi?: number;
}) {
  return {
    coord: { lat: 28.6139, lon: 77.209 },
    list: [
      {
        dt: 1_760_000_200,
        main: { aqi: overrides?.mainAqi ?? 2 },
        components: {
          pm2_5: overrides?.pm25 ?? 29.0,
          pm10: overrides?.pm10 ?? 72.0,
          no2: overrides?.no2Ug ?? 56.4, // ~30 ppb
          co: overrides?.coUg ?? 1100, // 1.1 mg/m³
          o3: overrides?.o3Ug ?? 82.32, // ~0.042 ppm
          so2: overrides?.so2Ug ?? 22.27, // ~8.5 ppb
        },
      },
    ],
  };
}

async function startTestServer(router: express.Router): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const app = express();
  app.use('/api/aqi', router);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

describe('AQIService — Multi-Source Integration, Fallback, Fusion & Caching', () => {
  it('generates deterministic 64-char SHA-256 cache keys normalized by coordinate precision', () => {
    const key1 = createAQICacheKey('current', 28.61391, 77.20901);
    const key2 = createAQICacheKey('current', 28.61394, 77.20904);
    const forecastKey = createAQICacheKey('forecast', 28.61391, 77.20901);

    expect(key1).toMatch(/^[a-f0-9]{64}$/);
    expect(key1).toBe(key2);
    expect(key1).not.toBe(forecastKey);
  });

  it('fuses WAQI, OpenAQ, and OpenWeather readings with full provenance and high confidence when sources agree', async () => {
    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('api.waqi.info'))
        return jsonResponse(makeWaqiPayload({ aqi: 88, pm25: 30 }));
      if (url.includes('api.openaq.org')) return jsonResponse(makeOpenAqPayload({ pm25: 30.2 }));
      if (url.includes('api.openweathermap.org'))
        return jsonResponse(makeOpenWeatherPayload({ pm25: 29.0 }));
      return jsonResponse({}, 404);
    });

    const service = new AQIService({
      waqiToken: 'test-waqi-token',
      openWeatherApiKey: 'test-owm-key',
      fetchFn: mockFetch as unknown as typeof fetch,
      sleep: async () => undefined,
      logger: createSilentLogger(),
    });

    const result = await service.getCurrentAQI(28.6139, 77.209);

    expect(result.source).toBe('WAQI+OpenAQ+OpenWeather');
    expect(result.aqi).toBeGreaterThanOrEqual(85);
    expect(result.aqi).toBeLessThanOrEqual(92);
    expect(result.location.name).toBe('New Delhi US Embassy');
    expect(result.confidence).toBeGreaterThan(0.85);
    expect(result.provenance).toHaveLength(3);
    expect(result.provenance?.every((p) => !p.isOutlier)).toBe(true);
    expect(result.provenance?.map((p) => p.source)).toEqual(['WAQI', 'OpenAQ', 'OpenWeather']);
  });

  it('automatically falls back to OpenAQ when primary WAQI fails', async () => {
    const logger = createSilentLogger();
    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('api.waqi.info')) return jsonResponse({ status: 'error' }, 500);
      if (url.includes('api.openaq.org')) return jsonResponse(makeOpenAqPayload({ pm25: 35.4 }));
      return jsonResponse({}, 404);
    });

    const service = new AQIService({
      waqiToken: 'test-waqi-token',
      openWeatherApiKey: '',
      fetchFn: mockFetch as unknown as typeof fetch,
      sleep: async () => undefined,
      logger,
      maxRetries: 1,
    });

    const result = await service.getCurrentAQI(28.6139, 77.209);

    expect(result.source).toBe('OpenAQ');
    expect(result.aqi).toBe(100); // PM2.5 35.4 -> EPA AQI 100
    expect(result.location.name).toContain('Connaught Place Monitor');
    expect(result.confidence).toBe(0.85);
    expect(result.provenance).toHaveLength(1);
    expect(result.provenance?.[0]?.source).toBe('OpenAQ');
    expect(logger.warns.length).toBeGreaterThan(0);
  });

  it('automatically falls back to tertiary OpenWeather when both WAQI and OpenAQ fail', async () => {
    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('api.waqi.info')) throw new Error('ECONNRESET');
      if (url.includes('api.openaq.org')) return jsonResponse({ results: [] }, 200);
      if (url.includes('api.openweathermap.org')) {
        return jsonResponse(
          makeOpenWeatherPayload({
            pm25: 55.4, // EPA AQI 150
            pm10: 90,
            no2Ug: 37.6, // 20 ppb
            coUg: 1145, // 1.145 mg/m³
            o3Ug: 58.8, // 0.03 ppm
            so2Ug: 26.2, // 10 ppb
          }),
        );
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

    const result = await service.getCurrentAQI(28.6139, 77.209);

    expect(result.source).toBe('OpenWeather');
    expect(result.aqi).toBe(150);
    expect(result.no2).toBeCloseTo(20, 1);
    expect(result.co).toBeCloseTo(1.145, 3);
    expect(result.o3).toBeCloseTo(0.03, 3);
    expect(result.so2).toBeCloseTo(10, 1);
    expect(result.confidence).toBe(0.7);
  });

  it('supports strict sequential fallback strategy without calling secondary sources when WAQI succeeds', async () => {
    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('api.waqi.info')) return jsonResponse(makeWaqiPayload({ aqi: 64 }));
      throw new Error(`Should not have called ${url}`);
    });

    const service = new AQIService({
      waqiToken: 'test-waqi-token',
      openWeatherApiKey: 'test-owm-key',
      strategy: 'fallback',
      fetchFn: mockFetch as unknown as typeof fetch,
      sleep: async () => undefined,
      logger: createSilentLogger(),
    });

    const result = await service.getCurrentAQI(40.7128, -74.006);

    expect(result.source).toBe('WAQI');
    expect(result.aqi).toBe(64);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('detects >50% outlier source and significantly down-weights it during fusion', async () => {
    const logger = createSilentLogger();
    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      // WAQI & OpenAQ agree near AQI ~88; OpenWeather reports a massive outlier (PM2.5=260 -> AQI ~309, >250% deviation)
      if (url.includes('api.waqi.info'))
        return jsonResponse(makeWaqiPayload({ aqi: 88, pm25: 29.8 }));
      if (url.includes('api.openaq.org')) return jsonResponse(makeOpenAqPayload({ pm25: 30.0 }));
      if (url.includes('api.openweathermap.org'))
        return jsonResponse(makeOpenWeatherPayload({ pm25: 260, pm10: 320 }));
      return jsonResponse({}, 404);
    });

    const service = new AQIService({
      waqiToken: 'test-waqi-token',
      openWeatherApiKey: 'test-owm-key',
      fetchFn: mockFetch as unknown as typeof fetch,
      sleep: async () => undefined,
      logger,
    });

    const result = await service.getCurrentAQI(28.6139, 77.209);
    const owmProv = result.provenance?.find((p) => p.source === 'OpenWeather');
    const waqiProv = result.provenance?.find((p) => p.source === 'WAQI');

    expect(owmProv?.isOutlier).toBe(true);
    expect(owmProv?.deviationPercent).toBeGreaterThan(50);
    expect(owmProv?.appliedWeight).toBeLessThan(0.1);
    expect(waqiProv?.isOutlier).toBe(false);
    expect(waqiProv?.appliedWeight).toBeGreaterThan(0.45);
    // Fused AQI remains anchored near consensus (~88–106) instead of pulled toward ~160+
    expect(result.aqi).toBeLessThan(115);
    expect(logger.warns.some((w) => w.message.includes('Outlier'))).toBe(true);
  });

  it('caches responses for 10 minutes with SHA-256 keys and re-fetches after TTL expiry', async () => {
    let currentTime = 1_760_000_000_000;
    let fetchCalls = 0;

    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      fetchCalls += 1;
      const url = String(input);
      if (url.includes('api.waqi.info')) {
        return jsonResponse(makeWaqiPayload({ aqi: fetchCalls === 1 ? 70 : 120 }));
      }
      return jsonResponse({ results: [] }, 200);
    });

    const service = new AQIService({
      waqiToken: 'test-waqi-token',
      openWeatherApiKey: '',
      strategy: 'fallback',
      fetchFn: mockFetch as unknown as typeof fetch,
      now: () => currentTime,
      sleep: async () => undefined,
      logger: createSilentLogger(),
    });

    const first = await service.getCurrentAQI(51.5074, -0.1278);
    expect(first.aqi).toBe(70);
    expect(fetchCalls).toBe(1);

    // 9 minutes later -> cache HIT
    currentTime += 9 * 60 * 1000;
    const second = await service.getCurrentAQI(51.5074, -0.1278);
    expect(second.aqi).toBe(70);
    expect(fetchCalls).toBe(1);

    // Advance past 10-minute TTL -> cache MISS & fresh fetch
    currentTime += 2 * 60 * 1000;
    const third = await service.getCurrentAQI(51.5074, -0.1278);
    expect(third.aqi).toBe(120);
    expect(fetchCalls).toBe(2);

    const stats = service.getCacheStats().current;
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(2);
    expect(stats.ttlMs).toBe(10 * 60 * 1000);
    expect(stats.maxEntries).toBe(100);
  });

  it('enforces 100-entry LRU eviction order when cache capacity is exceeded', () => {
    const cache = new LRUCache<number>(100, 10 * 60 * 1000, () => 1_000);

    for (let i = 0; i < 100; i++) {
      cache.set(`key-${i}`, i);
    }

    // Touch key-0 so key-1 becomes the least recently used
    expect(cache.get('key-0')).toBe(0);

    // Inserting 101st item evicts key-1 (LRU), NOT key-0
    cache.set('key-100', 100);

    expect(cache.get('key-0')).toBe(0);
    expect(cache.get('key-1')).toBeUndefined();
    expect(cache.get('key-100')).toBe(100);
    expect(cache.stats().size).toBe(100);
    expect(cache.stats().evictions).toBe(1);
  });

  it('retries transient 5xx/network errors with exponential backoff and redacts tokens in logs', async () => {
    const delays: number[] = [];
    const logger = createSilentLogger();
    let waqiAttempts = 0;

    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('api.waqi.info')) {
        waqiAttempts += 1;
        if (waqiAttempts < 3) {
          return jsonResponse({ error: 'temporary outage' }, 503);
        }
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

    // Verify API token never leaks in warning logs
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
      if (url.includes('api.openaq.org')) {
        return jsonResponse(makeOpenAqPayload({ pm25: 22 }));
      }
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

    // First call triggers WAQI 429 cooldown and falls back to OpenAQ
    const first = await service.getCurrentAQI(28.61, 77.21);
    expect(first.source).toBe('OpenAQ');
    expect(waqiCalls).toBe(1);

    // Second call (different coordinate) during 30s cooldown skips WAQI without calling fetch
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
        // Offline station with "-" AQI and empty iaqi
        return jsonResponse({ status: 'ok', data: { aqi: '-', iaqi: {} } }, 200);
      }
      if (url.includes('api.openaq.org')) {
        // Invalid negative pollutant reading
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

  it('fetches forecast from WAQI and falls back to OpenWeather forecast when WAQI is unavailable', async () => {
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

    // Clear cache and force WAQI failure to verify OpenWeather forecast fallback
    service.clearCache();
    waqiHealthy = false;
    const owmForecast = await service.getForecast(28.6139, 77.209);
    expect(owmForecast).toHaveLength(1);
    expect(owmForecast[0]?.source).toBe('OpenWeather');
    expect(owmForecast[0]?.aqi).toBeGreaterThan(100);
  });

  it('circuit-breaks retired HTTP 410 Gone endpoints silently and skips them on subsequent requests', async () => {
    const logger = createSilentLogger();
    let openAqCalls = 0;

    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('api.waqi.info')) {
        return jsonResponse(makeWaqiPayload({ aqi: 92, pm25: 31.5 }));
      }
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

    // Subsequent call for different coordinates skips the retired OpenAQ endpoint immediately
    const second = await service.getCurrentAQI(12.9716, 77.5946);
    expect(second.source).toBe('WAQI+OpenWeather');
    expect(openAqCalls).toBe(1);
    expect(logger.warns).toHaveLength(0);
    expect(logger.errors).toHaveLength(0);
  });
});

describe('Express Routes — /api/aqi/*', () => {
  it('serves GET /api/aqi/current, /forecast, /sources and enforces validation & rate limits', async () => {
    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('api.waqi.info'))
        return jsonResponse(makeWaqiPayload({ aqi: 132, pm25: 48 }));
      if (url.includes('api.openaq.org')) return jsonResponse(makeOpenAqPayload({ pm25: 46 }));
      if (url.includes('api.openweathermap.org'))
        return jsonResponse(makeOpenWeatherPayload({ pm25: 47 }));
      return jsonResponse({}, 404);
    });

    const service = new AQIService({
      waqiToken: 'test-waqi-token',
      openWeatherApiKey: 'test-owm-key',
      fetchFn: mockFetch as unknown as typeof fetch,
      sleep: async () => undefined,
      logger: createSilentLogger(),
    });

    const router = createAqiRouter(service, { maxRequests: 10, windowMs: 60_000 });
    const server = await startTestServer(router);

    try {
      // 1. Valid current AQI request with persona
      const currentRes = await fetch(
        `${server.baseUrl}/api/aqi/current?lat=28.6139&lng=77.209&persona=asthmatics`,
      );
      expect(currentRes.status).toBe(200);
      expect(currentRes.headers.get('x-ratelimit-limit')).toBe('10');
      const currentJson = (await currentRes.json()) as {
        data: { aqi: number; source: string; provenance: unknown[] };
        aqiSummary: { category: string; persona: string; recommendation: string; color: string };
      };
      expect(currentJson.data.source).toBe('WAQI+OpenAQ+OpenWeather');
      expect(currentJson.data.provenance).toHaveLength(3);
      expect(currentJson.aqiSummary.persona).toBe('asthmatics');
      expect(currentJson.aqiSummary.recommendation.toLowerCase()).toContain('asthma');

      // 2. Valid forecast request (also verifying `lon` alias)
      const forecastRes = await fetch(`${server.baseUrl}/api/aqi/forecast?lat=28.6139&lon=77.209`);
      expect(forecastRes.status).toBe(200);
      const forecastJson = (await forecastRes.json()) as {
        count: number;
        forecast: Array<{ source: string }>;
      };
      expect(forecastJson.count).toBe(2);
      expect(forecastJson.forecast[0]?.source).toBe('WAQI');

      // 3. Sources diagnostics endpoint
      const sourcesRes = await fetch(`${server.baseUrl}/api/aqi/sources`);
      expect(sourcesRes.status).toBe(200);
      const sourcesJson = (await sourcesRes.json()) as {
        sources: Array<{ name: string; configured: boolean }>;
        cache: { current: { size: number } };
      };
      expect(sourcesJson.sources.map((s) => s.name)).toEqual(['WAQI', 'OpenAQ', 'OpenWeather']);
      expect(sourcesJson.cache.current.size).toBe(1);

      // 4. Invalid coordinates & invalid persona return 400
      const badCoordsRes = await fetch(`${server.baseUrl}/api/aqi/current?lat=120&lng=77`);
      expect(badCoordsRes.status).toBe(400);

      const badPersonaRes = await fetch(
        `${server.baseUrl}/api/aqi/current?lat=28.6&lng=77.2&persona=invalid`,
      );
      expect(badPersonaRes.status).toBe(400);
    } finally {
      await server.close();
    }
  });

  it('returns 503 when all upstream sources fail and 429 when client rate limit is exceeded', async () => {
    const failingFetch = vi.fn(async () => jsonResponse({ error: 'down' }, 503));
    const service = new AQIService({
      waqiToken: 'test-waqi-token',
      openWeatherApiKey: 'test-owm-key',
      fetchFn: failingFetch as unknown as typeof fetch,
      sleep: async () => undefined,
      logger: createSilentLogger(),
      maxRetries: 0,
    });

    const router = createAqiRouter(service, { maxRequests: 2, windowMs: 60_000 });
    const server = await startTestServer(router);

    try {
      const first = await fetch(`${server.baseUrl}/api/aqi/current?lat=28.6&lng=77.2`);
      expect(first.status).toBe(503);

      const second = await fetch(`${server.baseUrl}/api/aqi/forecast?lat=28.6&lng=77.2`);
      expect(second.status).toBe(503);

      // 3rd request within window hits rate limit
      const third = await fetch(`${server.baseUrl}/api/aqi/sources`);
      expect(third.status).toBe(429);
      expect(third.headers.get('retry-after')).toBeTruthy();
    } finally {
      await server.close();
    }
  });

  it('exposes accurate source configuration status when tokens are omitted', () => {
    const service = new AQIService({
      waqiToken: '',
      openWeatherApiKey: '',
      logger: createSilentLogger(),
    });
    const statuses = service.getSourceStatuses();
    expect(statuses.find((s) => s.name === 'WAQI')?.configured).toBe(false);
    expect(statuses.find((s) => s.name === 'OpenAQ')?.configured).toBe(true);
    expect(statuses.find((s) => s.name === 'OpenWeather')?.configured).toBe(false);
  });

  it('resets both current and forecast caches cleanly when clearCache is invoked', async () => {
    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('api.waqi.info')) {
        return jsonResponse(makeWaqiPayload({ aqi: 84, includeForecast: true }));
      }
      return jsonResponse({ results: [] }, 200);
    });

    const service = new AQIService({
      waqiToken: 'test-waqi-token',
      openWeatherApiKey: '',
      strategy: 'fallback',
      fetchFn: mockFetch as unknown as typeof fetch,
      sleep: async () => undefined,
      logger: createSilentLogger(),
    });

    await service.getCurrentAQI(40.7128, -74.006);
    await service.getForecast(40.7128, -74.006);
    expect(service.getCacheStats().current.size).toBe(1);
    expect(service.getCacheStats().forecast.size).toBe(1);

    service.clearCache();
    expect(service.getCacheStats().current.size).toBe(0);
    expect(service.getCacheStats().forecast.size).toBe(0);
  });
});
