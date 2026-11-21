/**
 * @module aqiEngine
 * Deterministic, pure TypeScript air quality calculation engine supporting
 * US EPA (PM2.5, NO2, CO, O3) and CPCB Indian NAQI (PM10) sub-index standards.
 *
 * All exported functions are pure (zero side effects) and strictly validate
 * their inputs, throwing {@link RangeError} for negative, NaN, infinite,
 * missing, or otherwise invalid values.
 */

/** Supported pollutant identifiers. */
export type PollutantType = 'pm25' | 'pm10' | 'no2' | 'co' | 'o3';

/** Standard US EPA 6-tier AQI category names. */
export type AQICategoryLabel =
  | 'Good'
  | 'Moderate'
  | 'Unhealthy for Sensitive Groups'
  | 'Unhealthy'
  | 'Very Unhealthy'
  | 'Hazardous';

/** Supported health guidance personas. */
export type PersonaProfile = 'children' | 'elderly' | 'asthmatics' | 'general';

/**
 * Input concentration readings for composite AQI calculation.
 * At least one pollutant measurement must be provided.
 */
export interface PollutantReadings {
  /** Fine particulate matter PM2.5 in µg/m³ (24-hour average, EPA). */
  pm25?: number;
  /** Coarse particulate matter PM10 in µg/m³ (24-hour average, CPCB India). */
  pm10?: number;
  /** Nitrogen dioxide NO2 in ppb (1-hour average, EPA). */
  no2?: number;
  /** Carbon monoxide CO in mg/m³ (8-hour average, converted to EPA ppm). */
  co?: number;
  /** Ground-level ozone O3 in ppm (8-hour average, EPA). */
  o3?: number;
}

/** Composite AQI calculation result with category classification and UI color. */
export interface AQICategory {
  /** Overall AQI (maximum pollutant sub-index, integer 0–500). */
  aqi: number;
  /** Standard US EPA AQI category label. */
  category: AQICategoryLabel;
  /** Pollutant responsible for the maximum sub-index. */
  dominantPollutant: PollutantType;
  /** Calculated sub-indices for every pollutant provided in the input. */
  subIndices: Partial<Record<PollutantType, number>>;
  /** Accessible hex color (#RRGGBB) corresponding to the AQI tier. */
  color: string;
}

interface Breakpoint {
  readonly cLow: number;
  readonly cHigh: number;
  readonly iLow: number;
  readonly iHigh: number;
}

/**
 * US EPA PM2.5 (µg/m³, 24-hour) piecewise linear breakpoints.
 */
const PM25_BREAKPOINTS: readonly Breakpoint[] = [
  { cLow: 0.0, cHigh: 12.0, iLow: 0, iHigh: 50 },
  { cLow: 12.1, cHigh: 35.4, iLow: 51, iHigh: 100 },
  { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },
  { cLow: 55.5, cHigh: 150.4, iLow: 151, iHigh: 200 },
  { cLow: 150.5, cHigh: 250.4, iLow: 201, iHigh: 300 },
  { cLow: 250.5, cHigh: 500.0, iLow: 301, iHigh: 500 },
];

/**
 * CPCB Indian National Air Quality Index (NAQI) PM10 (µg/m³, 24-hour) breakpoints.
 */
const PM10_CPCB_BREAKPOINTS: readonly Breakpoint[] = [
  { cLow: 0, cHigh: 50, iLow: 0, iHigh: 50 },
  { cLow: 51, cHigh: 100, iLow: 51, iHigh: 100 },
  { cLow: 101, cHigh: 250, iLow: 101, iHigh: 200 },
  { cLow: 251, cHigh: 350, iLow: 201, iHigh: 300 },
  { cLow: 351, cHigh: 430, iLow: 301, iHigh: 400 },
  { cLow: 431, cHigh: 600, iLow: 401, iHigh: 500 },
];

/**
 * US EPA NO2 (ppb, 1-hour) breakpoints.
 */
