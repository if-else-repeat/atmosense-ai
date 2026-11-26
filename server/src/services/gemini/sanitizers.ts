/**
 * @module geminiSanitizers
 * Input sanitization helpers for GeminiService requests (zones, symptom logs, AQI history).
 */

import type { AQIDataPoint, ChatMessage, SymptomLog, ZoneData } from '../heuristicFallback.ts';
import { redactPII, sanitizeUserInput } from './security.ts';

export function sanitizeZoneData(zone: ZoneData): ZoneData {
  return {
    ...zone,
    name: sanitizeUserInput(redactPII(zone.name), 120) || 'Selected Urban Zone',
    aqi: Math.max(0, Math.min(500, Number.isFinite(zone.aqi) ? Math.round(zone.aqi) : 0)),
    pm25: Math.max(0, Number.isFinite(zone.pm25) ? zone.pm25 : 0),
    dominantPollutant: zone.dominantPollutant
      ? sanitizeUserInput(zone.dominantPollutant, 24)
      : undefined,
  };
}

export function sanitizeChatHistory(history: ChatMessage[]): ChatMessage[] {
  return history.slice(-10).map((turn) => ({
    role: turn.role,
    content: sanitizeUserInput(turn.content, 600),
  }));
}

export function sanitizeSymptomLogs(symptomLogs: SymptomLog[]): SymptomLog[] {
  return symptomLogs.slice(-60).map((log) => ({
    timestamp: log.timestamp,
    symptoms: log.symptoms
      .slice(0, 10)
      .map((s) => sanitizeUserInput(s, 60))
      .filter(Boolean),
    severity: log.severity,
    outdoorMinutes: log.outdoorMinutes,
    notes: log.notes ? sanitizeUserInput(redactPII(log.notes), 240) : undefined,
  }));
}

export function sanitizeAqiHistory(aqiHistory: AQIDataPoint[]): AQIDataPoint[] {
  return aqiHistory.slice(-120).map((pt) => ({
    timestamp: pt.timestamp,
    aqi: Math.max(0, Math.min(500, Math.round(pt.aqi))),
    pm25: pt.pm25,
    dominantPollutant: pt.dominantPollutant
      ? sanitizeUserInput(pt.dominantPollutant, 24)
      : undefined,
  }));
}

export function safeGeminiErrorSummary(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return redactPII(raw).slice(0, 240);
}
