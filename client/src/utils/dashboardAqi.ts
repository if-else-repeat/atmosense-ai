/**
 * @module dashboardAqi
 * Pure, deterministic client-side calculations for the AtmoSense AI Dashboard:
 * AQI classification metadata, pollutant trend cards, relative timestamps, and SR descriptions.
 */

import type {
  AQICategoryLabel,
  ForecastHourlyPoint,
  PollutantMetricCardData,
  TrendDirection,
} from '../types/aqi';
import { assessInversionRisk, getPersonaHealthGuidance } from './personaGuidance';

export { assessInversionRisk, getPersonaHealthGuidance };

export interface AQIStatusPresentation {
  category: AQICategoryLabel;
  shortLabel: string;
  hexColor: string;
  iconKey: 'check' | 'info' | 'alert-triangle' | 'shield-alert' | 'octagon-alert';
  textClass: string;
  surfaceClass: string;
  borderClass: string;
}

/** Classifies a numeric AQI value into US EPA category metadata with icon and color pairings. */
export function getAQIStatusPresentation(aqi: number): AQIStatusPresentation {
  const safe = Number.isFinite(aqi) ? Math.max(0, Math.min(500, Math.round(aqi))) : 0;

  if (safe <= 50) {
    return {
      category: 'Good',
      shortLabel: 'Good',
      hexColor: '#16A34A',
      iconKey: 'check',
      textClass: 'text-emerald-700 dark:text-emerald-400',
      surfaceClass: 'bg-emerald-50/70 dark:bg-emerald-950/35',
      borderClass: 'border-emerald-200 dark:border-emerald-800/70',
    };
  }
  if (safe <= 100) {
    return {
      category: 'Moderate',
      shortLabel: 'Moderate',
      hexColor: '#D97706',
      iconKey: 'info',
      textClass: 'text-amber-700 dark:text-amber-400',
      surfaceClass: 'bg-amber-50/70 dark:bg-amber-950/35',
      borderClass: 'border-amber-200 dark:border-amber-800/70',
    };
  }
  if (safe <= 150) {
    return {
      category: 'Unhealthy for Sensitive Groups',
      shortLabel: 'Sensitive Risk',
      hexColor: '#EA580C',
      iconKey: 'alert-triangle',
      textClass: 'text-orange-700 dark:text-orange-400',
      surfaceClass: 'bg-orange-50/70 dark:bg-orange-950/35',
      borderClass: 'border-orange-200 dark:border-orange-800/70',
    };
  }
  if (safe <= 200) {
    return {
      category: 'Unhealthy',
      shortLabel: 'Unhealthy',
      hexColor: '#DC2626',
      iconKey: 'shield-alert',
      textClass: 'text-red-700 dark:text-red-400',
      surfaceClass: 'bg-red-50/70 dark:bg-red-950/35',
      borderClass: 'border-red-200 dark:border-red-800/70',
    };
  }
  if (safe <= 300) {
    return {
      category: 'Very Unhealthy',
      shortLabel: 'Very Unhealthy',
      hexColor: '#7E22CE',
      iconKey: 'octagon-alert',
      textClass: 'text-purple-700 dark:text-purple-400',
      surfaceClass: 'bg-purple-50/70 dark:bg-purple-950/35',
      borderClass: 'border-purple-200 dark:border-purple-800/70',
    };
  }
  return {
    category: 'Hazardous',
    shortLabel: 'Hazardous',
    hexColor: '#991B1B',
    iconKey: 'octagon-alert',
    textClass: 'text-rose-800 dark:text-rose-400',
    surfaceClass: 'bg-rose-50/80 dark:bg-rose-950/40',
    borderClass: 'border-rose-300 dark:border-rose-800/70',
  };
}

/** Formats an elapsed duration into human-readable attribution text. */
export function formatUpdatedAgo(timestampMs: number, nowMs: number = Date.now()): string {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) return 'just now';
  const diffSec = Math.max(0, Math.floor((nowMs - timestampMs) / 1000));
  if (diffSec < 45) return 'just now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  return `${Math.round(diffHr / 24)} d ago`;
}

/** Evaluates a short-term concentration trend from an ordered series. */
export function computeTrendDelta(series: readonly number[]): {
  trend: TrendDirection;
  deltaPercent: number;
} {
  if (series.length < 2) return { trend: 'steady', deltaPercent: 0 };
  const start = series[0] ?? 0;
  const end = series[series.length - 1] ?? 0;
  const rawPct = ((end - start) / Math.max(Math.abs(start), 0.01)) * 100;
  const clampedPct = Math.round(Math.max(-99, Math.min(99, rawPct)));

  if (clampedPct >= 5) return { trend: 'rising', deltaPercent: clampedPct };
  if (clampedPct <= -5) return { trend: 'falling', deltaPercent: clampedPct };
  return { trend: 'steady', deltaPercent: clampedPct };
}

