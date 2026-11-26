import type { PersonaProfile } from '../../types/aqi';
import type { LifestyleProfile } from '../../utils/smogImpactEngine';

export interface RoutineSlot {
  window: string;
  activity: string;
  status: 'safe' | 'caution' | 'avoid';
  note: string;
}

export interface RoutinePlanView {
  summary: string;
  safeOutdoorWindow: string;
  maskRecommendation: string;
  indoorGuidance: string;
  schedule: RoutineSlot[];
  source: 'gemini' | 'fallback';
}

export interface RoutineApiPayload {
  routine?: {
    summary?: string;
    safeOutdoorWindow?: string;
    safeOutdoorWindows?: string[];
    maskGuidance?: string;
    maskAdvice?: string;
    indoorGuidance?: string;
    indoorAirActions?: string[];
    slots?: Array<{
      window?: string;
      activity?: string;
      riskLevel?: string;
      scientificRationale?: string;
      precautions?: string[];
    }>;
    schedule?: Array<{
      timeWindow?: string;
      activity?: string;
      safetyLevel?: string;
      notes?: string;
    }>;
  };
}

export const PERSONA_OPTIONS: Array<{ value: PersonaProfile; label: string }> = [
  { value: 'general', label: 'General Adult' },
  { value: 'children', label: 'Children' },
  { value: 'elderly', label: 'Elderly (65+)' },
  { value: 'asthmatics', label: 'Asthma / Respiratory' },
];

export function buildLocalRoutinePlan(
  persona: PersonaProfile,
  aqi: number,
  zoneName: string,
  lifestyle?: LifestyleProfile,
): RoutinePlanView {
  const highRisk = aqi >= 151 || (aqi >= 101 && persona !== 'general');
  const safeOutdoorWindow = aqi <= 50 ? '07:00–19:00' : aqi <= 100 ? '11:00–16:00' : '12:00–14:30';
  const maskRecommendation =
    aqi >= 151
      ? 'Fitted N95/KF94 respirator required for all outdoor movement.'
      : aqi >= 101
        ? persona === 'general'
          ? 'Consider N95 mask during prolonged roadside commutes.'
          : 'Wear fitted N95/KN95 outdoors and keep rescue medication ready.'
        : 'No respirator needed under current conditions.';

  const commuteNote =
    lifestyle?.commuteMode === 'solo_car' || lifestyle?.commuteMode === 'motorbike'
      ? 'Surface inversion traps morning tailpipe exhaust — switch to transit, carpool, or recirculated cabin air with HEPA.'
      : 'Surface temperature inversion typically traps peak rush-hour emissions along arterial roads.';

  const eveningIndoorNote =
    lifestyle?.heatingCookingFuel === 'wood_biomass' ||
    lifestyle?.heatingCookingFuel === 'gas_lpg' ||
    lifestyle?.heatingCookingFuel === 'diesel_backup'
      ? 'Boundary layer cools; avoid indoor combustion/wood smoke, vent stove hood, and run MERV-13/HEPA filtration.'
      : 'Boundary layer cools; keep bedrooms sealed and run filtration.';

  return {
    summary: highRisk
      ? `Elevated particulate risk in ${zoneName} (AQI ${Math.round(aqi)}). Shift strenuous activity indoors and use the midday dispersion window.`
      : `Manageable ambient conditions in ${zoneName} (AQI ${Math.round(aqi)}). Best dispersion occurs during late morning to mid-afternoon.`,
    safeOutdoorWindow,
    maskRecommendation,
    indoorGuidance:
      aqi >= 101
        ? 'Keep windows closed during morning/evening rush hours and run HEPA or Corsi-Rosenthal MERV-13 filtration.'
        : 'Cross-ventilate indoors during midday when ambient particulates dip.',
    schedule: [
      {
        window: '06:00–09:30',
        activity: 'Low-Emission Morning Commute / School Run',
        status: aqi >= 101 ? 'avoid' : 'caution',
        note: commuteNote,
      },
      {
        window: safeOutdoorWindow,
        activity: 'Optimal Outdoor Window',
        status: aqi >= 180 ? 'caution' : 'safe',
        note: 'Peak vertical mixing provides lowest particulate concentration of the day.',
      },
      {
        window: '17:30–21:00',
        activity: 'Evening Wind-Down & Indoor IAQ',
        status: highRisk ? 'avoid' : 'caution',
        note: eveningIndoorNote,
      },
    ],
    source: 'fallback',
  };
}

function mapRiskToStatus(level?: string): 'safe' | 'caution' | 'avoid' {
  if (level === 'avoid' || level === 'high' || level === 'critical') return 'avoid';
  if (level === 'caution' || level === 'moderate') return 'caution';
  return 'safe';
}

export function parseRoutineApiResponse(
  payload: RoutineApiPayload,
  persona: PersonaProfile,
  aqi: number,
  zoneName: string,
  lifestyle?: LifestyleProfile,
): RoutinePlanView {
  const routine = payload.routine;
  const localBase = buildLocalRoutinePlan(persona, aqi, zoneName, lifestyle);

  if (!routine || !routine.summary) {
    return localBase;
  }

  const mappedSlots: RoutineSlot[] =
    Array.isArray(routine.slots) && routine.slots.length > 0
      ? routine.slots.map((slot) => ({
          window: slot.window || '11:00–15:00',
          activity: slot.activity || 'Outdoor activity',
          status: mapRiskToStatus(slot.riskLevel),
          note:
            slot.scientificRationale ||
            slot.precautions?.[0] ||
            'Follow WHO/EPA exposure guidance.',
        }))
      : Array.isArray(routine.schedule) && routine.schedule.length > 0
        ? routine.schedule.map((slot) => ({
            window: slot.timeWindow || '11:00–15:00',
            activity: slot.activity || 'Outdoor activity',
            status: mapRiskToStatus(slot.safetyLevel),
            note: slot.notes || 'Follow EPA exposure guidance.',
          }))
        : localBase.schedule;

  return {
    summary: routine.summary,
    safeOutdoorWindow:
      routine.safeOutdoorWindow || routine.safeOutdoorWindows?.[0] || localBase.safeOutdoorWindow,
    maskRecommendation: routine.maskGuidance || routine.maskAdvice || localBase.maskRecommendation,
    indoorGuidance:
      routine.indoorGuidance ||
      (Array.isArray(routine.indoorAirActions) && routine.indoorAirActions.length > 0
        ? routine.indoorAirActions.join(' ')
        : localBase.indoorGuidance),
    schedule: mappedSlots,
    source: 'gemini',
  };
}
