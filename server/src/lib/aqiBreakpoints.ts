/**
 * @module aqiBreakpoints
 * Official US EPA (PM2.5, NO2, CO, O3) and India CPCB NAQI (PM10) piecewise linear breakpoints
 * plus deterministic truncation and interpolation helpers.
 */

export interface Breakpoint {
  readonly cLow: number;
  readonly cHigh: number;
  readonly iLow: number;
  readonly iHigh: number;
}

export const PM25_BREAKPOINTS: readonly Breakpoint[] = [
  { cLow: 0.0, cHigh: 12.0, iLow: 0, iHigh: 50 },
  { cLow: 12.1, cHigh: 35.4, iLow: 51, iHigh: 100 },
  { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },
  { cLow: 55.5, cHigh: 150.4, iLow: 151, iHigh: 200 },
  { cLow: 150.5, cHigh: 250.4, iLow: 201, iHigh: 300 },
  { cLow: 250.5, cHigh: 500.0, iLow: 301, iHigh: 500 },
];

export const PM10_CPCB_BREAKPOINTS: readonly Breakpoint[] = [
  { cLow: 0, cHigh: 50, iLow: 0, iHigh: 50 },
  { cLow: 51, cHigh: 100, iLow: 51, iHigh: 100 },
  { cLow: 101, cHigh: 250, iLow: 101, iHigh: 200 },
  { cLow: 251, cHigh: 350, iLow: 201, iHigh: 300 },
  { cLow: 351, cHigh: 430, iLow: 301, iHigh: 400 },
  { cLow: 431, cHigh: 600, iLow: 401, iHigh: 500 },
];

export const NO2_EPA_BREAKPOINTS: readonly Breakpoint[] = [
  { cLow: 0, cHigh: 53, iLow: 0, iHigh: 50 },
  { cLow: 54, cHigh: 100, iLow: 51, iHigh: 100 },
  { cLow: 101, cHigh: 360, iLow: 101, iHigh: 150 },
  { cLow: 361, cHigh: 649, iLow: 151, iHigh: 200 },
  { cLow: 650, cHigh: 1249, iLow: 201, iHigh: 300 },
  { cLow: 1250, cHigh: 1649, iLow: 301, iHigh: 400 },
  { cLow: 1650, cHigh: 2049, iLow: 401, iHigh: 500 },
];

export const CO_MG_M3_PER_PPM = 1.145;
export const CO_EPA_PPM_BREAKPOINTS: readonly Breakpoint[] = [
  { cLow: 0.0, cHigh: 4.4, iLow: 0, iHigh: 50 },
  { cLow: 4.5, cHigh: 9.4, iLow: 51, iHigh: 100 },
  { cLow: 9.5, cHigh: 12.4, iLow: 101, iHigh: 150 },
  { cLow: 12.5, cHigh: 15.4, iLow: 151, iHigh: 200 },
  { cLow: 15.5, cHigh: 30.4, iLow: 201, iHigh: 300 },
  { cLow: 30.5, cHigh: 40.4, iLow: 301, iHigh: 400 },
  { cLow: 40.5, cHigh: 50.4, iLow: 401, iHigh: 500 },
];

export const O3_EPA_PPM_BREAKPOINTS: readonly Breakpoint[] = [
  { cLow: 0.0, cHigh: 0.054, iLow: 0, iHigh: 50 },
  { cLow: 0.055, cHigh: 0.07, iLow: 51, iHigh: 100 },
  { cLow: 0.071, cHigh: 0.085, iLow: 101, iHigh: 150 },
  { cLow: 0.086, cHigh: 0.105, iLow: 151, iHigh: 200 },
  { cLow: 0.106, cHigh: 0.2, iLow: 201, iHigh: 300 },
  { cLow: 0.201, cHigh: 0.604, iLow: 301, iHigh: 500 },
];

/** Validates that a numeric parameter is a finite, non-negative number. */
export function assertNonNegativeFinite(value: number, paramName: string): void {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    throw new RangeError(`${paramName} must be a finite number; received ${String(value)}.`);
  }
  if (value < 0) {
    throw new RangeError(`${paramName} cannot be negative; received ${value}.`);
  }
}

/** Truncates a non-negative number to the specified decimal precision per EPA TAD rules. */
export function truncateToDecimals(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.floor(value * factor + 1e-9) / factor;
}

/** Performs deterministic piecewise linear interpolation over sorted AQI breakpoints. */
export function interpolateSubIndex(
  concentration: number,
  breakpoints: readonly Breakpoint[],
): number {
  for (const bp of breakpoints) {
    if (concentration <= bp.cHigh) {
      const clampedC = Math.max(concentration, bp.cLow);
      const cSpan = bp.cHigh - bp.cLow;
      if (cSpan <= 0) return bp.iHigh;
      return Math.round(((bp.iHigh - bp.iLow) / cSpan) * (clampedC - bp.cLow) + bp.iLow);
    }
  }
  return 500;
}
