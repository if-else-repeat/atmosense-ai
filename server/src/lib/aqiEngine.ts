/**
 * @module aqiEngine
 * Deterministic, pure TypeScript air quality calculation engine supporting
 * US EPA (PM2.5, NO2, CO, O3) and CPCB Indian NAQI (PM10) sub-index standards.
 */

import {
  CO_EPA_PPM_BREAKPOINTS,
  CO_MG_M3_PER_PPM,
  NO2_EPA_BREAKPOINTS,
  O3_EPA_PPM_BREAKPOINTS,
  PM10_CPCB_BREAKPOINTS,
  PM25_BREAKPOINTS,
  assertNonNegativeFinite,
  interpolateSubIndex,
  truncateToDecimals,
} from './aqiBreakpoints.ts';
import {
  getAQIColor,
  getHealthRecommendation,
  resolveCategoryLabel,
  type AQICategoryLabel,
  type PersonaProfile,
} from './aqiGuidance.ts';

export { getAQIColor, getHealthRecommendation };
export type { AQICategoryLabel, PersonaProfile };

/** Supported pollutant identifiers. */
export type PollutantType = 'pm25' | 'pm10' | 'no2' | 'co' | 'o3';

/** Input concentration readings for composite AQI calculation. */
export interface PollutantReadings {
  pm25?: number;
  pm10?: number;
  no2?: number;
  co?: number;
  o3?: number;
}

/** Composite AQI calculation result with category classification and UI color. */
export interface AQICategory {
  aqi: number;
  category: AQICategoryLabel;
  dominantPollutant: PollutantType;
  subIndices: Partial<Record<PollutantType, number>>;
  color: string;
}

/** Calculates the US EPA PM2.5 AQI sub-index using piecewise linear interpolation. */
export function calculatePM25SubIndex(pm25: number): number {
  assertNonNegativeFinite(pm25, 'pm25');
  return interpolateSubIndex(truncateToDecimals(pm25, 1), PM25_BREAKPOINTS);
}

/** Calculates the PM10 AQI sub-index using India CPCB NAQI standards. */
export function calculatePM10SubIndex(pm10: number): number {
  assertNonNegativeFinite(pm10, 'pm10');
  return interpolateSubIndex(truncateToDecimals(pm10, 0), PM10_CPCB_BREAKPOINTS);
}

/** Calculates the US EPA NO2 AQI sub-index from 1-hour concentration in ppb. */
export function calculateNO2SubIndex(no2: number): number {
  assertNonNegativeFinite(no2, 'no2');
  return interpolateSubIndex(truncateToDecimals(no2, 0), NO2_EPA_BREAKPOINTS);
}

/** Calculates the US EPA CO AQI sub-index from 8-hour concentration in mg/m³. */
export function calculateCOSubIndex(co: number): number {
  assertNonNegativeFinite(co, 'co');
  return interpolateSubIndex(truncateToDecimals(co / CO_MG_M3_PER_PPM, 1), CO_EPA_PPM_BREAKPOINTS);
}

/** Calculates the US EPA Ozone (O3) AQI sub-index from 8-hour concentration in ppm. */
export function calculateO3SubIndex(o3: number): number {
  assertNonNegativeFinite(o3, 'o3');
  return interpolateSubIndex(truncateToDecimals(o3, 3), O3_EPA_PPM_BREAKPOINTS);
}

/** Calculates the composite Air Quality Index from one or more pollutant readings. */
export function calculateAQI(pollutants: PollutantReadings): AQICategory {
  if (!pollutants || typeof pollutants !== 'object' || Array.isArray(pollutants)) {
    throw new RangeError('pollutants must be a non-null PollutantReadings object.');
  }

  const calculators: ReadonlyArray<{ key: PollutantType; calc: (val: number) => number }> = [
    { key: 'pm25', calc: calculatePM25SubIndex },
    { key: 'pm10', calc: calculatePM10SubIndex },
    { key: 'no2', calc: calculateNO2SubIndex },
    { key: 'co', calc: calculateCOSubIndex },
    { key: 'o3', calc: calculateO3SubIndex },
  ];

  const subIndices: Partial<Record<PollutantType, number>> = {};
  let maxAqi = -1;
  let dominantPollutant: PollutantType | null = null;

  for (const { key, calc } of calculators) {
    if (Object.prototype.hasOwnProperty.call(pollutants, key)) {
      const value = pollutants[key];
      if (value === undefined) continue;
      const subIndex = calc(value);
      subIndices[key] = subIndex;
      if (subIndex > maxAqi) {
        maxAqi = subIndex;
        dominantPollutant = key;
      }
    }
  }

  if (dominantPollutant === null || maxAqi < 0) {
    throw new RangeError(
      'pollutants must include at least one defined numeric pollutant measurement (pm25, pm10, no2, co, or o3).',
    );
  }

  const boundedAqi = Math.min(500, Math.max(0, maxAqi));
  return {
    aqi: boundedAqi,
    category: resolveCategoryLabel(boundedAqi),
    dominantPollutant,
    subIndices,
    color: getAQIColor(boundedAqi),
  };
}
