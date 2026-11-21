/**
 * @module dashboardAqi
 * Pure, deterministic client-side calculations for the AtmoSense AI Dashboard:
 * AQI classification metadata (color + text + icon key), pollutant trend series,
 * thermal inversion risk assessment, persona health guidance, and relative timestamps.
 */

import type {
  AQICategoryLabel,
  ForecastHourlyPoint,
  InversionAssessment,
  InversionRiskLevel,
  PersonaHealthGuidance,
  PersonaProfile,
  PollutantMetricCardData,
  TrendDirection,
} from '../types/aqi';

export interface AQIStatusPresentation {
  category: AQICategoryLabel;
  shortLabel: string;
  hexColor: string;
  iconKey: 'check' | 'info' | 'alert-triangle' | 'shield-alert' | 'octagon-alert';
  textClass: string;
  surfaceClass: string;
  borderClass: string;
}

/**
 * Classifies a numeric AQI value into US EPA category metadata with explicit
 * icon key, accessible text color, and surface pairings for light & dark mode.
 */
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

/**
 * Formats an elapsed duration into human-readable attribution text
 * (e.g. `"just now"`, `"1 min ago"`, `"2 min ago"`, `"1 hr ago"`).
 */
export function formatUpdatedAgo(timestampMs: number, nowMs: number = Date.now()): string {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) {
    return 'just now';
  }
  const diffSec = Math.max(0, Math.floor((nowMs - timestampMs) / 1000));
  if (diffSec < 45) {
    return 'just now';
  }
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin} min ago`;
  }
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) {
    return `${diffHr} hr ago`;
  }
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay} d ago`;
}

/**
 * Evaluates a short-term concentration trend from an ordered series.
 */
