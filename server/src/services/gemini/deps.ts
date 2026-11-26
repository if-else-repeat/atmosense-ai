/**
 * @module geminiDeps
 * Internal barrel aggregating Gemini prompts, schemas, sanitizers, guardrails, and fallbacks.
 */

export { scanPromptInjection, validateGeminiOutputSafety } from './outputGuard.ts';
export {
  IMAGE_TASK_INSTRUCTIONS,
  buildChatPrompt,
  buildEmergencyPrompt,
  buildHealthInsightsPrompt,
  buildRoutinePrompt,
} from './prompts.ts';
export {
  CHAT_RESPONSE_SCHEMA,
  EMERGENCY_RESPONSE_SCHEMA,
  HEALTH_INSIGHTS_RESPONSE_SCHEMA,
  IMAGE_ANALYSIS_RESPONSE_SCHEMA,
  ROUTINE_RESPONSE_SCHEMA,
} from './responseSchemas.ts';
export { GeminiOperationRunner } from './runner.ts';
export {
  sanitizeAqiHistory,
  sanitizeChatHistory,
  sanitizeSymptomLogs,
  sanitizeZoneData,
} from './sanitizers.ts';
export * from './security.ts';
export {
  buildFallbackChat,
  buildFallbackEmergencyAdvisory,
  buildFallbackHealthInsights,
  buildFallbackImageAnalysis,
  buildFallbackRoutine,
} from '../heuristicFallback.ts';
export type {
  AQIDataPoint,
  ChatContext,
  ChatMessage,
  ChatResponse,
  HealthInsight,
  ImageAnalysisResult,
  ImageAnalysisType,
  RoutinePlan,
  SymptomLog,
  ZoneData,
} from '../heuristicFallback.ts';
export type {
  GeminiLogger,
  GeminiServiceOptions,
  GenerativeModel,
  ModelGenerationRequest,
  ModelGenerationResponse,
} from './modelAdapter.ts';
