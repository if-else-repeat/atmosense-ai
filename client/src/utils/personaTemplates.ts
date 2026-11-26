/**
 * @module personaTemplates
 * Static WHO/EPA-aligned persona advisory templates indexed by AQI risk ceiling.
 */

import type { PersonaHealthGuidance, PersonaProfile } from '../types/aqi';

export const PERSONA_LABELS: Readonly<Record<PersonaProfile, string>> = {
  general: 'General Public',
  asthmatics: 'Asthma & Respiratory',
  children: 'Children & Youth',
  elderly: 'Older Adults (65+)',
};

export const PERSONA_GUIDANCE_CITATION =
  'WHO Global Air Quality Guidelines (2021) · US EPA AQI Guidance';

export interface PersonaTierTemplate {
  riskTier: PersonaHealthGuidance['riskTier'];
  headline: string;
  safeOutdoorWindow: string;
  maskGuidance: (persona: PersonaProfile) => string;
  actionItems: string[];
  recByPersona: Record<PersonaProfile, string>;
}

export const GUIDANCE_TIERS: readonly { maxAqi: number; template: PersonaTierTemplate }[] = [
  {
    maxAqi: 50,
    template: {
      riskTier: 'low',
      headline: 'Clear conditions for normal outdoor activity',
      safeOutdoorWindow: 'All day (peak dispersion 11:00–16:00)',
      maskGuidance: () => 'No respirator required outdoors.',
      actionItems: [
        'Open cross-ventilation windows to refresh indoor air.',
        'Proceed with planned outdoor exercise and errands.',
        'Monitor afternoon ozone if temperatures climb sharply.',
      ],
      recByPersona: {
        general:
          'Air quality is clean with minimal health risk. Ideal conditions for outdoor training, commuting, and opening windows for fresh airflow.',
        asthmatics:
          'Low particulate and ozone load. Continue daily controller medication as prescribed and enjoy normal outdoor routines.',
        children:
          'Safe for outdoor recess, playground play, and youth sports with no duration limits.',
        elderly:
          'Excellent conditions for morning or midday walks, gardening, and natural indoor ventilation.',
      },
    },
  },
  {
    maxAqi: 100,
    template: {
      riskTier: 'moderate',
      headline: 'Acceptable air; sensitive groups should pace exertion',
      safeOutdoorWindow: '11:00–16:00 (convective mixing window)',
      maskGuidance: (p) =>
        p === 'general'
          ? 'Optional near heavy diesel traffic.'
          : 'Keep a fitted N95/FFP2 respirator handy for congested commutes.',
      actionItems: [
        'Prefer 11:00–16:00 for brisk walking or outdoor errands.',
        'Avoid jogging alongside idling traffic between 06:00–10:00 and 17:00–20:00.',
        'Use vehicle cabin air recirculation in slow-moving traffic.',
      ],
      recByPersona: {
        general:
          'Air quality is acceptable for most adults. Schedule intense endurance workouts away from congested arterial roads.',
        asthmatics:
          'Keep a quick-relief inhaler within reach and avoid prolonged vigorous exertion directly beside rush-hour traffic corridors.',
        children:
          'Outdoor play is generally safe; watch unusually sensitive children for coughing or throat irritation during heavy sports.',
        elderly:
          'Light-to-moderate outdoor walks are comfortable; pace exertion and prefer shaded parks over roadside footpaths.',
      },
    },
  },
  {
    maxAqi: 150,
    template: {
      riskTier: 'elevated',
      headline: 'Elevated particulate load — protect sensitive airways',
      safeOutdoorWindow: '11:00–16:00 (brief low-exertion errands only)',
      maskGuidance: (p) =>
        p === 'general'
          ? 'Recommended NIOSH N95/FFP2 respirator during long outdoor commutes.'
          : 'Wear a well-fitting NIOSH N95 or EN149 FFP2 respirator for all outdoor travel.',
      actionItems: [
        'Close exterior windows during 06:00–10:00 morning inversion and 17:00–20:00 traffic peak.',
        'Run a CADR-sized true-HEPA air cleaner in main living rooms.',
        'Move cardio workouts into filtered indoor spaces.',
      ],
      recByPersona: {
        general:
          'Most healthy adults can continue everyday errands, but shorten prolonged high-intensity outdoor training or move workouts indoors.',
        asthmatics:
          'Reduce outdoor exertion, follow your written asthma action plan closely, and run a true-HEPA purifier indoors.',
        children:
          'Shorten prolonged outdoor sports practices and shift high-exertion recess activities indoors or to 11:00–16:00.',
        elderly:
          'Limit prolonged outdoor physical effort, keep exterior windows closed during peak haze, and rest indoors during commute hours.',
      },
    },
  },
  {
    maxAqi: 200,
    template: {
      riskTier: 'high',
      headline: 'Unhealthy air — shift daily activities indoors',
      safeOutdoorWindow: '11:00–16:00 (essential masked errands only)',
      maskGuidance: () =>
        'Wear a well-fitting NIOSH N95/KN95/FFP2 respirator outdoors; cloth and surgical masks do not block PM2.5.',
      actionItems: [
        'Keep doors and windows sealed; avoid indoor combustion (incense, frying smoke).',
        'Operate HEPA filtration on medium-high targeting indoor PM2.5 < 15 µg/m³.',
        'Reschedule outdoor sports and strenuous chores until AQI improves.',
      ],
      recByPersona: {
        general:
          'Reduce prolonged or heavy outdoor exertion, shift exercise indoors, and wear a fitted N95/FFP2 respirator during outdoor travel.',
        asthmatics:
          'Avoid outdoor exertion entirely, run HEPA filtration continuously, and keep rescue bronchodilator medication immediately available.',
        children:
          'Move physical education, playground time, and after-school sports indoors with filtered air.',
        elderly:
          'Avoid outdoor physical exertion, seal exterior windows, and monitor for shortness of breath, fatigue, or chest discomfort.',
      },
    },
  },
  {
    maxAqi: 500,
    template: {
      riskTier: 'critical',
      headline: 'Very unhealthy to hazardous — remain indoors with HEPA filtration',
      safeOutdoorWindow: 'None recommended; defer non-essential travel',
      maskGuidance: () =>
        'Mandatory fitted N95/FFP2 respirator if stepping outside is unavoidable.',
      actionItems: [
        'Designate one sealed clean-air bedroom with continuous true-HEPA filtration.',
        'Avoid all exposure during 06:00–10:00 morning inversion and 17:00–20:00 evening settling.',
        'Seek immediate medical attention for persistent coughing, wheezing, or chest tightness.',
      ],
      recByPersona: {
        general:
          'Emergency-grade particulate levels: avoid all outdoor physical activity, seal indoor rooms, and operate HEPA air cleaning continuously.',
        asthmatics:
          'Critical respiratory alert: stay strictly indoors in a HEPA-filtered clean room, follow emergency medication protocols, and contact a clinician if wheezing worsens.',
        children:
          'Keep children strictly indoors in a sealed, HEPA-filtered space and cancel all outdoor recess and athletics.',
        elderly:
          'Health emergency: stay indoors continuously with active HEPA filtration, arrange delivery for errands, and seek prompt medical care for any cardiopulmonary symptoms.',
      },
    },
  },
];
