import { describe, expect, it, vi } from 'vitest';
import { AQIService } from '../src/services/aqiService';
import {
  createSilentLogger,
  jsonResponse,
  makeOpenAqPayload,
  makeOpenWeatherPayload,
  makeWaqiPayload,
} from './helpers/aqiFixtures';

describe('AQIService — Multi-Source Consensus Fusion & Fallback Chain', () => {
  it('fuses WAQI, OpenAQ, and OpenWeather readings with full provenance when sources agree', async () => {
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
    expect(result.aqi).toBe(100);
    expect(result.location.name).toContain('Connaught Place Monitor');
    expect(result.confidence).toBe(0.85);
    expect(result.provenance).toHaveLength(1);
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
            pm25: 55.4,
            pm10: 90,
            no2Ug: 37.6,
            coUg: 1145,
            o3Ug: 58.8,
            so2Ug: 26.2,
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
    expect(result.aqi).toBeLessThan(115);
    expect(logger.warns.some((w) => w.message.includes('Outlier'))).toBe(true);
  });
});