const NO2_EPA_BREAKPOINTS: readonly Breakpoint[] = [
  { cLow: 0, cHigh: 53, iLow: 0, iHigh: 50 },
  { cLow: 54, cHigh: 100, iLow: 51, iHigh: 100 },
  { cLow: 101, cHigh: 360, iLow: 101, iHigh: 150 },
  { cLow: 361, cHigh: 649, iLow: 151, iHigh: 200 },
  { cLow: 650, cHigh: 1249, iLow: 201, iHigh: 300 },
  { cLow: 1250, cHigh: 1649, iLow: 301, iHigh: 400 },
  { cLow: 1650, cHigh: 2049, iLow: 401, iHigh: 500 },
];

/**
 * US EPA CO (ppm, 8-hour) breakpoints.
 * Input in mg/m³ is converted using standard 25°C, 1 atm factor: 1 ppm CO = 1.145 mg/m³.
 */
const CO_MG_M3_PER_PPM = 1.145;
const CO_EPA_PPM_BREAKPOINTS: readonly Breakpoint[] = [
  { cLow: 0.0, cHigh: 4.4, iLow: 0, iHigh: 50 },
  { cLow: 4.5, cHigh: 9.4, iLow: 51, iHigh: 100 },
  { cLow: 9.5, cHigh: 12.4, iLow: 101, iHigh: 150 },
  { cLow: 12.5, cHigh: 15.4, iLow: 151, iHigh: 200 },
  { cLow: 15.5, cHigh: 30.4, iLow: 201, iHigh: 300 },
  { cLow: 30.5, cHigh: 40.4, iLow: 301, iHigh: 400 },
  { cLow: 40.5, cHigh: 50.4, iLow: 401, iHigh: 500 },
];

/**
 * US EPA O3 (ppm, 8-hour primary with 1-hour hazardous extension up to 0.604 ppm).
 */
const O3_EPA_PPM_BREAKPOINTS: readonly Breakpoint[] = [
  { cLow: 0.0, cHigh: 0.054, iLow: 0, iHigh: 50 },
  { cLow: 0.055, cHigh: 0.07, iLow: 51, iHigh: 100 },
  { cLow: 0.071, cHigh: 0.085, iLow: 101, iHigh: 150 },
  { cLow: 0.086, cHigh: 0.105, iLow: 151, iHigh: 200 },
  { cLow: 0.106, cHigh: 0.2, iLow: 201, iHigh: 300 },
  { cLow: 0.201, cHigh: 0.604, iLow: 301, iHigh: 500 },
];

const VALID_PERSONAS: ReadonlySet<PersonaProfile> = new Set([
  'children',
  'elderly',
  'asthmatics',
  'general',
]);

/**
 * Validates that a numeric parameter is a finite, non-negative number.
 * Throws a {@link RangeError} if invalid.
 */
function assertNonNegativeFinite(value: number, paramName: string): void {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    throw new RangeError(`${paramName} must be a finite number; received ${String(value)}.`);
  }
  if (value < 0) {
    throw new RangeError(`${paramName} cannot be negative; received ${value}.`);
  }
}

/**
 * Truncates a non-negative number to the specified decimal precision
 * (matching EPA Technical Assistance Document truncation rules).
 */
function truncateToDecimals(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  // Add small epsilon to prevent binary floating point representation drift (e.g., 12.1 * 10 = 120.99999999999999)
  return Math.floor(value * factor + 1e-9) / factor;
}

/**
 * Performs deterministic piecewise linear interpolation over sorted AQI breakpoints.
 * Values above the highest breakpoint cap cleanly at 500.
 */
function interpolateSubIndex(concentration: number, breakpoints: readonly Breakpoint[]): number {
  for (const bp of breakpoints) {
    if (concentration <= bp.cHigh) {
      const clampedC = Math.max(concentration, bp.cLow);
      const cSpan = bp.cHigh - bp.cLow;
      if (cSpan <= 0) {
        return bp.iHigh;
      }
      const rawIndex = ((bp.iHigh - bp.iLow) / cSpan) * (clampedC - bp.cLow) + bp.iLow;
      return Math.round(rawIndex);
    }
  }
  return 500;
}

/**
 * Maps a numeric AQI value (0–500+) to its US EPA category label.
 */
