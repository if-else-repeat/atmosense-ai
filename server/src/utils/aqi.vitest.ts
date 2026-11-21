import { describe, expect, it } from 'vitest';
import { calculatePm25Aqi, classifyAqi, computeCompositeAqi } from './aqi';

describe('Server EPA AQI calculations (Vitest)', () => {
  it('computes PM2.5 AQI breakpoints and categories', () => {
    expect(calculatePm25Aqi(9.0)).toBe(50);
    expect(classifyAqi(50).key).toBe('good');
    expect(classifyAqi(125).key).toBe('sensitive');
  });

  it('determines dominant pollutant accurately', () => {
    const result = computeCompositeAqi({
      pm25: 42,
      pm10: 50,
      no2: 30,
      o3: 55,
      so2: 5,
      co: 300,
    });
    expect(result.dominantPollutant).toBe('PM2.5');
    expect(result.aqi).toBeGreaterThan(100);
  });
});