function classifyPollutantStatus(
  value: number,
  guideline: number,
): 'good' | 'moderate' | 'elevated' | 'high' {
  const ratio = value / Math.max(guideline, 0.001);
  if (ratio <= 0.8) return 'good';
  if (ratio <= 1.5) return 'moderate';
  if (ratio <= 2.5) return 'elevated';
  return 'high';
}

/** Builds the 5 structured pollutant cards (PM2.5, PM10, NO2, CO, O3) with 6-hour trends. */
export function buildPollutantMetricCards(
  current: { pm25: number; pm10: number; no2: number; co: number; o3: number },
  forecast: readonly ForecastHourlyPoint[],
): PollutantMetricCardData[] {
  const windowSlice = forecast.slice(0, 6);
  const pickSeries = (
    extractor: (pt: ForecastHourlyPoint) => number,
    fallbackVal: number,
    jitterFactors: readonly number[],
  ): number[] => {
    const extracted = windowSlice.map(extractor).filter((v) => Number.isFinite(v) && v >= 0);
    if (extracted.length >= 2 && extracted.some((v) => v > 0)) return extracted;
    return jitterFactors.map((f) => Number((fallbackVal * f).toFixed(3)));
  };

  const specs = [
    {
      id: 'pm25' as const,
      label: 'Fine Particulates',
      formula: 'PM2.5',
      value: Number(current.pm25.toFixed(1)),
      unit: 'µg/m³',
      guidelineValue: 15,
      guidelineLabel: 'WHO 24h: 15 µg/m³',
      series: pickSeries((p) => p.pm25, current.pm25, [0.94, 0.97, 1.0, 1.03, 1.01, 0.98]),
    },
    {
      id: 'pm10' as const,
      label: 'Coarse Dust',
      formula: 'PM10',
      value: Number(current.pm10.toFixed(1)),
      unit: 'µg/m³',
      guidelineValue: 45,
      guidelineLabel: 'WHO 24h: 45 µg/m³',
      series: pickSeries((p) => p.pm10, current.pm10, [0.96, 0.99, 1.02, 1.0, 0.97, 0.95]),
    },
    {
      id: 'no2' as const,
      label: 'Nitrogen Dioxide',
      formula: 'NO₂',
      value: Number(current.no2.toFixed(1)),
      unit: 'ppb',
      guidelineValue: 53,
      guidelineLabel: 'EPA Good: ≤53 ppb',
      series: pickSeries((p) => p.no2, current.no2, [0.91, 0.95, 1.02, 1.08, 1.04, 1.01]),
    },
    {
      id: 'co' as const,
      label: 'Carbon Monoxide',
      formula: 'CO',
      value: Number(current.co.toFixed(2)),
      unit: 'mg/m³',
      guidelineValue: 4.0,
      guidelineLabel: 'WHO 24h: 4.0 mg/m³',
      series: pickSeries((p) => p.co, current.co, [0.98, 0.99, 1.0, 1.01, 1.0, 0.99]),
    },
    {
      id: 'o3' as const,
      label: 'Ground-Level Ozone',
      formula: 'O₃',
      value: Number(current.o3.toFixed(3)),
      unit: 'ppm',
      guidelineValue: 0.054,
      guidelineLabel: 'EPA Good: ≤0.054 ppm',
      series: pickSeries((p) => p.o3, current.o3, [0.88, 0.92, 0.98, 1.05, 1.09, 1.04]),
    },
  ];

  return specs.map((spec) => {
    const { trend, deltaPercent } = computeTrendDelta(spec.series);
    return {
      id: spec.id,
      label: spec.label,
      formula: spec.formula,
      value: spec.value,
      unit: spec.unit,
      guidelineValue: spec.guidelineValue,
      guidelineLabel: spec.guidelineLabel,
      trend,
      deltaPercent,
      history: spec.series,
      status: classifyPollutantStatus(spec.value, spec.guidelineValue),
    };
  });
}

/** Generates a plain-language screen-reader narrative describing the 24-hour forecast chart. */
export function buildForecastSrDescription(
  forecast: readonly ForecastHourlyPoint[],
  locationName: string,
): string {
  if (forecast.length === 0) {
    return `No 24-hour air quality forecast points are currently available for ${locationName}.`;
  }

  let minPt = forecast[0]!;
  let maxPt = forecast[0]!;
  let sumAqi = 0;

  for (const pt of forecast) {
    sumAqi += pt.aqi;
    if (pt.aqi < minPt.aqi) minPt = pt;
    if (pt.aqi > maxPt.aqi) maxPt = pt;
  }

  const avgAqi = Math.round(sumAqi / forecast.length);
  return `24-hour AQI forecast chart for ${locationName} across ${forecast.length} hourly readings. Average predicted AQI is ${avgAqi}. Cleanest reading is AQI ${minPt.aqi} at ${minPt.hourLabel}; highest predicted pollution peak is AQI ${maxPt.aqi} at ${maxPt.hourLabel}. Use Left and Right arrow keys to inspect individual forecast hours.`;
}