function resolveCategoryLabel(aqi: number): AQICategoryLabel {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

/**
 * Calculates the US EPA PM2.5 AQI sub-index using piecewise linear interpolation.
 *
 * Concentration is truncated to 1 decimal place per EPA reporting guidelines.
 * Breakpoints (µg/m³ → AQI):
 * - `0–12.0` → `0–50`
 * - `12.1–35.4` → `51–100`
 * - `35.5–55.4` → `101–150`
 * - `55.5–150.4` → `151–200`
 * - `150.5–250.4` → `201–300`
 * - `250.5–500.0` → `301–500` (values above 500 µg/m³ cap at 500)
 *
 * @param pm25 - 24-hour PM2.5 concentration in µg/m³ (must be finite and >= 0).
 * @returns Integer EPA PM2.5 sub-index in the range `[0, 500]`.
 * @throws {RangeError} If `pm25` is negative, `NaN`, `Infinity`, or not a number.
 */
export function calculatePM25SubIndex(pm25: number): number {
  assertNonNegativeFinite(pm25, 'pm25');
  const truncated = truncateToDecimals(pm25, 1);
  return interpolateSubIndex(truncated, PM25_BREAKPOINTS);
}

/**
 * Calculates the PM10 AQI sub-index using India CPCB National Air Quality Index (NAQI) standards.
 *
 * Concentration is truncated to an integer µg/m³ value per CPCB NAQI conventions.
 * Breakpoints (µg/m³ → Sub-Index):
 * - `0–50` → `0–50` (Good)
 * - `51–100` → `51–100` (Satisfactory)
 * - `101–250` → `101–200` (Moderately Polluted)
 * - `251–350` → `201–300` (Poor)
 * - `351–430` → `301–400` (Very Poor)
 * - `431–600` → `401–500` (Severe; values above 600 µg/m³ cap at 500)
 *
 * @param pm10 - 24-hour PM10 concentration in µg/m³ (must be finite and >= 0).
 * @returns Integer CPCB PM10 sub-index in the range `[0, 500]`.
 * @throws {RangeError} If `pm10` is negative, `NaN`, `Infinity`, or not a number.
 */
export function calculatePM10SubIndex(pm10: number): number {
  assertNonNegativeFinite(pm10, 'pm10');
  const truncated = truncateToDecimals(pm10, 0);
  return interpolateSubIndex(truncated, PM10_CPCB_BREAKPOINTS);
}

/**
 * Calculates the US EPA NO2 AQI sub-index from 1-hour concentration in ppb.
 *
 * Concentration is truncated to an integer ppb value per EPA reporting guidelines.
 * Breakpoints (ppb → AQI):
 * - `0–53` → `0–50`
 * - `54–100` → `51–100`
 * - `101–360` → `101–150`
 * - `361–649` → `151–200`
 * - `650–1249` → `201–300`
 * - `1250–1649` → `301–400`
 * - `1650–2049` → `401–500` (values above 2049 ppb cap at 500)
 *
 * @param no2 - 1-hour NO2 concentration in ppb (must be finite and >= 0).
 * @returns Integer EPA NO2 sub-index in the range `[0, 500]`.
 * @throws {RangeError} If `no2` is negative, `NaN`, `Infinity`, or not a number.
 */
export function calculateNO2SubIndex(no2: number): number {
  assertNonNegativeFinite(no2, 'no2');
  const truncated = truncateToDecimals(no2, 0);
  return interpolateSubIndex(truncated, NO2_EPA_BREAKPOINTS);
}

/**
 * Calculates the US EPA Carbon Monoxide (CO) AQI sub-index from 8-hour concentration in mg/m³.
 *
 * Converts mg/m³ to ppm at standard atmospheric conditions (25°C, 1 atm: `1 ppm = 1.145 mg/m³`),
 * truncates to 1 decimal place per EPA guidelines, and interpolates across official EPA CO ppm
 * breakpoints (`0.0–50.4 ppm` → `0–500`, capped at 500 above `50.4 ppm`).
 *
 * @param co - 8-hour CO concentration in mg/m³ (must be finite and >= 0).
 * @returns Integer EPA CO sub-index in the range `[0, 500]`.
 * @throws {RangeError} If `co` is negative, `NaN`, `Infinity`, or not a number.
 */
export function calculateCOSubIndex(co: number): number {
  assertNonNegativeFinite(co, 'co');
  const ppm = truncateToDecimals(co / CO_MG_M3_PER_PPM, 1);
  return interpolateSubIndex(ppm, CO_EPA_PPM_BREAKPOINTS);
}

/**
 * Calculates the US EPA Ozone (O3) AQI sub-index from 8-hour concentration in ppm.
 *
 * Concentration is truncated to 3 decimal places per EPA guidelines.
 * Breakpoints (ppm → AQI):
 * - `0.000–0.054` → `0–50`
 * - `0.055–0.070` → `51–100`
 * - `0.071–0.085` → `101–150`
 * - `0.086–0.105` → `151–200`
 * - `0.106–0.200` → `201–300`
 * - `0.201–0.604` → `301–500` (values above 0.604 ppm cap at 500)
 *
 * @param o3 - 8-hour O3 concentration in ppm (must be finite and >= 0).
 * @returns Integer EPA O3 sub-index in the range `[0, 500]`.
 * @throws {RangeError} If `o3` is negative, `NaN`, `Infinity`, or not a number.
 */
export function calculateO3SubIndex(o3: number): number {
  assertNonNegativeFinite(o3, 'o3');
  const truncated = truncateToDecimals(o3, 3);
  return interpolateSubIndex(truncated, O3_EPA_PPM_BREAKPOINTS);
}

/**
 * Calculates the composite Air Quality Index from one or more pollutant readings.
 *
 * Evaluates the sub-index for each provided pollutant and selects the maximum value as the
 * composite AQI along with its US EPA category, dominant pollutant, and UI color.
 * Categories:
 * - `0–50`: Good
 * - `51–100`: Moderate
 * - `101–150`: Unhealthy for Sensitive Groups
 * - `151–200`: Unhealthy
 * - `201–300`: Very Unhealthy
 * - `301–500`: Hazardous
 *
 * @param pollutants - Object containing one or more pollutant measurements.
 * @returns {@link AQICategory} summary containing composite AQI, category, dominant pollutant, sub-indices, and color.
 * @throws {RangeError} If `pollutants` is missing/invalid, contains no readings, or has any invalid pollutant value.
 */
export function calculateAQI(pollutants: PollutantReadings): AQICategory {
  if (!pollutants || typeof pollutants !== 'object' || Array.isArray(pollutants)) {
    throw new RangeError('pollutants must be a non-null PollutantReadings object.');
  }

  const calculators: ReadonlyArray<{
    key: PollutantType;
    calc: (val: number) => number;
  }> = [
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
      if (value === undefined) {
        continue;
      }
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

const HEALTH_RECOMMENDATIONS: Readonly<
  Record<AQICategoryLabel, Readonly<Record<PersonaProfile, string>>>
> = {
  Good: {
    children:
      'Air quality is clean; normal outdoor play, recess, and youth sports are safe with no restrictions.',
    elderly:
      'Conditions are ideal for outdoor walks, gardening, and routine daytime ventilation indoors.',
    asthmatics:
      'Low ambient particulate and gas levels; continue standard controller medication and normal outdoor activity.',
    general:
      'Air quality is satisfactory with little or no risk; ideal conditions for all outdoor exercise and commuting.',
  },
  Moderate: {
    children:
      'Outdoor play is generally safe; watch unusually sensitive children for coughing or throat irritation during vigorous sports.',
    elderly:
      'Light-to-moderate outdoor activity is acceptable; consider taking rest breaks during heavy traffic hours.',
    asthmatics:
      'Keep a rescue inhaler accessible and avoid prolonged vigorous exertion directly beside busy arterial roads.',
    general:
      'Air quality is acceptable for most people; consider scheduling high-intensity workouts away from rush-hour corridors.',
  },
  'Unhealthy for Sensitive Groups': {
    children:
      'Shorten prolonged outdoor sports and shift high-exertion recess activities indoors or to lower-pollution morning hours.',
    elderly:
      'Limit prolonged outdoor exertion, avoid strenuous hills or traffic corridors, and keep windows closed during peak haze.',
    asthmatics:
      'Reduce outdoor exertion, follow your asthma action plan closely, and run a HEPA air cleaner indoors.',
    general:
      'Most healthy adults can continue normal activities, though shortening intense prolonged outdoor training is prudent.',
  },
  Unhealthy: {
    children:
      'Move physical education, playground time, and after-school athletics indoors with filtered air.',
    elderly:
      'Avoid outdoor physical exertion, remain indoors with windows sealed, and monitor for shortness of breath or chest discomfort.',
    asthmatics:
      'Avoid outdoor exertion entirely, wear a well-fitting N95/FFP2 respirator if travel is unavoidable, and run HEPA filtration continuously.',
    general:
      'Reduce prolonged or heavy outdoor exertion, shift workouts indoors, and consider wearing an N95 mask during long outdoor commutes.',
  },
  'Very Unhealthy': {
    children:
      'Keep children indoors in a clean-air room with HEPA filtration; cancel all outdoor recess and athletic events.',
    elderly:
      'Stay indoors with sealed windows and active air purification; arrange indoor delivery for errands and contact a clinician if symptoms arise.',
    asthmatics:
      'Remain strictly indoors with HEPA filtration, keep rescue medication on hand, and seek medical advice promptly if wheezing worsens.',
    general:
      'Avoid all outdoor physical activity, keep doors and windows tightly closed, and wear a fitted N95/FFP2 respirator if going outside.',
  },
  Hazardous: {
    children:
      'Emergency air quality conditions: keep children strictly indoors in a sealed, HEPA-filtered room with zero outdoor activity.',
    elderly:
      'Health emergency: stay indoors continuously with active HEPA air cleaning and seek medical help immediately for any respiratory or cardiac symptoms.',
    asthmatics:
      'Critical respiratory alert: remain in a sealed HEPA-filtered room, follow emergency medication protocols, and avoid any outdoor exposure.',
    general:
      'Health warning of emergency conditions: everyone should avoid all outdoor exertion, seal indoor spaces, and run HEPA filtration continuously.',
  },
};

/**
 * Returns tailored, actionable respiratory health guidance for a given AQI value and persona.
 *
 * @param aqi - Numeric AQI value (must be finite and >= 0).
 * @param persona - Target demographic or sensitivity group (`'children' | 'elderly' | 'asthmatics' | 'general'`).
 * @returns Plain-language health recommendation string tailored to both AQI tier and persona.
 * @throws {RangeError} If `aqi` is negative, `NaN`, `Infinity`, or `persona` is invalid.
 */
export function getHealthRecommendation(aqi: number, persona: PersonaProfile): string {
  assertNonNegativeFinite(aqi, 'aqi');
  if (typeof persona !== 'string' || !VALID_PERSONAS.has(persona)) {
    throw new RangeError(
      `persona must be one of 'children', 'elderly', 'asthmatics', or 'general'; received ${String(persona)}.`,
    );
  }
  const category = resolveCategoryLabel(Math.round(aqi));
  return HEALTH_RECOMMENDATIONS[category][persona];
}

/**
 * Returns the UI hex color code (`#RRGGBB`) corresponding to the given AQI value.
 *
 * Color mapping:
 * - `0–50` (Good): `#16A34A`
 * - `51–100` (Moderate): `#D97706`
 * - `101–150` (Unhealthy for Sensitive Groups): `#EA580C`
 * - `151–200` (Unhealthy): `#DC2626`
 * - `201–300` (Very Unhealthy): `#7E22CE`
 * - `301–500+` (Hazardous): `#7F1D1D`
 *
 * @param aqi - Numeric AQI value (must be finite and >= 0).
 * @returns Six-digit uppercase hex color string (e.g. `'#16A34A'`).
 * @throws {RangeError} If `aqi` is negative, `NaN`, `Infinity`, or not a number.
 */
export function getAQIColor(aqi: number): string {
  assertNonNegativeFinite(aqi, 'aqi');
  const rounded = Math.round(aqi);
  if (rounded <= 50) return '#16A34A';
  if (rounded <= 100) return '#D97706';
  if (rounded <= 150) return '#EA580C';
  if (rounded <= 200) return '#DC2626';
  if (rounded <= 300) return '#7E22CE';
  return '#7F1D1D';
}
