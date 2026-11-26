/**
 * @module fallbackAdvisoryAndInsights
 * Deterministic emergency advisory, multimodal image fallback, and symptom-AQI correlation insights.
 */

import { getAQIColor } from '../../../lib/aqiEngine.ts';
import {
  STANDARD_CITATIONS,
  type AQIDataPoint,
  type HealthInsight,
  type ImageAnalysisResult,
  type ImageAnalysisType,
  type SymptomLog,
  type ZoneData,
} from './types.ts';

/** Generates a deterministic emergency air quality advisory bulletin with WHO/EPA citations. */
export function buildFallbackEmergencyAdvisory(
  zone: ZoneData,
  severity: 'moderate' | 'severe' | 'critical',
  language: string,
): string {
  const boundedAqi = Math.max(0, Math.min(500, Math.round(zone.aqi)));
  const color = getAQIColor(boundedAqi);
  const dominant = (zone.dominantPollutant || 'PM2.5').toUpperCase();

  const headerMap: Record<'moderate' | 'severe' | 'critical', string> = {
    moderate: 'AIR QUALITY ADVISORY (MODERATE ALERT)',
    severe: 'SEVERE AIR QUALITY HEALTH WARNING',
    critical: 'CRITICAL AIR QUALITY EMERGENCY ALERT',
  };

  const actionMap: Record<'moderate' | 'severe' | 'critical', string> = {
    moderate:
      'Sensitive groups (children, older adults, and individuals with asthma or cardiopulmonary disease) should curtail prolonged outdoor exertion, limit errands to the 11:00-16:00 convective dispersion window, and avoid 06:00-10:00 morning inversion and 17:00-20:00 evening traffic peaks.',
    severe:
      'All residents should cancel outdoor athletic activities, keep windows sealed during 06:00-10:00 and 17:00-20:00 trapping periods, operate HEPA filtration indoors, and wear a well-fitting N95/FFP2 respirator for unavoidable outdoor transit.',
    critical:
      'Health emergency: everyone must remain indoors in a sealed, HEPA-filtered clean-air room with zero outdoor exertion. Avoid exposure completely during the 06:00-10:00 morning inversion and 17:00-20:00 evening settling peaks, wear a fitted N95/FFP2 respirator if evacuation or essential travel is unavoidable, and seek immediate medical care for wheezing, chest pain, or shortness of breath.',
  };

  return [
    `${headerMap[severity]} — ${zone.name} [${language || 'en'}]`,
    `Measured AQI: ${boundedAqi} (Tier Color: ${color}) | PM2.5: ${zone.pm25.toFixed(1)} µg/m³ | Dominant Pollutant: ${dominant}.`,
    `Immediate Guidance: ${actionMap[severity]}`,
    'Atmospheric Dispersion Note: Solar convection between 11:00-16:00 provides the highest vertical mixing; surface stagnation peaks during 06:00-10:00 and 17:00-20:00.',
    `Scientific References: ${STANDARD_CITATIONS.join(' ')}`,
  ].join('\n');
}

/** Generates a safe deterministic fallback response when multimodal image analysis cannot reach Gemini. */
export function buildFallbackImageAnalysis(
  analysisType: ImageAnalysisType,
  fallbackReason?: string,
): ImageAnalysisResult {
  const detailsByType: Record<
    ImageAnalysisType,
    { summary: string; findings: string[]; recommendations: string[] }
  > = {
    'smog-severity': {
      summary:
        'Live visual smog classification is temporarily unavailable; rely on reference station AQI telemetry and visibility guidelines.',
      findings: [
        'Automated vision model could not inspect horizon visibility or aerosol haze density.',
        'Visual haze alone cannot reliably quantify sub-micron PM2.5 concentrations under high humidity.',
      ],
      recommendations: [
        'Verify live PM2.5/AQI readings from ground monitoring stations before outdoor exercise.',
        'If distant landmarks (<2 km) appear obscured by yellow-gray haze, treat conditions as elevated and prefer 11:00-16:00 for brief errands.',
      ],
    },
    'aqi-display': {
      summary:
        'Automated OCR of the air quality monitor display is temporarily unavailable; please enter the numeric PM2.5/AQI reading directly.',
      findings: [
        'Display digit extraction requires the live multimodal vision backend.',
        'Confirm whether your handheld monitor reports raw PM2.5 (µg/m³) or converted US EPA AQI.',
      ],
      recommendations: [
        'Compare handheld readings against WHO 24-hour PM2.5 guideline (15 µg/m³) and US EPA breakpoints.',
        'Ensure laser-scattering sensors are operated away from steam or direct kitchen aerosols.',
      ],
    },
    'mask-check': {
      summary:
        'Automated respirator fit inspection is temporarily unavailable; perform a manual seal check before entering polluted air.',
      findings: [
        'Visual seal verification requires the live multimodal vision backend.',
        'Effective PM2.5 filtration requires a NIOSH N95, EN149 FFP2, or certified KN95 respirator with zero perimeter gaps.',
      ],
      recommendations: [
        'Mold the nose wire firmly across the nasal bridge and verify both headstraps/earloops sit snugly.',
        'Perform a positive/negative pressure user seal check: the mask should flex slightly inward on brisk inhalation with no air leaking around the eyes or cheeks.',
      ],
    },
  };

  const selected = detailsByType[analysisType];
  return {
    analysisType,
    summary: selected.summary,
    severity: 'indeterminate',
    confidence: 0.25,
    findings: selected.findings,
    recommendations: selected.recommendations,
    citations: [...STANDARD_CITATIONS],
    generatedBy: 'heuristic-fallback',
    fallbackReason,
  };
}

