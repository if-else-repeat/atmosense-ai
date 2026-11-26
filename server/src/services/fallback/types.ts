/**
 * @module fallbackTypes
 * Shared types, atmospheric boundary-layer window definitions, and mask/risk helpers.
 */

import type { PersonaProfile } from '../../lib/aqiEngine.ts';

/** Canonical atmospheric boundary-layer risk windows used by fallback heuristics. */
export const ATMOSPHERIC_WINDOWS = {
  morningInversionDanger: {
    start: '06:00',
    end: '10:00',
    label: '06:00-10:00',
    reason:
      'Morning thermal inversion traps ground-level PM2.5 and traffic emissions near the surface.',
  },
  safeOutdoorConvection: {
    start: '11:00',
    end: '16:00',
    label: '11:00-16:00',
    reason:
      'Solar heating drives vertical convection, breaking the surface inversion and improving dispersion.',
  },
  eveningPeakSettling: {
    start: '17:00',
    end: '20:00',
    label: '17:00-20:00',
    reason:
      'Evening commuter traffic emissions coincide with radiational cooling and cold air settling.',
  },
} as const;

export const STANDARD_CITATIONS: readonly string[] = [
  'WHO Global Air Quality Guidelines (2021): 24-hour PM2.5 guideline 15 µg/m³, PM10 45 µg/m³.',
  'US EPA Technical Assistance Document for the Reporting of Daily Air Quality (AQI, EPA-454/B-18-007).',
];

export interface ZoneData {
  name: string;
  aqi: number;
  pm25: number;
  pm10?: number;
  no2?: number;
  o3?: number;
  co?: number;
  so2?: number;
  dominantPollutant?: string;
  temperatureC?: number;
  humidityPct?: number;
  windKph?: number;
}

export interface RoutineTimeSlot {
  window: string;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  activity: string;
  precautions: string[];
  scientificRationale: string;
}

export interface RoutinePlan {
  persona: PersonaProfile;
  zoneName: string;
  language: string;
  summary: string;
  safeOutdoorWindow: string;
  avoidWindows: string[];
  slots: RoutineTimeSlot[];
  maskGuidance: string;
  indoorAirActions: string[];
  citations: string[];
  generatedBy: 'gemini' | 'heuristic-fallback';
  fallbackReason?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

export interface ChatContext {
  persona: PersonaProfile;
  zone: ZoneData;
  language?: string;
  userId?: string;
}

export interface ChatResponse {
  reply: string;
  actionItems: string[];
  citations: string[];
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  generatedBy: 'gemini' | 'heuristic-fallback';
  fallbackReason?: string;
}

export type ImageAnalysisType = 'smog-severity' | 'aqi-display' | 'mask-check';

export interface ImageAnalysisResult {
  analysisType: ImageAnalysisType;
  summary: string;
  severity: 'low' | 'moderate' | 'high' | 'critical' | 'indeterminate';
  confidence: number;
  findings: string[];
  recommendations: string[];
  estimatedAqiRange?: { min: number; max: number };
  citations: string[];
  generatedBy: 'gemini' | 'heuristic-fallback';
  fallbackReason?: string;
}

export interface SymptomLog {
  timestamp: number;
  symptoms: string[];
  severity: 1 | 2 | 3 | 4 | 5;
  outdoorMinutes?: number;
  notes?: string;
}

export interface AQIDataPoint {
  timestamp: number;
  aqi: number;
  pm25?: number;
  dominantPollutant?: string;
}

export interface HealthInsight {
  title: string;
  finding: string;
  correlationStrength: 'low' | 'moderate' | 'high';
  triggerPollutant: string;
  recommendedAction: string;
  citations: string[];
  generatedBy: 'gemini' | 'heuristic-fallback';
}

export function classifyRiskLevel(aqi: number): 'low' | 'moderate' | 'high' | 'critical' {
  if (aqi <= 50) return 'low';
  if (aqi <= 100) return 'moderate';
  if (aqi <= 200) return 'high';
  return 'critical';
}

export function getMaskGuidance(aqi: number, persona: PersonaProfile): string {
  const sensitive = persona !== 'general';
  if (aqi <= 50) {
    return 'No respiratory protection needed under normal ambient conditions.';
  }
  if (aqi <= 100) {
    return sensitive
      ? 'Keep a well-fitting N95/FFP2 respirator available near congested arterial corridors.'
      : 'Optional near heavy diesel traffic; generally unnecessary for brief outdoor errands.';
  }
  if (aqi <= 150) {
    return sensitive
      ? 'Wear a well-fitting NIOSH N95 or EN149 FFP2 respirator for all outdoor travel.'
      : 'Wear an N95/FFP2 mask during prolonged outdoor commutes or elevated exertion.';
  }
  return 'Mandatory well-fitting N95/KN95/FFP2 respirator whenever stepping outdoors; surgical or cloth masks do not effectively filter PM2.5.';
}
