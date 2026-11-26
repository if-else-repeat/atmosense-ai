/**
 * @module personaGuidance
 * Thermal inversion boundary-layer risk assessment and persona-tailored respiratory guidance.
 */

import type {
  InversionAssessment,
  InversionRiskLevel,
  PersonaHealthGuidance,
  PersonaProfile,
} from '../types/aqi';
import { GUIDANCE_TIERS, PERSONA_GUIDANCE_CITATION, PERSONA_LABELS } from './personaTemplates';

/** Computes thermal inversion risk and plain-language atmospheric explanation. */
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

/** Returns tailored, actionable health recommendations based on AQI and selected persona. */
export function getPersonaHealthGuidance(
  aqi: number,
  persona: PersonaProfile,
): PersonaHealthGuidance {
  const safeAqi = Math.max(0, Math.min(500, Math.round(aqi)));
  const selected =
    GUIDANCE_TIERS.find((tier) => safeAqi <= tier.maxAqi)?.template ??
    GUIDANCE_TIERS[GUIDANCE_TIERS.length - 1]!.template;

  return {
    persona,
    personaLabel: PERSONA_LABELS[persona],
    riskTier: selected.riskTier,
    headline: selected.headline,
    recommendation: selected.recByPersona[persona],
    maskGuidance: selected.maskGuidance(persona),
    safeOutdoorWindow: selected.safeOutdoorWindow,
    actionItems: selected.actionItems,
    citation: PERSONA_GUIDANCE_CITATION,
  };
}
