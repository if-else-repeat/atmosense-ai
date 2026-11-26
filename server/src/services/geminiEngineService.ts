/**
 * @module geminiService
 * Secure, strictly server-side Google Gemini AI integration for AtmoSense AI.
 */

import { createHash } from 'node:crypto';
import { type PersonaProfile } from '../../lib/aqiEngine.ts';
import type { GeminiServiceOptions } from './gemini/modelAdapter.ts';
import {
  IMAGE_TASK_INSTRUCTIONS,
  buildChatPrompt,
  buildEmergencyPrompt,
  buildHealthInsightsPrompt,
  buildRoutinePrompt,
} from './gemini/prompts.ts';
import {
  CHAT_RESPONSE_SCHEMA,
  EMERGENCY_RESPONSE_SCHEMA,
  HEALTH_INSIGHTS_RESPONSE_SCHEMA,
  IMAGE_ANALYSIS_RESPONSE_SCHEMA,
  ROUTINE_RESPONSE_SCHEMA,
} from './gemini/responseSchemas.ts';
import { GeminiOperationRunner } from './gemini/runner.ts';
import {
  sanitizeAqiHistory,
  sanitizeChatHistory,
  sanitizeSymptomLogs,
  sanitizeZoneData,
} from './gemini/sanitizers.ts';
import {
  ChatResponseOutputSchema,
  EmergencyAdvisoryOutputSchema,
  GeminiServiceError,
  HealthInsightsOutputSchema,
  ImageAnalysisOutputSchema,
  RoutinePlanOutputSchema,
  createGeminiCacheKey,
  extractJsonText,
  parseBase64Image,
  sanitizeUserInput,
} from './gemini/security.ts';
import {
  buildFallbackChat,
  buildFallbackEmergencyAdvisory,
  buildFallbackHealthInsights,
  buildFallbackImageAnalysis,
  buildFallbackRoutine,
  type AQIDataPoint,
  type ChatContext,
  type ChatMessage,
  type ChatResponse,
  type HealthInsight,
  type ImageAnalysisResult,
  type ImageAnalysisType,
  type RoutinePlan,
  type SymptomLog,
  type ZoneData,
} from './heuristicFallback.ts';

export {
  ATMOSENSE_SYSTEM_INSTRUCTION,
  ChatResponseOutputSchema,
  EmergencyAdvisoryOutputSchema,
  GeminiServiceError,
  HealthInsightItemSchema,
  HealthInsightsOutputSchema,
  ImageAnalysisOutputSchema,
  RoutinePlanOutputSchema,
  RoutineTimeSlotSchema,
  createGeminiCacheKey,
  redactPII,
  sanitizeUserInput,
} from './gemini/security.ts';

export type {
  GeminiLogger,
  GeminiServiceOptions,
  GenerativeModel,
  ModelGenerationRequest,
  ModelGenerationResponse,
} from './gemini/modelAdapter.ts';

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
} from './heuristicFallback.ts';

/** Secure, server-side Google Gemini AI service for AtmoSense AI. */
export class GeminiService {
  private readonly runner: GeminiOperationRunner;

  constructor(options: GeminiServiceOptions = {}) {
    this.runner = new GeminiOperationRunner(options);
  }

  /** 1. Generates a personalized daily air-quality routine with deterministic fallback. */
  async generateDailyRoutine(
    persona: PersonaProfile,
    zone: ZoneData,
    language: string,
    userId = 'default',
  ): Promise<RoutinePlan> {
    const safeZone = sanitizeZoneData(zone);
    const safeLang = sanitizeUserInput(language || 'en', 24) || 'en';
    return this.runner.runCached<RoutinePlan>({
      operation: 'generateDailyRoutine',
      userId,
      cacheKey: createGeminiCacheKey('routine', { persona, zone: safeZone, language: safeLang }),
      logMeta: { aqi: safeZone.aqi },
      execute: async () => {
        const res = await this.runner.invokeModel(
          buildRoutinePrompt(persona, safeZone, safeLang),
          ROUTINE_RESPONSE_SCHEMA,
        );
        const validated = RoutinePlanOutputSchema.parse(JSON.parse(extractJsonText(res.text)));
        return {
          persona,
          zoneName: safeZone.name,
          language: safeLang,
          ...validated,
          generatedBy: 'gemini',
        };
      },
      fallback: (reason) => buildFallbackRoutine(persona, safeZone, safeLang, reason),
    });
  }

  /** 2. Conversational pulmonary & atmospheric science AI assistant with sanitized context. */
  async chat(
    message: string,
    context: ChatContext,
    history: ChatMessage[] = [],
  ): Promise<ChatResponse> {
    const userId = context.userId ?? 'default';
    this.runner.enforceRateLimit(userId, 'chat');
    const safeMessage = sanitizeUserInput(message, 800);
    if (!safeMessage) {
      throw new GeminiServiceError('Message cannot be empty after sanitization.', 400);
    }

    const safeZone = sanitizeZoneData(context.zone);
    const safeLang = sanitizeUserInput(context.language || 'en', 24) || 'en';
    const safeHistory = sanitizeChatHistory(history);
    return this.runner.runCached<ChatResponse>({
      operation: 'chat',
      userId,
      skipRateLimit: true,
      cacheKey: createGeminiCacheKey('chat', {
        message: safeMessage,
        persona: context.persona,
        zone: safeZone,
        language: safeLang,
        history: safeHistory,
      }),
      logMeta: { aqi: safeZone.aqi },
      execute: async () => {
        const res = await this.runner.invokeModel(
          buildChatPrompt(safeMessage, context.persona, safeZone, safeLang, safeHistory),
          CHAT_RESPONSE_SCHEMA,
        );
        const validated = ChatResponseOutputSchema.parse(JSON.parse(extractJsonText(res.text)));
        return { ...validated, generatedBy: 'gemini' };
      },
      fallback: (reason) =>
        buildFallbackChat(safeMessage, { ...context, zone: safeZone, language: safeLang }, reason),
    });
  }