/** Generates deterministic clinical/environmental insights correlating symptom logs with AQI history. */
export function buildFallbackHealthInsights(
  symptomLogs: SymptomLog[],
  aqiHistory: AQIDataPoint[],
): HealthInsight[] {
  if (symptomLogs.length === 0) {
    return [
      {
        title: 'Insufficient Symptom History',
        finding:
          'No respiratory symptom logs are recorded yet to establish personal AQI sensitivity thresholds.',
        correlationStrength: 'low',
        triggerPollutant: 'PM2.5',
        recommendedAction:
          'Log daily symptoms alongside outdoor duration during 06:00-10:00, 11:00-16:00, and 17:00-20:00 windows to identify personal triggers.',
        citations: [...STANDARD_CITATIONS],
        generatedBy: 'heuristic-fallback',
      },
    ];
  }

  const paired: Array<{ log: SymptomLog; aqi: number; pollutant: string }> = [];
  for (const log of symptomLogs) {
    let bestPoint: AQIDataPoint | null = null;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (const point of aqiHistory) {
      const delta = Math.abs(point.timestamp - log.timestamp);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestPoint = point;
      }
    }
    if (bestPoint && bestDelta <= 24 * 60 * 60 * 1000) {
      paired.push({ log, aqi: bestPoint.aqi, pollutant: bestPoint.dominantPollutant || 'PM2.5' });
    }
  }

  const highAqiPairs = paired.filter((p) => p.aqi > 100);
  const lowAqiPairs = paired.filter((p) => p.aqi <= 100);
  const avgHighSeverity =
    highAqiPairs.length > 0
      ? highAqiPairs.reduce((sum, p) => sum + p.log.severity, 0) / highAqiPairs.length
      : 0;
  const avgLowSeverity =
    lowAqiPairs.length > 0
      ? lowAqiPairs.reduce((sum, p) => sum + p.log.severity, 0) / lowAqiPairs.length
      : 0;

  const symptomCounts = new Map<string, number>();
  for (const log of symptomLogs) {
    for (const symptom of log.symptoms) {
      const normalized = symptom.trim().toLowerCase();
      if (normalized) symptomCounts.set(normalized, (symptomCounts.get(normalized) ?? 0) + 1);
    }
  }
  const topSymptom =
    [...symptomCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'respiratory irritation';

  const triggerPollutant = paired[0]?.pollutant ?? 'PM2.5';
  const severityGap = avgHighSeverity - avgLowSeverity;
  const correlationStrength: 'low' | 'moderate' | 'high' =
    highAqiPairs.length >= 2 && (severityGap >= 1.2 || avgHighSeverity >= 3.5)
      ? 'high'
      : highAqiPairs.length >= 1 && avgHighSeverity >= 2.5
        ? 'moderate'
        : 'low';

  return [
    {
      title: 'Particulate Exposure & Symptom Pattern',
      finding:
        highAqiPairs.length > 0
          ? `Across ${symptomLogs.length} logged episodes, "${topSymptom}" was the most frequent symptom, averaging severity ${avgHighSeverity.toFixed(1)}/5 when AQI exceeded 100${lowAqiPairs.length > 0 ? ` compared to ${avgLowSeverity.toFixed(1)}/5 on cleaner days` : ''}.`
          : `Across ${symptomLogs.length} logged episodes, "${topSymptom}" occurred predominantly during moderate or cleaner ambient AQI periods; indoor allergens or localized traffic micro-plumes may be contributing.`,
      correlationStrength,
      triggerPollutant,
      recommendedAction:
        correlationStrength === 'high'
          ? 'Shift all outdoor exposure into the 11:00-16:00 solar convection window, wear a fitted N95/FFP2 respirator above AQI 100, and discuss an updated asthma/airway action plan with a clinician.'
          : 'Continue logging symptoms with time-of-day context and avoid 06:00-10:00 morning inversion and 17:00-20:00 evening traffic peaks.',
      citations: [...STANDARD_CITATIONS],
      generatedBy: 'heuristic-fallback',
    },
    {
      title: 'Diurnal Boundary-Layer Timing Optimization',
      finding:
        'Surface thermal inversions between 06:00-10:00 and evening traffic settling between 17:00-20:00 concentrate fine particulates near breathing height.',
      correlationStrength: highAqiPairs.length > 0 ? 'moderate' : 'low',
      triggerPollutant: 'PM2.5',
      recommendedAction:
        'Prioritize outdoor exercise and ventilation during 11:00-16:00 when solar convection disperses ground-level plumes, and run HEPA filtration overnight.',
      citations: [...STANDARD_CITATIONS],
      generatedBy: 'heuristic-fallback',
    },
  ];
}
