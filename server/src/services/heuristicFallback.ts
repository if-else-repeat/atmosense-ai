/**
 * @module heuristicFallback
 * Deterministic atmospheric-science and pulmonary-health fallback heuristics barrel.
 */

export {
  ATMOSPHERIC_WINDOWS,
  type AQIDataPoint,
  type ChatContext,
  type ChatMessage,
  type ChatResponse,
  type HealthInsight,
  type ImageAnalysisResult,
  type ImageAnalysisType,
  type RoutinePlan,
  type RoutineTimeSlot,
  type SymptomLog,
  type ZoneData,
} from './fallback/types.ts';
export { buildFallbackChat, buildFallbackRoutine } from './fallback/routineAndChat.ts';
export {
  buildFallbackEmergencyAdvisory,
  buildFallbackHealthInsights,
  buildFallbackImageAnalysis,
} from './fallback/advisoryAndInsights.ts';
