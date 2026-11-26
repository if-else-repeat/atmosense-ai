/**
 * @module aqiGuidance
 * Persona-tailored respiratory health recommendations and accessible AQI tier colors.
 */

import { assertNonNegativeFinite } from './aqiBreakpoints.ts';

export type AQICategoryLabel =
  | 'Good'
  | 'Moderate'
  | 'Unhealthy for Sensitive Groups'
  | 'Unhealthy'
  | 'Very Unhealthy'
  | 'Hazardous';

export type PersonaProfile = 'children' | 'elderly' | 'asthmatics' | 'general';

const VALID_PERSONAS: ReadonlySet<PersonaProfile> = new Set([
  'children',
  'elderly',
  'asthmatics',
  'general',
]);

/** Maps a numeric AQI value (0–500+) to its US EPA category label. */
export function resolveCategoryLabel(aqi: number): AQICategoryLabel {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
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

/** Returns tailored respiratory health guidance for a given AQI value and persona. */
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

/** Returns the UI hex color code (`#RRGGBB`) corresponding to the given AQI value. */
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
