import { describe, expect, it } from 'vitest';
import {
  calculateAQI,
  calculateCOSubIndex,
  calculateNO2SubIndex,
  calculateO3SubIndex,
  calculatePM10SubIndex,
  calculatePM25SubIndex,
  getAQIColor,
  getHealthRecommendation,
  type PersonaProfile,
  type PollutantReadings,
} from '../src/lib/aqiEngine';

describe('calculatePM25SubIndex (EPA piecewise linear interpolation)', () => {
  it('returns 0 at 0 µg/m³', () => {
    expect(calculatePM25SubIndex(0)).toBe(0);
  });

  it('matches exact EPA upper and lower breakpoint boundaries', () => {
    expect(calculatePM25SubIndex(12.0)).toBe(50);
    expect(calculatePM25SubIndex(12.1)).toBe(51);
    expect(calculatePM25SubIndex(35.4)).toBe(100);
    expect(calculatePM25SubIndex(35.5)).toBe(101);
    expect(calculatePM25SubIndex(55.4)).toBe(150);
    expect(calculatePM25SubIndex(55.5)).toBe(151);
    expect(calculatePM25SubIndex(150.4)).toBe(200);
    expect(calculatePM25SubIndex(150.5)).toBe(201);
    expect(calculatePM25SubIndex(250.4)).toBe(300);
    expect(calculatePM25SubIndex(250.5)).toBe(301);
    expect(calculatePM25SubIndex(500.0)).toBe(500);
  });

  it('interpolates midpoints accurately within segments', () => {
    expect(calculatePM25SubIndex(6.0)).toBe(25);
    expect(calculatePM25SubIndex(23.75)).toBe(75);
    expect(calculatePM25SubIndex(45.45)).toBe(125);
    expect(calculatePM25SubIndex(102.95)).toBe(175);
    expect(calculatePM25SubIndex(200.45)).toBe(250);
  });

  it('truncates PM2.5 to 1 decimal place before interpolating', () => {
    expect(calculatePM25SubIndex(12.09)).toBe(50);
    expect(calculatePM25SubIndex(35.49)).toBe(100);
  });

  it('caps values exceeding 500 µg/m³ at 500', () => {
    expect(calculatePM25SubIndex(750)).toBe(500);
  });

  it('throws RangeError for negative, NaN, Infinity, or undefined inputs', () => {
    expect(() => calculatePM25SubIndex(-0.1)).toThrow(RangeError);
    expect(() => calculatePM25SubIndex(Number.NaN)).toThrow(RangeError);
    expect(() => calculatePM25SubIndex(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => calculatePM25SubIndex(Number.NEGATIVE_INFINITY)).toThrow(RangeError);
    expect(() => calculatePM25SubIndex(undefined as unknown as number)).toThrow(RangeError);
  });
});

describe('calculatePM10SubIndex (CPCB Indian NAQI standards)', () => {
  it('matches exact CPCB breakpoint boundaries', () => {
    expect(calculatePM10SubIndex(0)).toBe(0);
    expect(calculatePM10SubIndex(50)).toBe(50);
    expect(calculatePM10SubIndex(51)).toBe(51);
    expect(calculatePM10SubIndex(100)).toBe(100);
    expect(calculatePM10SubIndex(101)).toBe(101);
    expect(calculatePM10SubIndex(250)).toBe(200);
    expect(calculatePM10SubIndex(251)).toBe(201);
    expect(calculatePM10SubIndex(350)).toBe(300);
    expect(calculatePM10SubIndex(351)).toBe(301);
    expect(calculatePM10SubIndex(430)).toBe(400);
    expect(calculatePM10SubIndex(431)).toBe(401);
    expect(calculatePM10SubIndex(600)).toBe(500);
  });

  it('interpolates intermediate CPCB PM10 concentrations accurately', () => {
    expect(calculatePM10SubIndex(25)).toBe(25);
    expect(calculatePM10SubIndex(175)).toBe(150);
    expect(calculatePM10SubIndex(300)).toBe(250);
    expect(calculatePM10SubIndex(390)).toBe(350);
  });

  it('caps extreme dust concentrations above 600 µg/m³ at 500', () => {
    expect(calculatePM10SubIndex(950)).toBe(500);
  });

  it('throws RangeError for invalid PM10 inputs', () => {
    expect(() => calculatePM10SubIndex(-5)).toThrow(RangeError);
    expect(() => calculatePM10SubIndex(Number.NaN)).toThrow(RangeError);
    expect(() => calculatePM10SubIndex(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => calculatePM10SubIndex(undefined as unknown as number)).toThrow(RangeError);
  });
});

describe('calculateNO2SubIndex (EPA 1-hour ppb breakpoints)', () => {
  it('matches exact EPA NO2 breakpoint boundaries', () => {
    expect(calculateNO2SubIndex(0)).toBe(0);
    expect(calculateNO2SubIndex(53)).toBe(50);
    expect(calculateNO2SubIndex(54)).toBe(51);
    expect(calculateNO2SubIndex(100)).toBe(100);
    expect(calculateNO2SubIndex(101)).toBe(101);
    expect(calculateNO2SubIndex(360)).toBe(150);
    expect(calculateNO2SubIndex(361)).toBe(151);
    expect(calculateNO2SubIndex(649)).toBe(200);
    expect(calculateNO2SubIndex(650)).toBe(201);
    expect(calculateNO2SubIndex(1249)).toBe(300);
    expect(calculateNO2SubIndex(1250)).toBe(301);
    expect(calculateNO2SubIndex(1649)).toBe(400);
    expect(calculateNO2SubIndex(1650)).toBe(401);
    expect(calculateNO2SubIndex(2049)).toBe(500);
  });

  it('interpolates intermediate NO2 values and caps values above 2049 ppb', () => {
    expect(calculateNO2SubIndex(27)).toBe(25);
    expect(calculateNO2SubIndex(77)).toBe(76);
    expect(calculateNO2SubIndex(2500)).toBe(500);
  });

  it('throws RangeError for invalid NO2 inputs', () => {
    expect(() => calculateNO2SubIndex(-1)).toThrow(RangeError);
    expect(() => calculateNO2SubIndex(Number.NaN)).toThrow(RangeError);
    expect(() => calculateNO2SubIndex(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => calculateNO2SubIndex(undefined as unknown as number)).toThrow(RangeError);
  });
});

describe('calculateCOSubIndex (EPA 8-hour mg/m³)', () => {
  it('returns 0 at 0 mg/m³', () => {
    expect(calculateCOSubIndex(0)).toBe(0);
  });

  it('converts mg/m³ to ppm and matches EPA CO breakpoints', () => {
    // 4.4 ppm * 1.145 = 5.038 mg/m³
    expect(calculateCOSubIndex(5.04)).toBe(50);
    // 9.4 ppm * 1.145 = 10.763 mg/m³
    expect(calculateCOSubIndex(10.77)).toBe(100);
    // 12.4 ppm * 1.145 = 14.198 mg/m³
    expect(calculateCOSubIndex(14.2)).toBe(150);
    // 15.4 ppm * 1.145 = 17.633 mg/m³
    expect(calculateCOSubIndex(17.64)).toBe(200);
    // 30.4 ppm * 1.145 = 34.808 mg/m³
    expect(calculateCOSubIndex(34.82)).toBe(300);
    // 50.4 ppm * 1.145 = 57.708 mg/m³
    expect(calculateCOSubIndex(57.8)).toBe(500);
  });

  it('interpolates mid-range CO concentrations and caps extreme values', () => {
    // 2.2 ppm * 1.145 ≈ 2.52 mg/m³ -> AQI 25
    expect(calculateCOSubIndex(2.55)).toBe(25);
    expect(calculateCOSubIndex(100)).toBe(500);
  });

  it('throws RangeError for invalid CO inputs', () => {
    expect(() => calculateCOSubIndex(-2)).toThrow(RangeError);
    expect(() => calculateCOSubIndex(Number.NaN)).toThrow(RangeError);
    expect(() => calculateCOSubIndex(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => calculateCOSubIndex(undefined as unknown as number)).toThrow(RangeError);
  });
});

describe('calculateO3SubIndex (EPA 8-hour ppm)', () => {
  it('matches exact EPA O3 breakpoint boundaries', () => {
    expect(calculateO3SubIndex(0)).toBe(0);
    expect(calculateO3SubIndex(0.054)).toBe(50);
    expect(calculateO3SubIndex(0.055)).toBe(51);
    expect(calculateO3SubIndex(0.07)).toBe(100);
    expect(calculateO3SubIndex(0.071)).toBe(101);
    expect(calculateO3SubIndex(0.085)).toBe(150);
    expect(calculateO3SubIndex(0.086)).toBe(151);
    expect(calculateO3SubIndex(0.105)).toBe(200);
    expect(calculateO3SubIndex(0.106)).toBe(201);
    expect(calculateO3SubIndex(0.2)).toBe(300);
    expect(calculateO3SubIndex(0.201)).toBe(301);
    expect(calculateO3SubIndex(0.604)).toBe(500);
  });

  it('truncates O3 to 3 decimal places and caps extreme values at 500', () => {
    expect(calculateO3SubIndex(0.0549)).toBe(50);
    expect(calculateO3SubIndex(0.027)).toBe(25);
    expect(calculateO3SubIndex(0.9)).toBe(500);
  });

  it('throws RangeError for invalid O3 inputs', () => {
    expect(() => calculateO3SubIndex(-0.01)).toThrow(RangeError);
    expect(() => calculateO3SubIndex(Number.NaN)).toThrow(RangeError);
    expect(() => calculateO3SubIndex(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => calculateO3SubIndex(undefined as unknown as number)).toThrow(RangeError);
  });
});

describe('calculateAQI (composite AQI & category resolution)', () => {
  it('selects the maximum sub-index and dominant pollutant across all 5 pollutants', () => {
    const result = calculateAQI({
      pm25: 10.0, // ~42
      pm10: 60, // 60
      no2: 40, // 38
      co: 2.0, // ~19
      o3: 0.08, // 133
    });

    expect(result.dominantPollutant).toBe('o3');
    expect(result.aqi).toBe(133);
    expect(result.category).toBe('Unhealthy for Sensitive Groups');
    expect(result.color).toBe('#EA580C');
    expect(result.subIndices.o3).toBe(133);
    expect(result.subIndices.pm10).toBe(60);
  });

  it('classifies Good (0-50) correctly', () => {
    const res = calculateAQI({ pm25: 8.5, pm10: 30 });
    expect(res.aqi).toBe(35);
    expect(res.category).toBe('Good');
    expect(res.dominantPollutant).toBe('pm25');
  });

  it('classifies Moderate (51-100) correctly', () => {
    const res = calculateAQI({ pm25: 25.0 });
    expect(res.aqi).toBeGreaterThanOrEqual(51);
    expect(res.aqi).toBeLessThanOrEqual(100);
    expect(res.category).toBe('Moderate');
  });

  it('classifies Unhealthy (151-200) correctly', () => {
    const res = calculateAQI({ pm25: 100.0 });
    expect(res.aqi).toBeGreaterThanOrEqual(151);
    expect(res.aqi).toBeLessThanOrEqual(200);
    expect(res.category).toBe('Unhealthy');
  });

  it('classifies Very Unhealthy (201-300) correctly', () => {
    const res = calculateAQI({ pm10: 320 });
    expect(res.aqi).toBeGreaterThanOrEqual(201);
    expect(res.aqi).toBeLessThanOrEqual(300);
    expect(res.category).toBe('Very Unhealthy');
    expect(res.dominantPollutant).toBe('pm10');
  });

  it('classifies Hazardous (301-500) correctly', () => {
    const res = calculateAQI({ pm25: 350.0, no2: 50 });
    expect(res.aqi).toBeGreaterThanOrEqual(301);
    expect(res.aqi).toBeLessThanOrEqual(500);
    expect(res.category).toBe('Hazardous');
  });

  it('ignores explicitly undefined optional pollutant keys when other readings exist', () => {
    const res = calculateAQI({ pm25: 12.0, pm10: undefined, no2: undefined });
    expect(res.aqi).toBe(50);
    expect(res.dominantPollutant).toBe('pm25');
    expect(res.subIndices).toEqual({ pm25: 50 });
  });

  it('is pure and deterministic without mutating input objects', () => {
    const readings: PollutantReadings = Object.freeze({ pm25: 42.1, pm10: 110, no2: 88 });
    const first = calculateAQI(readings);
    const second = calculateAQI(readings);
    expect(first).toEqual(second);
  });

  it('throws RangeError for empty, null, undefined, or invalid pollutant payloads', () => {
    expect(() => calculateAQI({})).toThrow(RangeError);
    expect(() => calculateAQI({ pm25: undefined })).toThrow(RangeError);
    expect(() => calculateAQI(null as unknown as PollutantReadings)).toThrow(RangeError);
    expect(() => calculateAQI(undefined as unknown as PollutantReadings)).toThrow(RangeError);
    expect(() => calculateAQI({ pm25: -3 })).toThrow(RangeError);
    expect(() => calculateAQI({ no2: Number.NaN })).toThrow(RangeError);
    expect(() => calculateAQI({ o3: Number.POSITIVE_INFINITY })).toThrow(RangeError);
  });
});

describe('getHealthRecommendation', () => {
  const personas: readonly PersonaProfile[] = ['children', 'elderly', 'asthmatics', 'general'];
  const sampleAqis = [25, 75, 125, 175, 250, 420] as const;

  it('returns distinct persona-specific advice within every AQI tier', () => {
    for (const aqi of sampleAqis) {
      const recommendations = personas.map((p) => getHealthRecommendation(aqi, p));
      expect(new Set(recommendations).size).toBe(personas.length);
      for (const rec of recommendations) {
        expect(rec.length).toBeGreaterThan(20);
      }
    }
  });

  it('escalates guidance appropriately across AQI bands for asthmatics', () => {
    const good = getHealthRecommendation(30, 'asthmatics');
    const hazardous = getHealthRecommendation(350, 'asthmatics');
    expect(good).not.toBe(hazardous);
    expect(hazardous.toLowerCase()).toContain('hepa');
  });

  it('mentions child-relevant guidance for children persona', () => {
    const rec = getHealthRecommendation(180, 'children');
    expect(rec.toLowerCase()).toMatch(/indoors|playground|physical education/);
  });

  it('mentions elderly-relevant guidance for elderly persona', () => {
    const rec = getHealthRecommendation(260, 'elderly');
    expect(rec.toLowerCase()).toMatch(/indoors|purification|clinician/);
  });

  it('throws RangeError for negative, NaN, Infinity AQI or invalid persona', () => {
    expect(() => getHealthRecommendation(-1, 'general')).toThrow(RangeError);
    expect(() => getHealthRecommendation(Number.NaN, 'children')).toThrow(RangeError);
    expect(() => getHealthRecommendation(Number.POSITIVE_INFINITY, 'elderly')).toThrow(RangeError);
    expect(() => getHealthRecommendation(undefined as unknown as number, 'general')).toThrow(
      RangeError,
    );
    expect(() => getHealthRecommendation(50, 'unknown' as PersonaProfile)).toThrow(RangeError);
    expect(() => getHealthRecommendation(50, undefined as unknown as PersonaProfile)).toThrow(
      RangeError,
    );
  });
});

describe('getAQIColor', () => {
  it('returns valid 6-digit hex colors across all 6 AQI categories', () => {
    expect(getAQIColor(0)).toBe('#16A34A');
    expect(getAQIColor(50)).toBe('#16A34A');
    expect(getAQIColor(51)).toBe('#D97706');
    expect(getAQIColor(100)).toBe('#D97706');
    expect(getAQIColor(101)).toBe('#EA580C');
    expect(getAQIColor(150)).toBe('#EA580C');
    expect(getAQIColor(151)).toBe('#DC2626');
    expect(getAQIColor(200)).toBe('#DC2626');
    expect(getAQIColor(201)).toBe('#7E22CE');
    expect(getAQIColor(300)).toBe('#7E22CE');
    expect(getAQIColor(301)).toBe('#7F1D1D');
    expect(getAQIColor(500)).toBe('#7F1D1D');
  });

  it('always returns a strict #RRGGBB hex string', () => {
    for (const aqi of [0, 42, 88, 140, 190, 275, 450]) {
      expect(getAQIColor(aqi)).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('throws RangeError for negative, NaN, Infinity, or undefined AQI', () => {
    expect(() => getAQIColor(-10)).toThrow(RangeError);
    expect(() => getAQIColor(Number.NaN)).toThrow(RangeError);
    expect(() => getAQIColor(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => getAQIColor(undefined as unknown as number)).toThrow(RangeError);
  });
});
