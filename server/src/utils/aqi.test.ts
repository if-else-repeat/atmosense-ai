import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePm25Aqi,
  calculatePm10Aqi,
  classifyAqi,
  computeCompositeAqi,
  computeWhoRatio,
  findBestOutdoorWindow,
} from './aqi';
import type { HourlyPoint } from '../types/airQuality';

test('calculatePm25Aqi maps 2024 EPA PM2.5 breakpoints accurately', () => {
  assert.equal(calculatePm25Aqi(0), 0);
  assert.equal(calculatePm25Aqi(9.0), 50);
  assert.equal(calculatePm25Aqi(35.4), 100);
  assert.equal(calculatePm25Aqi(55.4), 150);
  assert.equal(calculatePm25Aqi(125.4), 200);
  assert.equal(calculatePm25Aqi(600), 500);
});

test('calculatePm10Aqi handles negative and boundary inputs safely', () => {
  assert.equal(calculatePm10Aqi(-10), 0);
  assert.equal(calculatePm10Aqi(54), 50);
  assert.equal(calculatePm10Aqi(154), 100);
});

test('computeCompositeAqi picks the highest sub-index and dominant pollutant', () => {
  const pm25Dominant = computeCompositeAqi({
    pm25: 48.2,
    pm10: 52.0,
    no2: 38.0,
    o3: 64.0,
    so2: 9.0,
    co: 410,
  });
  assert.equal(pm25Dominant.dominantPollutant, 'PM2.5');
  assert.ok(pm25Dominant.aqi >= 130 && pm25Dominant.aqi <= 140);

  const o3Dominant = computeCompositeAqi({
    pm25: 6.1,
    pm10: 14.0,
    no2: 18.0,
    o3: 155.0,
    so2: 3.0,
    co: 210,
  });
  assert.equal(o3Dominant.dominantPollutant, 'O3');
  assert.ok(o3Dominant.aqi > 100);
});

test('classifyAqi returns accurate EPA categories across full 0-500 scale', () => {
  assert.equal(classifyAqi(28).key, 'good');
  assert.equal(classifyAqi(76).key, 'moderate');
  assert.equal(classifyAqi(124).key, 'sensitive');
  assert.equal(classifyAqi(178).key, 'unhealthy');
  assert.equal(classifyAqi(245).key, 'very_unhealthy');
  assert.equal(classifyAqi(360).key, 'hazardous');
});

test('computeWhoRatio calculates multiplier against 15 µg/m³ WHO 24h guideline', () => {
  assert.equal(computeWhoRatio(15), 1.0);
  assert.equal(computeWhoRatio(30), 2.0);
  assert.equal(computeWhoRatio(7.5), 0.5);
});

test('findBestOutdoorWindow locates the cleanest 3-hour window', () => {
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
  assert.equal(findBestOutdoorWindow(sample), '01:00 – 03:00');
});
