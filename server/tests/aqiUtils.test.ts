import { describe, expect, it } from 'vitest';
import type { HourlyPoint } from '../src/types/airQuality';
import {
  calculatePm10Aqi,
  calculatePm25Aqi,
  classifyAqi,
  computeCompositeAqi,
  computeWhoRatio,
  findBestOutdoorWindow,
} from '../src/utils/aqi';

describe('Server EPA AQI utility calculations', () => {
  it('maps 2024 EPA PM2.5 breakpoints accurately', () => {
    expect(calculatePm25Aqi(0)).toBe(0);
    expect(calculatePm25Aqi(9.0)).toBe(50);
    expect(calculatePm25Aqi(35.4)).toBe(100);
    expect(calculatePm25Aqi(55.4)).toBe(150);
    expect(calculatePm25Aqi(125.4)).toBe(200);
    expect(calculatePm25Aqi(600)).toBe(500);
  });

  it('handles negative and boundary PM10 inputs safely', () => {
    expect(calculatePm10Aqi(-10)).toBe(0);
    expect(calculatePm10Aqi(54)).toBe(50);
    expect(calculatePm10Aqi(154)).toBe(100);
  });

  it('picks the highest sub-index and dominant pollutant', () => {
    const pm25Dominant = computeCompositeAqi({
      pm25: 48.2,
      pm10: 52.0,
      no2: 38.0,
      o3: 64.0,
      so2: 9.0,
      co: 410,
    });
    expect(pm25Dominant.dominantPollutant).toBe('PM2.5');
    expect(pm25Dominant.aqi).toBeGreaterThanOrEqual(130);
    expect(pm25Dominant.aqi).toBeLessThanOrEqual(140);

    const o3Dominant = computeCompositeAqi({
      pm25: 6.1,
      pm10: 14.0,
      no2: 18.0,
      o3: 155.0,
      so2: 3.0,
      co: 210,
    });
    expect(o3Dominant.dominantPollutant).toBe('O3');
    expect(o3Dominant.aqi).toBeGreaterThan(100);
  });

  it('returns accurate EPA categories across full 0-500 scale', () => {
    expect(classifyAqi(28).key).toBe('good');
    expect(classifyAqi(76).key).toBe('moderate');
    expect(classifyAqi(124).key).toBe('sensitive');
    expect(classifyAqi(178).key).toBe('unhealthy');
    expect(classifyAqi(245).key).toBe('very_unhealthy');
    expect(classifyAqi(360).key).toBe('hazardous');
  });

  it('calculates WHO multiplier against 15 µg/m³ 24h guideline', () => {
    expect(computeWhoRatio(15)).toBe(1.0);
    expect(computeWhoRatio(30)).toBe(2.0);
    expect(computeWhoRatio(7.5)).toBe(0.5);
  });

  it('locates the cleanest 3-hour outdoor window', () => {
    const sample: HourlyPoint[] = [
      {
        hourLabel: '00:00',
        isoTime: '2026-11-19T00:00:00Z',
        aqi: 82,
        pm25: 25,
        pm10: 40,
        no2: 30,
        o3: 40,
      },
      {
        hourLabel: '01:00',
        isoTime: '2026-11-19T01:00:00Z',
        aqi: 42,
        pm25: 8,
        pm10: 18,
        no2: 14,
        o3: 32,
      },
      {
        hourLabel: '02:00',
        isoTime: '2026-11-19T02:00:00Z',
        aqi: 38,
        pm25: 7,
        pm10: 16,
        no2: 12,
        o3: 30,
      },
      {
        hourLabel: '03:00',
        isoTime: '2026-11-19T03:00:00Z',
        aqi: 40,
        pm25: 7.5,
        pm10: 17,
        no2: 13,
        o3: 31,
      },
      {
        hourLabel: '04:00',
        isoTime: '2026-11-19T04:00:00Z',
        aqi: 95,
        pm25: 32,
        pm10: 55,
        no2: 44,
        o3: 52,
      },
    ];
    expect(findBestOutdoorWindow(sample)).toBe('01:00 – 03:00');
  });
});
