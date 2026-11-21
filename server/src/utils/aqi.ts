import type { AqiClassification, HourlyPoint, PollutantMetrics } from '../types/airQuality';

interface Breakpoint {
  cLow: number;
  cHigh: number;
  iLow: number;
  iHigh: number;
}

const PM25_BREAKPOINTS: readonly Breakpoint[] = [
  { cLow: 0.0, cHigh: 9.0, iLow: 0, iHigh: 50 },
  { cLow: 9.1, cHigh: 35.4, iLow: 51, iHigh: 100 },
  { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },
  { cLow: 55.5, cHigh: 125.4, iLow: 151, iHigh: 200 },
  { cLow: 125.5, cHigh: 225.4, iLow: 201, iHigh: 300 },
  { cLow: 225.5, cHigh: 500.4, iLow: 301, iHigh: 500 },
];

const PM10_BREAKPOINTS: readonly Breakpoint[] = [
  { cLow: 0, cHigh: 54, iLow: 0, iHigh: 50 },
  { cLow: 55, cHigh: 154, iLow: 51, iHigh: 100 },
  { cLow: 155, cHigh: 254, iLow: 101, iHigh: 150 },
  { cLow: 255, cHigh: 354, iLow: 151, iHigh: 200 },
  { cLow: 355, cHigh: 424, iLow: 201, iHigh: 300 },
  { cLow: 425, cHigh: 604, iLow: 301, iHigh: 500 },
];

// NO2 in µg/m³ (1 ppb ≈ 1.88 µg/m³)
const NO2_BREAKPOINTS_UGM3: readonly Breakpoint[] = [
  { cLow: 0, cHigh: 100, iLow: 0, iHigh: 50 },
  { cLow: 101, cHigh: 188, iLow: 51, iHigh: 100 },
  { cLow: 189, cHigh: 677, iLow: 101, iHigh: 150 },
  { cLow: 678, cHigh: 1220, iLow: 151, iHigh: 200 },
  { cLow: 1221, cHigh: 2348, iLow: 201, iHigh: 300 },
  { cLow: 2349, cHigh: 3850, iLow: 301, iHigh: 500 },
];

// O3 8-hour approximation in µg/m³ (1 ppb ≈ 1.96 µg/m³)
const O3_BREAKPOINTS_UGM3: readonly Breakpoint[] = [
  { cLow: 0, cHigh: 106, iLow: 0, iHigh: 50 },
  { cLow: 107, cHigh: 137, iLow: 51, iHigh: 100 },
  { cLow: 138, cHigh: 167, iLow: 101, iHigh: 150 },
  { cLow: 168, cHigh: 206, iLow: 151, iHigh: 200 },
  { cLow: 207, cHigh: 392, iLow: 201, iHigh: 300 },
  { cLow: 393, cHigh: 600, iLow: 301, iHigh: 500 },
];

function interpolateAqi(concentration: number, table: readonly Breakpoint[]): number {
  const clamped = Math.max(0, concentration);
  for (const bp of table) {
    if (clamped <= bp.cHigh) {
      const span = bp.cHigh - bp.cLow;
      if (span <= 0) return bp.iHigh;
      const ratio = (Math.max(clamped, bp.cLow) - bp.cLow) / span;
      return Math.round(ratio * (bp.iHigh - bp.iLow) + bp.iLow);
    }
  }
  return 500;
}

export function calculatePm25Aqi(pm25: number): number {
  return interpolateAqi(Math.floor(Math.max(0, pm25) * 10) / 10, PM25_BREAKPOINTS);
}

export function calculatePm10Aqi(pm10: number): number {
  return interpolateAqi(Math.floor(Math.max(0, pm10)), PM10_BREAKPOINTS);
}

export function calculateNo2Aqi(no2: number): number {
  return interpolateAqi(Math.round(Math.max(0, no2)), NO2_BREAKPOINTS_UGM3);
}

export function calculateO3Aqi(o3: number): number {
  return interpolateAqi(Math.round(Math.max(0, o3)), O3_BREAKPOINTS_UGM3);
}

export function computeCompositeAqi(metrics: PollutantMetrics): {
  aqi: number;
  dominantPollutant: 'PM2.5' | 'PM10' | 'NO2' | 'O3';
} {
  const candidates: Array<{ key: 'PM2.5' | 'PM10' | 'NO2' | 'O3'; value: number }> = [
    { key: 'PM2.5', value: calculatePm25Aqi(metrics.pm25) },
    { key: 'PM10', value: calculatePm10Aqi(metrics.pm10) },
    { key: 'NO2', value: calculateNo2Aqi(metrics.no2) },
    { key: 'O3', value: calculateO3Aqi(metrics.o3) },
  ];

  let best = candidates[0]!;
  for (const item of candidates) {
    if (item.value > best.value) {
      best = item;
    }
  }

  return { aqi: Math.min(500, Math.max(0, best.value)), dominantPollutant: best.key };
}

export function classifyAqi(aqi: number): AqiClassification {
  if (aqi <= 50) {
    return {
      key: 'good',
      label: 'Good',
      shortLabel: 'Good',
      guidance: 'Air quality poses little or no risk for outdoor activity.',
    };
  }
  if (aqi <= 100) {
    return {
      key: 'moderate',
      label: 'Moderate',
      shortLabel: 'Moderate',
      guidance: 'Acceptable overall; unusually sensitive individuals should monitor symptoms.',
    };
  }
  if (aqi <= 150) {
    return {
      key: 'sensitive',
      label: 'Unhealthy for Sensitive Groups',
      shortLabel: 'Sensitive',
      guidance:
        'People with asthma, children, and older adults should reduce prolonged outdoor exertion.',
    };
  }
  if (aqi <= 200) {
    return {
      key: 'unhealthy',
      label: 'Unhealthy',
      shortLabel: 'Unhealthy',
      guidance:
        'Everyone may begin to experience respiratory effects; move vigorous exercise indoors.',
    };
  }
  if (aqi <= 300) {
    return {
      key: 'very_unhealthy',
      label: 'Very Unhealthy',
      shortLabel: 'Very Unhealthy',
      guidance: 'Health alert: avoid prolonged outdoor exposure and run HEPA filtration indoors.',
    };
  }
  return {
    key: 'hazardous',
    label: 'Hazardous',
    shortLabel: 'Hazardous',
    guidance:
      'Emergency conditions: remain indoors with sealed windows and active air purification.',
  };
}

/**
 * WHO 2021 24-hour PM2.5 guideline is 15 µg/m³.
 */
export function computeWhoRatio(pm25: number): number {
  const safe = Math.max(0, pm25);
  return Math.round((safe / 15) * 10) / 10;
}

/**
 * Identifies the cleanest contiguous 3-hour window across a 24-hour forecast series.
 */
export function findBestOutdoorWindow(hourly: readonly HourlyPoint[]): string {
  if (hourly.length < 3) {
    return '06:00 – 09:00';
  }
  let bestStart = 0;
  let bestAvg = Number.POSITIVE_INFINITY;
  for (let i = 0; i <= hourly.length - 3; i++) {
    const a = hourly[i]!;
    const b = hourly[i + 1]!;
    const c = hourly[i + 2]!;
    const avg = (a.aqi + b.aqi + c.aqi) / 3;
    if (avg < bestAvg) {
      bestAvg = avg;
      bestStart = i;
    }
  }
  const startLabel = hourly[bestStart]?.hourLabel ?? '06:00';
  const endLabel = hourly[Math.min(hourly.length - 1, bestStart + 2)]?.hourLabel ?? '09:00';
  return `${startLabel} – ${endLabel}`;
}
