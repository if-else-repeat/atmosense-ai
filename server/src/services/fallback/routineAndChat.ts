/**
 * @module fallbackRoutineAndChat
 * Deterministic boundary-layer routine and conversational pulmonary chat fallback generators.
 */

import { getHealthRecommendation, type PersonaProfile } from '../../lib/aqiEngine.ts';
import {
  ATMOSPHERIC_WINDOWS,
  STANDARD_CITATIONS,
  classifyRiskLevel,
  getMaskGuidance,
  type ChatContext,
  type ChatResponse,
  type RoutinePlan,
  type RoutineTimeSlot,
  type ZoneData,
} from './types.ts';

/** Generates a deterministic daily air-quality routine using boundary-layer physics. */
export function buildFallbackRoutine(
  persona: PersonaProfile,
  zone: ZoneData,
  language: string,
  fallbackReason?: string,
): RoutinePlan {
  const boundedAqi = Math.max(0, Math.min(500, Math.round(zone.aqi)));
  const risk = classifyRiskLevel(boundedAqi);
  const advice = getHealthRecommendation(boundedAqi, persona);
  const isSevere = boundedAqi > 150;
  const isSensitive = persona !== 'general';

  const slots: RoutineTimeSlot[] = [
    {
      window: '06:00-10:00',
      riskLevel: boundedAqi > 100 ? 'critical' : 'high',
      activity: isSevere
        ? 'Remain indoors; avoid early-morning outdoor walks or school-run exertion.'
        : 'Keep outdoor activity brief and low-intensity; defer vigorous exercise until late morning.',
      precautions: [
        'Keep windows closed during morning inversion peak.',
        isSensitive
          ? 'Run HEPA air purification and keep prescribed respiratory medication accessible.'
          : 'Use recirculation mode inside vehicles during morning commute.',
      ],
      scientificRationale: ATMOSPHERIC_WINDOWS.morningInversionDanger.reason,
    },
    {
      window: '11:00-16:00',
      riskLevel: boundedAqi > 200 ? 'high' : boundedAqi > 100 ? 'moderate' : 'low',
      activity:
        boundedAqi <= 150
          ? 'Primary safe outdoor window for walks, errands, and brief natural cross-ventilation.'
          : 'Shortest-risk window for essential outdoor errands only; keep exertion light and wear an N95/FFP2 mask.',
      precautions: [
        'Schedule necessary outdoor errands between 11:00 and 16:00 when vertical mixing peaks.',
        boundedAqi > 100
          ? 'Limit vigorous aerobic exercise to under 30 minutes and stay away from highways.'
          : 'Standard hydration and sun protection apply.',
      ],
      scientificRationale: ATMOSPHERIC_WINDOWS.safeOutdoorConvection.reason,
    },
    {
      window: '17:00-20:00',
      riskLevel: boundedAqi > 100 ? 'critical' : 'high',
      activity:
        'Transition indoors before sunset; shift evening workouts to filtered indoor spaces.',
      precautions: [
        'Close exterior doors and windows prior to 17:00 before cold air settles and traps traffic exhaust.',
        getMaskGuidance(boundedAqi, persona),
      ],
      scientificRationale: ATMOSPHERIC_WINDOWS.eveningPeakSettling.reason,
    },
    {
      window: '20:00-06:00',
      riskLevel: risk === 'low' ? 'low' : 'moderate',
      activity: 'Overnight clean-air recovery inside bedrooms with active filtration.',
      precautions: [
        'Operate a true-HEPA purifier on sleep mode targeting indoor PM2.5 below 15 µg/m³ (WHO 24h guideline).',
        'Avoid indoor combustion sources (incense, unvented cooking fumes, candles).',
      ],
      scientificRationale:
        'Nocturnal radiative cooling lowers the planetary boundary layer, causing fine particulates to accumulate outdoors overnight.',
    },
  ];

  return {
    persona,
    zoneName: zone.name,
    language: language || 'en',
    summary: `In ${zone.name} (AQI ${boundedAqi}, PM2.5 ${zone.pm25.toFixed(1)} µg/m³), ${advice} Prefer 11:00-16:00 for outdoor activity when solar convection breaks the thermal inversion, and avoid 06:00-10:00 and 17:00-20:00 peak trapping windows.`,
    safeOutdoorWindow: ATMOSPHERIC_WINDOWS.safeOutdoorConvection.label,
    avoidWindows: [
      ATMOSPHERIC_WINDOWS.morningInversionDanger.label,
      ATMOSPHERIC_WINDOWS.eveningPeakSettling.label,
    ],
    slots,
    maskGuidance: getMaskGuidance(boundedAqi, persona),
    indoorAirActions: [
      'Seal exterior drafts during 06:00-10:00 morning inversion and 17:00-20:00 evening peak.',
      'Run a CADR-matched true-HEPA air purifier continuously when outdoor AQI exceeds 100.',
      'Ventilate briefly during the 11:00-16:00 convective mixing window only if outdoor AQI is below 100.',
    ],
    citations: [...STANDARD_CITATIONS],
    generatedBy: 'heuristic-fallback',
    fallbackReason,
  };
}

/** Generates a deterministic conversational fallback reply grounded in zone AQI and persona. */
export function buildFallbackChat(
  message: string,
  context: ChatContext,
  fallbackReason?: string,
): ChatResponse {
  const boundedAqi = Math.max(0, Math.min(500, Math.round(context.zone.aqi)));
  const advice = getHealthRecommendation(boundedAqi, context.persona);
  const riskLevel = classifyRiskLevel(boundedAqi);
  const lower = message.toLowerCase();

  const focusPoints: string[] = [];
  if (
    lower.includes('run') ||
    lower.includes('exercise') ||
    lower.includes('walk') ||
    lower.includes('outdoor')
  ) {
    focusPoints.push(
      'Best outdoor timing is 11:00-16:00 when solar convection breaks the surface thermal inversion; avoid 06:00-10:00 morning inversion and 17:00-20:00 evening traffic settling.',
    );
  }
  if (lower.includes('mask') || lower.includes('n95')) {
    focusPoints.push(getMaskGuidance(boundedAqi, context.persona));
  }
  if (lower.includes('window') || lower.includes('indoor') || lower.includes('hepa')) {
    focusPoints.push(
      'Keep windows closed during 06:00-10:00 and 17:00-20:00, and run a true-HEPA purifier targeting WHO 24-hour PM2.5 levels below 15 µg/m³.',
    );
  }
  if (focusPoints.length === 0) {
    focusPoints.push(
      'Prioritize outdoor movement between 11:00-16:00 (convective mixing) and avoid 06:00-10:00 morning inversion and 17:00-20:00 evening peak trapping.',
    );
  }

  return {
    reply: `For ${context.zone.name} (current AQI ${boundedAqi}, PM2.5 ${context.zone.pm25.toFixed(1)} µg/m³, profile: ${context.persona}): ${advice} ${focusPoints.join(' ')}`,
    actionItems: [
      `Target safe outdoor window: ${ATMOSPHERIC_WINDOWS.safeOutdoorConvection.label}.`,
      `Avoid peak trapping periods: ${ATMOSPHERIC_WINDOWS.morningInversionDanger.label} and ${ATMOSPHERIC_WINDOWS.eveningPeakSettling.label}.`,
      getMaskGuidance(boundedAqi, context.persona),
    ],
    citations: [...STANDARD_CITATIONS],
    riskLevel,
    generatedBy: 'heuristic-fallback',
    fallbackReason,
  };
}
