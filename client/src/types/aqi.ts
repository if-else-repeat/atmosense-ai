/**
 * @module aqiTypes
 * Strict TypeScript domain models for the AtmoSense AI live Dashboard,
 * pollutant trend cards, 24-hour SVG forecast chart, inversion indicator,
 * and persona-based health recommendations.
 */

/** Supported user sensitivity personas for respiratory guidance. */
export type PersonaProfile = 'general' | 'children' | 'elderly' | 'asthmatics';

/** Standard US EPA 6-tier AQI category labels. */
export type AQICategoryLabel =
  | 'Good'
  | 'Moderate'
  | 'Unhealthy for Sensitive Groups'
  | 'Unhealthy'
  | 'Very Unhealthy'
  | 'Hazardous';

/** Individual pollutant identifiers rendered in the dashboard grid. */
export type PollutantId = 'pm25' | 'pm10' | 'no2' | 'co' | 'o3';

/** Direction of short-term pollutant concentration movement. */
export type TrendDirection = 'rising' | 'falling' | 'steady';

/** Thermal inversion trapping risk severity. */
export type InversionRiskLevel = 'low' | 'moderate' | 'high';

/** Normalized metric payload for a single PollutantCard. */
export interface PollutantMetricCardData {
  id: PollutantId;
  label: string;
  formula: string;
  value: number;
  unit: string;
  guidelineValue: number;
  guidelineLabel: string;
  trend: TrendDirection;
  deltaPercent: number;
  history: number[];
  status: 'good' | 'moderate' | 'elevated' | 'high';
}

/** Single hourly point for the native SVG 24-hour forecast chart. */
export interface ForecastHourlyPoint {
  hourLabel: string;
  isoTime: string;
  aqi: number;
  pm25: number;
  pm10: number;
  no2: number;
  o3: number;
  co: number;
}

/** Plain-language thermal inversion assessment. */
export interface InversionAssessment {
  level: InversionRiskLevel;
  label: string;
  headline: string;
  explanation: string;
  dispersionWindow: string;
  windKph: number;
  humidityPct: number;
  temperatureC: number;
  currentPeriod: 'morning-inversion' | 'convective-mixing' | 'evening-settling' | 'overnight';
}

/** Tailored clinical guidance for a persona at the active AQI tier. */
export interface PersonaHealthGuidance {
  persona: PersonaProfile;
  personaLabel: string;
  riskTier: 'low' | 'moderate' | 'elevated' | 'high' | 'critical';
  headline: string;
  recommendation: string;
  maskGuidance: string;
  safeOutdoorWindow: string;
  actionItems: string[];
  citation: string;
}

/** Aggregated live dashboard telemetry snapshot returned by `useAQI`. */
export interface AQIDashboardData {
  aqi: number;
  category: AQICategoryLabel;
  dominantPollutant: string;
  pm25: number;
  pm10: number;
  no2: number;
  co: number;
  o3: number;
  so2: number;
  temperatureC: number;
  humidityPct: number;
  windKph: number;
  location: {
    lat: number;
    lng: number;
    name: string;
    district?: string;
  };
  source: string;
  confidence: number;
  updatedAt: number;
  forecast: ForecastHourlyPoint[];
  pollutants: PollutantMetricCardData[];
}

/** Configuration options accepted by the `useAQI` hook. */
export interface UseAQIOptions {
  lat: number;
  lng: number;
  locationName?: string;
  district?: string;
  persona?: PersonaProfile;
  /** Auto-refresh interval in milliseconds (defaults to 10 minutes = 600,000 ms). */
  refreshIntervalMs?: number;
  /** Optional station ID for fallback telemetry alignment. */
  stationId?: string;
  /** Optional live local weather telemetry from station feed. */
  weather?: {
    temperatureC: number;
    humidityPct: number;
    windKph: number;
  };
}

/** Return value from the `useAQI` custom hook. */
export interface UseAQIResult {
  data: AQIDashboardData | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  isOffline: boolean;
  isFromCache: boolean;
  serviceWorkerActive: boolean;
  lastUpdatedText: string;
  nextRefreshSeconds: number;
  refresh: () => Promise<void>;
}