  /** 3. Generates an urgent public-health emergency advisory for elevated pollution episodes. */
  async generateEmergencyAdvisory(
    zone: ZoneData,
    severity: 'moderate' | 'severe' | 'critical',
    language: string,
    userId = 'default',
  ): Promise<string> {
    const safeZone = sanitizeZoneData(zone);
    const safeLang = sanitizeUserInput(language || 'en', 24) || 'en';
    return this.runner.runCached<string>({
      operation: 'generateEmergencyAdvisory',
      userId,
      cacheKey: createGeminiCacheKey('emergency-advisory', {
        zone: safeZone,
        severity,
        language: safeLang,
      }),
      logMeta: { severity, aqi: safeZone.aqi },
      execute: async () => {
        const res = await this.runner.invokeModel(
          buildEmergencyPrompt(safeZone, severity, safeLang),
          EMERGENCY_RESPONSE_SCHEMA,
        );
        const validated = EmergencyAdvisoryOutputSchema.parse(
          JSON.parse(extractJsonText(res.text)),
        );
        return `${validated.advisory}\n\nReferences: ${validated.citations.join(' ')}`;
      },
      fallback: () => buildFallbackEmergencyAdvisory(safeZone, severity, safeLang),
    });
  }

  /** 4. Multimodal image analysis for smog severity, monitor OCR, or N95/FFP2 mask checks. */
  async analyzeImage(
    imageBase64: string,
    analysisType: ImageAnalysisType,
    userId = 'default',
  ): Promise<ImageAnalysisResult> {
    this.runner.enforceRateLimit(userId, 'analyzeImage');
    const { mimeType, data } = parseBase64Image(imageBase64);
    const imageDigest = createHash('sha256').update(data).digest('hex');

    return this.runner.runCached<ImageAnalysisResult>({
      operation: 'analyzeImage',
      userId,
      skipRateLimit: true,
      cacheKey: createGeminiCacheKey('image-analysis', { analysisType, imageDigest }),
      logMeta: { analysisType },
      execute: async () => {
        const res = await this.runner.invokeModel(
          {
            parts: [
              { inlineData: { mimeType, data } },
              {
                text: `${IMAGE_TASK_INSTRUCTIONS[analysisType]}\nReturn structured JSON with summary, severity, confidence (0-1), findings, recommendations, optional estimatedAqiRange, and WHO/EPA scientific citations.`,
              },
            ],
          },
          IMAGE_ANALYSIS_RESPONSE_SCHEMA,
        );
        const validated = ImageAnalysisOutputSchema.parse(JSON.parse(extractJsonText(res.text)));
        return { analysisType, ...validated, generatedBy: 'gemini' };
      },
      fallback: (reason) => buildFallbackImageAnalysis(analysisType, reason),
    });
  }

  /** 5. Generates pulmonary health insights correlating symptom logs with AQI history. */
  async generateHealthInsights(
    symptomLogs: SymptomLog[],
    aqiHistory: AQIDataPoint[],
    userId = 'default',
  ): Promise<HealthInsight[]> {
    const sanitizedLogs = sanitizeSymptomLogs(symptomLogs);
    const sanitizedHistory = sanitizeAqiHistory(aqiHistory);
    if (sanitizedLogs.length === 0) {
      this.runner.enforceRateLimit(userId, 'generateHealthInsights');
      return buildFallbackHealthInsights([], sanitizedHistory);
    }

    return this.runner.runCached<HealthInsight[]>({
      operation: 'generateHealthInsights',
      userId,
      cacheKey: createGeminiCacheKey('health-insights', {
        logs: sanitizedLogs,
        history: sanitizedHistory,
      }),
      logMeta: { logCount: sanitizedLogs.length },
      execute: async () => {
        const res = await this.runner.invokeModel(
          buildHealthInsightsPrompt(sanitizedLogs, sanitizedHistory),
          HEALTH_INSIGHTS_RESPONSE_SCHEMA,
        );
        const validated = HealthInsightsOutputSchema.parse(JSON.parse(extractJsonText(res.text)));
        return validated.insights.map((item) => ({ ...item, generatedBy: 'gemini' }));
      },
      fallback: () => buildFallbackHealthInsights(sanitizedLogs, sanitizedHistory),
    });
  }

  /** Returns sanitized runtime status and cache metrics (never exposes API keys). */
  getServiceStatus() {
    return this.runner.getStatus();
  }

  /** Clears the in-memory SHA-256 response cache. */
  clearCache(): void {
    this.runner.clearCache();
  }
}

/** Shared server-side GeminiService singleton. */
export const geminiService = new GeminiService();