export function computeTrendDelta(series: readonly number[]): {
  trend: TrendDirection;
  deltaPercent: number;
} {
  if (series.length < 2) {
    return { trend: 'steady', deltaPercent: 0 };
  }
  const start = series[0] ?? 0;
  const end = series[series.length - 1] ?? 0;
  const denominator = Math.max(Math.abs(start), 0.01);
  const rawPct = ((end - start) / denominator) * 100;
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

/**
 * Builds the 5 structured pollutant cards (PM2.5, PM10, NO2, CO, O3) with
 * individual 6-hour trends and WHO/EPA reference thresholds.
 */
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
    if (extracted.length >= 2 && extracted.some((v) => v > 0)) {
      return extracted;
    }
    return jitterFactors.map((f) => Number((fallbackVal * f).toFixed(3)));
  };

  const specs: Array<{
    id: PollutantMetricCardData['id'];
    label: string;
    formula: string;
    value: number;
    unit: string;
    guidelineValue: number;
    guidelineLabel: string;
    series: number[];
  }> = [
    {
      id: 'pm25',
      label: 'Fine Particulates',
      formula: 'PM2.5',
      value: Number(current.pm25.toFixed(1)),
      unit: 'µg/m³',
      guidelineValue: 15,
      guidelineLabel: 'WHO 24h: 15 µg/m³',
      series: pickSeries((p) => p.pm25, current.pm25, [0.94, 0.97, 1.0, 1.03, 1.01, 0.98]),
    },
    {
      id: 'pm10',
      label: 'Coarse Dust',
      formula: 'PM10',
      value: Number(current.pm10.toFixed(1)),
      unit: 'µg/m³',
      guidelineValue: 45,
      guidelineLabel: 'WHO 24h: 45 µg/m³',
      series: pickSeries((p) => p.pm10, current.pm10, [0.96, 0.99, 1.02, 1.0, 0.97, 0.95]),
    },
    {
      id: 'no2',
      label: 'Nitrogen Dioxide',
      formula: 'NO₂',
      value: Number(current.no2.toFixed(1)),
      unit: 'ppb',
      guidelineValue: 53,
      guidelineLabel: 'EPA Good: ≤53 ppb',
      series: pickSeries((p) => p.no2, current.no2, [0.91, 0.95, 1.02, 1.08, 1.04, 1.01]),
    },
    {
      id: 'co',
      label: 'Carbon Monoxide',
      formula: 'CO',
      value: Number(current.co.toFixed(2)),
      unit: 'mg/m³',
      guidelineValue: 4.0,
      guidelineLabel: 'WHO 24h: 4.0 mg/m³',
      series: pickSeries((p) => p.co, current.co, [0.98, 0.99, 1.0, 1.01, 1.0, 0.99]),
    },
    {
      id: 'o3',
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

/**
 * Computes thermal inversion risk and plain-language atmospheric boundary-layer explanation
 * from local hour, wind speed, relative humidity, and PM2.5 loading.
 */
export function assessInversionRisk(params: {
  localHour: number;
  windKph: number;
  humidityPct: number;
  temperatureC: number;
  pm25: number;
}): InversionAssessment {
  const { localHour, windKph, humidityPct, temperatureC, pm25 } = params;
  const hour = ((Math.floor(localHour) % 24) + 24) % 24;

  const currentPeriod: InversionAssessment['currentPeriod'] =
    hour >= 6 && hour < 11
      ? 'morning-inversion'
      : hour >= 11 && hour < 17
        ? 'convective-mixing'
        : hour >= 17 && hour < 21
          ? 'evening-settling'
          : 'overnight';

  let riskScore = 0;
  if (windKph < 7) riskScore += 3;
  else if (windKph < 13) riskScore += 1.5;

  if (currentPeriod === 'morning-inversion' || currentPeriod === 'evening-settling') {
    riskScore += 2.5;
  } else if (currentPeriod === 'overnight') {
    riskScore += 1.5;
  }

  if (humidityPct >= 70) riskScore += 1;
  if (pm25 >= 55) riskScore += 1.5;
  else if (pm25 >= 35) riskScore += 0.75;

  let level: InversionRiskLevel = 'low';
  if (riskScore >= 4.5) level = 'high';
  else if (riskScore >= 2.25) level = 'moderate';

  if (level === 'high') {
    return {
      level,
      label: 'High Inversion Risk',
      headline: 'Warm air aloft is capping pollution near street level',
      explanation:
        'Calm winds and a shallow surface layer are acting like a lid over the city, trapping vehicle exhaust and fine PM2.5 at breathing height. Wait until solar warming between 11:00 and 16:00 lifts the lid and disperses pollutants upward.',
      dispersionWindow: '11:00–16:00',
      windKph,
      humidityPct,
      temperatureC,
      currentPeriod,
    };
  }

  if (level === 'moderate') {
    return {
      level,
      label: 'Moderate Inversion Risk',
      headline: 'Partial surface trapping during calm transition hours',
      explanation:
        'Moderate breezes provide some dilution, but localized traffic plumes can still linger near avenues during morning (06:00–10:00) and evening (17:00–20:00) cooling periods. Midday hours offer the cleanest vertical mixing.',
      dispersionWindow: '11:00–16:00',
      windKph,
      humidityPct,
      temperatureC,
      currentPeriod,
    };
  }

  return {
    level,
    label: 'Low Inversion Risk',
    headline: 'Active atmospheric mixing is dispersing surface emissions',
    explanation:
      'Steady airflow and daytime thermal convection are carrying urban emissions upward instead of trapping them near the ground. Ambient levels are less likely to spike suddenly outside busy intersections.',
    dispersionWindow: '11:00–16:00',
    windKph,
    humidityPct,
    temperatureC,
    currentPeriod,
  };
}

const PERSONA_LABELS: Readonly<Record<PersonaProfile, string>> = {
  general: 'General Public',
  asthmatics: 'Asthma & Respiratory',
  children: 'Children & Youth',
  elderly: 'Older Adults (65+)',
};

/**
 * Returns tailored, actionable health recommendations based on AQI and selected persona.
 */
export function getPersonaHealthGuidance(
  aqi: number,
  persona: PersonaProfile,
): PersonaHealthGuidance {
  const safeAqi = Math.max(0, Math.min(500, Math.round(aqi)));
  const personaLabel = PERSONA_LABELS[persona];
  const citation = 'WHO Global Air Quality Guidelines (2021) · US EPA AQI Guidance';

  if (safeAqi <= 50) {
    const recByPersona: Record<PersonaProfile, string> = {
      general:
        'Air quality is clean with minimal health risk. Ideal conditions for outdoor training, commuting, and opening windows for fresh airflow.',
      asthmatics:
        'Low particulate and ozone load. Continue daily controller medication as prescribed and enjoy normal outdoor routines.',
      children:
        'Safe for outdoor recess, playground play, and youth sports with no duration limits.',
      elderly:
        'Excellent conditions for morning or midday walks, gardening, and natural indoor ventilation.',
    };
    return {
      persona,
      personaLabel,
      riskTier: 'low',
      headline: 'Clear conditions for normal outdoor activity',
      recommendation: recByPersona[persona],
      maskGuidance: 'No respirator required outdoors.',
      safeOutdoorWindow: 'All day (peak dispersion 11:00–16:00)',
      actionItems: [
        'Open cross-ventilation windows to refresh indoor air.',
        'Proceed with planned outdoor exercise and errands.',
        'Monitor afternoon ozone if temperatures climb sharply.',
      ],
      citation,
    };
  }

  if (safeAqi <= 100) {
    const recByPersona: Record<PersonaProfile, string> = {
      general:
        'Air quality is acceptable for most adults. Schedule intense endurance workouts away from congested arterial roads.',
      asthmatics:
        'Keep a quick-relief inhaler within reach and avoid prolonged vigorous exertion directly beside rush-hour traffic corridors.',
      children:
        'Outdoor play is generally safe; watch unusually sensitive children for coughing or throat irritation during heavy sports.',
      elderly:
        'Light-to-moderate outdoor walks are comfortable; pace exertion and prefer shaded parks over roadside footpaths.',
    };
    return {
      persona,
      personaLabel,
      riskTier: 'moderate',
      headline: 'Acceptable air; sensitive groups should pace exertion',
      recommendation: recByPersona[persona],
      maskGuidance:
        persona === 'general'
          ? 'Optional near heavy diesel traffic.'
          : 'Keep a fitted N95/FFP2 respirator handy for congested commutes.',
      safeOutdoorWindow: '11:00–16:00 (convective mixing window)',
      actionItems: [
        'Prefer 11:00–16:00 for brisk walking or outdoor errands.',
        'Avoid jogging alongside idling traffic between 06:00–10:00 and 17:00–20:00.',
        'Use vehicle cabin air recirculation in slow-moving traffic.',
      ],
      citation,
    };
  }

  if (safeAqi <= 150) {
    const recByPersona: Record<PersonaProfile, string> = {
      general:
        'Most healthy adults can continue everyday errands, but shorten prolonged high-intensity outdoor training or move workouts indoors.',
      asthmatics:
        'Reduce outdoor exertion, follow your written asthma action plan closely, and run a true-HEPA purifier indoors.',
      children:
        'Shorten prolonged outdoor sports practices and shift high-exertion recess activities indoors or to 11:00–16:00.',
      elderly:
        'Limit prolonged outdoor physical effort, keep exterior windows closed during peak haze, and rest indoors during commute hours.',
    };
    return {
      persona,
      personaLabel,
      riskTier: 'elevated',
      headline: 'Elevated particulate load — protect sensitive airways',
      recommendation: recByPersona[persona],
      maskGuidance:
        persona === 'general'
          ? 'Recommended NIOSH N95/FFP2 respirator during long outdoor commutes.'
          : 'Wear a well-fitting NIOSH N95 or EN149 FFP2 respirator for all outdoor travel.',
      safeOutdoorWindow: '11:00–16:00 (brief low-exertion errands only)',
      actionItems: [
        'Close exterior windows during 06:00–10:00 morning inversion and 17:00–20:00 traffic peak.',
        'Run a CADR-sized true-HEPA air cleaner in main living rooms.',
        'Move cardio workouts into filtered indoor spaces.',
      ],
      citation,
    };
  }

  if (safeAqi <= 200) {
    const recByPersona: Record<PersonaProfile, string> = {
      general:
        'Reduce prolonged or heavy outdoor exertion, shift exercise indoors, and wear a fitted N95/FFP2 respirator during outdoor travel.',
      asthmatics:
        'Avoid outdoor exertion entirely, run HEPA filtration continuously, and keep rescue bronchodilator medication immediately available.',
      children:
        'Move physical education, playground time, and after-school sports indoors with filtered air.',
      elderly:
        'Avoid outdoor physical exertion, seal exterior windows, and monitor for shortness of breath, fatigue, or chest discomfort.',
    };
    return {
      persona,
      personaLabel,
      riskTier: 'high',
      headline: 'Unhealthy air — shift daily activities indoors',
      recommendation: recByPersona[persona],
      maskGuidance:
        'Wear a well-fitting NIOSH N95/KN95/FFP2 respirator outdoors; cloth and surgical masks do not block PM2.5.',
      safeOutdoorWindow: '11:00–16:00 (essential masked errands only)',
      actionItems: [
        'Keep doors and windows sealed; avoid indoor combustion (incense, frying smoke).',
        'Operate HEPA filtration on medium-high targeting indoor PM2.5 < 15 µg/m³.',
        'Reschedule outdoor sports and strenuous chores until AQI improves.',
      ],
      citation,
    };
  }

  const recByPersona: Record<PersonaProfile, string> = {
    general:
      'Emergency-grade particulate levels: avoid all outdoor physical activity, seal indoor rooms, and operate HEPA air cleaning continuously.',
    asthmatics:
      'Critical respiratory alert: stay strictly indoors in a HEPA-filtered clean room, follow emergency medication protocols, and contact a clinician if wheezing worsens.',
    children:
      'Keep children strictly indoors in a sealed, HEPA-filtered space and cancel all outdoor recess and athletics.',
    elderly:
      'Health emergency: stay indoors continuously with active HEPA filtration, arrange delivery for errands, and seek prompt medical care for any cardiopulmonary symptoms.',
  };
  return {
    persona,
    personaLabel,
    riskTier: 'critical',
    headline: 'Very unhealthy to hazardous — remain indoors with HEPA filtration',
    recommendation: recByPersona[persona],
    maskGuidance: 'Mandatory fitted N95/FFP2 respirator if stepping outside is unavoidable.',
    safeOutdoorWindow: 'None recommended; defer non-essential travel',
    actionItems: [
      'Designate one sealed clean-air bedroom with continuous true-HEPA filtration.',
      'Avoid all exposure during 06:00–10:00 morning inversion and 17:00–20:00 evening settling.',
      'Seek immediate medical attention for persistent coughing, wheezing, or chest tightness.',
    ],
    citation,
  };
}

/**
 * Generates a plain-language screen-reader narrative describing the 24-hour forecast chart.
 */
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
