import { describe, expect, it, vi } from 'vitest';
import { createAqiRouter } from '../src/routes/aqi';
import { AQIService, LRUCache, createAQICacheKey } from '../src/services/aqiService';
import {
  createSilentLogger,
  jsonResponse,
  makeOpenAqPayload,
  makeOpenWeatherPayload,
  makeWaqiPayload,
  startAqiTestServer,
} from './helpers/aqiFixtures';

describe('AQIService — SHA-256 LRU Caching & Express /api/aqi/* Routes', () => {
  it('generates deterministic 64-char SHA-256 cache keys normalized by coordinate precision', () => {
    const key1 = createAQICacheKey('current', 28.61391, 77.20901);
    const key2 = createAQICacheKey('current', 28.61394, 77.20904);
    const forecastKey = createAQICacheKey('forecast', 28.61391, 77.20901);

    expect(key1).toMatch(/^[a-f0-9]{64}$/);
    expect(key1).toBe(key2);
    expect(key1).not.toBe(forecastKey);
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

    expect((await service.getCurrentAQI(51.5074, -0.1278)).aqi).toBe(70);
    currentTime += 9 * 60 * 1000;
    expect((await service.getCurrentAQI(51.5074, -0.1278)).aqi).toBe(70);
    expect(fetchCalls).toBe(1);

    currentTime += 2 * 60 * 1000;
    expect((await service.getCurrentAQI(51.5074, -0.1278)).aqi).toBe(120);
    expect(fetchCalls).toBe(2);

    const stats = service.getCacheStats().current;
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(2);
    expect(stats.ttlMs).toBe(10 * 60 * 1000);
    expect(stats.maxEntries).toBe(100);
  });

  it('enforces 100-entry LRU eviction order when cache capacity is exceeded', () => {
    const cache = new LRUCache<number>(100, 10 * 60 * 1000, () => 1_000);
    for (let i = 0; i < 100; i++) cache.set(`key-${i}`, i);
    expect(cache.get('key-0')).toBe(0);
    cache.set('key-100', 100);

    expect(cache.get('key-0')).toBe(0);
    expect(cache.get('key-1')).toBeUndefined();
    expect(cache.get('key-100')).toBe(100);
    expect(cache.stats().size).toBe(100);
    expect(cache.stats().evictions).toBe(1);
  });

  it('exposes accurate source statuses when tokens are omitted and resets caches via clearCache', async () => {
    const unconfigured = new AQIService({
      waqiToken: '',
      openWeatherApiKey: '',
      logger: createSilentLogger(),
    });
    const statuses = unconfigured.getSourceStatuses();
    expect(statuses.find((s) => s.name === 'WAQI')?.configured).toBe(false);
    expect(statuses.find((s) => s.name === 'OpenAQ')?.configured).toBe(true);
    expect(statuses.find((s) => s.name === 'OpenWeather')?.configured).toBe(false);

    const mockFetch = vi.fn(async (input: string | URL | Request) =>
      String(input).includes('api.waqi.info')
        ? jsonResponse(makeWaqiPayload({ aqi: 84, includeForecast: true }))
        : jsonResponse({ results: [] }, 200),
    );
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
    const server = await startAqiTestServer(
      createAqiRouter(service, { maxRequests: 10, windowMs: 60_000 }),
    );

    try {
      const currentRes = await fetch(
        `${server.baseUrl}/api/aqi/current?lat=28.6139&lng=77.209&persona=asthmatics`,
      );
      expect(currentRes.status).toBe(200);
      expect(currentRes.headers.get('x-ratelimit-limit')).toBe('10');
      const currentJson = (await currentRes.json()) as {
        data: { source: string; provenance: unknown[] };
        aqiSummary: { persona: string; recommendation: string };
      };
      expect(currentJson.data.source).toBe('WAQI+OpenAQ+OpenWeather');
      expect(currentJson.data.provenance).toHaveLength(3);
      expect(currentJson.aqiSummary.recommendation.toLowerCase()).toContain('asthma');

      const forecastRes = await fetch(`${server.baseUrl}/api/aqi/forecast?lat=28.6139&lon=77.209`);
      expect(forecastRes.status).toBe(200);
      expect(((await forecastRes.json()) as { count: number }).count).toBe(2);

      const sourcesRes = await fetch(`${server.baseUrl}/api/aqi/sources`);
      expect(sourcesRes.status).toBe(200);
      expect(
        ((await sourcesRes.json()) as { cache: { current: { size: number } } }).cache.current.size,
      ).toBe(1);

      expect((await fetch(`${server.baseUrl}/api/aqi/current?lat=120&lng=77`)).status).toBe(400);
      expect(
        (await fetch(`${server.baseUrl}/api/aqi/current?lat=28.6&lng=77.2&persona=invalid`)).status,
      ).toBe(400);
    } finally {
      await server.close();
    }
  });

  it('returns 503 when all upstream sources fail and 429 when client rate limit is exceeded', async () => {
    const service = new AQIService({
      waqiToken: 'test-waqi-token',
      openWeatherApiKey: 'test-owm-key',
      fetchFn: vi.fn(async () => jsonResponse({ error: 'down' }, 503)) as unknown as typeof fetch,
      sleep: async () => undefined,
      logger: createSilentLogger(),
      maxRetries: 0,
    });
    const server = await startAqiTestServer(
      createAqiRouter(service, { maxRequests: 2, windowMs: 60_000 }),
    );

    try {
      expect((await fetch(`${server.baseUrl}/api/aqi/current?lat=28.6&lng=77.2`)).status).toBe(503);
      expect((await fetch(`${server.baseUrl}/api/aqi/forecast?lat=28.6&lng=77.2`)).status).toBe(
        503,
      );
      const third = await fetch(`${server.baseUrl}/api/aqi/sources`);
      expect(third.status).toBe(429);
      expect(third.headers.get('retry-after')).toBeTruthy();
    } finally {
      await server.close();
    }
  });
});
