export type SensitivityProfile = 'general' | 'respiratory' | 'athlete' | 'vulnerable';

export type AqiCategoryKey =
  'good' | 'moderate' | 'sensitive' | 'unhealthy' | 'very_unhealthy' | 'hazardous';

export interface AqiClassification {
  key: AqiCategoryKey;
  label: string;
  shortLabel: string;
  guidance: string;
}

export interface PollutantMetrics {
  pm25: number; // µg/m³
  pm10: number; // µg/m³
  no2: number; // µg/m³
  o3: number; // µg/m³
  so2: number; // µg/m³
  co: number; // µg/m³
}

export interface HourlyPoint {
  hourLabel: string;
  isoTime: string;
  aqi: number;
  pm25: number;
  pm10: number;
  no2: number;
  o3: number;
}

export interface AirQualityStation {
  id: string;
  city: string;
  country: string;
  district: string;
  latitude: number;
  longitude: number;
  aqi: number;
  category: AqiClassification;
  dominantPollutant: 'PM2.5' | 'PM10' | 'NO2' | 'O3';
  whoPm25Ratio: number;
  metrics: PollutantMetrics;
  temperatureC: number;
  humidityPct: number;
  windKph: number;
  hourly: HourlyPoint[];
  bestOutdoorWindow: string;
  source: 'live-open-meteo' | 'calibrated-baseline';
  updatedAt: string;
}

export interface HealthAdvisoryResult {
  outdoorVerdict: string;
  riskLevel: 'low' | 'moderate' | 'elevated' | 'high';
  summary: string;
  recommendedWindow: string;
  protectiveActions: string[];
  pollutantNote: string;
  model: string;
  generatedAt: string;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}
