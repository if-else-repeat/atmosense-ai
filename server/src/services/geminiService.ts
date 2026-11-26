/**
 * @module geminiService
 * Unified, strictly server-side Google Gemini AI service for AtmoSense AI.
 */

import { createHash } from 'node:crypto';
import type { PersonaProfile } from '../lib/aqiEngine.ts';
import * as deps from './gemini/deps.ts';
import type {
  AQIDataPoint,
  ChatContext,
  ChatMessage,
  ChatResponse,
  GeminiServiceOptions,
  HealthInsight,
  ImageAnalysisResult,
  ImageAnalysisType,
  RoutinePlan,
  SymptomLog,
  ZoneData,
} from './gemini/deps.ts';

export { generateAirQualityChatReply, generateHealthAdvisory } from './gemini/stationBrief.ts';
export { scanPromptInjection, validateGeminiOutputSafety } from './gemini/outputGuard.ts';
export * from './gemini/security.ts';
export type * from './gemini/modelAdapter.ts';
export type * from './heuristicFallback.ts';

function assertSafeOutput(text: string, groundedAqi?: number): void {
  const verdict = deps.validateGeminiOutputSafety(text, { groundedAqi });
  if (!verdict.safe) {
    throw new Error(verdict.reason ?? 'Gemini output failed safety guardrail.');
  }
}

export class GeminiService {
  private readonly runner: deps.GeminiOperationRunner;

  constructor(options: GeminiServiceOptions = {}) {
    this.runner = new deps.GeminiOperationRunner(options);
  }

  async generateDailyRoutine(
    persona: PersonaProfile,
    zone: ZoneData,
    language: string,
    userId = 'default',
  ): Promise<RoutinePlan> {
    const safeZone = deps.sanitizeZoneData(zone);
    const safeLang = deps.sanitizeUserInput(language || 'en', 24) || 'en';
    return this.runner.runCached<RoutinePlan>({
      operation: 'generateDailyRoutine',
      userId,
      cacheKey: deps.createGeminiCacheKey('routine', {
        persona,
        zone: safeZone,
        language: safeLang,
      }),
      logMeta: { aqi: safeZone.aqi },
      execute: async () => {
        const res = await this.runner.invokeModel(
          deps.buildRoutinePrompt(persona, safeZone, safeLang),
          deps.ROUTINE_RESPONSE_SCHEMA,
        );
        const validated = deps.RoutinePlanOutputSchema.parse(
          JSON.parse(deps.extractJsonText(res.text)),
        );
        assertSafeOutput(
          `${validated.summary} ${validated.maskGuidance} ${validated.indoorAirActions.join(' ')}`,
          safeZone.aqi,
        );
        return {
          persona,
          zoneName: safeZone.name,
          language: safeLang,
          ...validated,
          generatedBy: 'gemini',
        };
      },
      fallback: (reason) => deps.buildFallbackRoutine(persona, safeZone, safeLang, reason),
    });
  }

  async chat(
    message: string,
    context: ChatContext,
    history: ChatMessage[] = [],
  ): Promise<ChatResponse> {
    const userId = context.userId ?? 'default';
    this.runner.enforceRateLimit(userId, 'chat');
    const injectionScan = deps.scanPromptInjection(message);
    const safeMessage = deps.sanitizeUserInput(message, 800);
    if (!safeMessage) {
      throw new deps.GeminiServiceError('Message cannot be empty after sanitization.', 400);
    }

    const safeZone = deps.sanitizeZoneData(context.zone);
    const safeLang = deps.sanitizeUserInput(context.language || 'en', 24) || 'en';
    const safeHistory = deps.sanitizeChatHistory(history);
    return this.runner.runCached<ChatResponse>({
      operation: 'chat',
      userId,
      skipRateLimit: true,
      cacheKey: deps.createGeminiCacheKey('chat', {
        message: safeMessage,
        persona: context.persona,
        zone: safeZone,
        language: safeLang,
        history: safeHistory,
      }),
      logMeta: { aqi: safeZone.aqi, injectionDetected: injectionScan.detected },
      execute: async () => {
        const res = await this.runner.invokeModel(
          deps.buildChatPrompt(safeMessage, context.persona, safeZone, safeLang, safeHistory),
          deps.CHAT_RESPONSE_SCHEMA,
        );
        const validated = deps.ChatResponseOutputSchema.parse(
          JSON.parse(deps.extractJsonText(res.text)),
        );
        assertSafeOutput(`${validated.reply} ${validated.actionItems.join(' ')}`, safeZone.aqi);
        return { ...validated, generatedBy: 'gemini' };
      },
      fallback: (reason) =>
        deps.buildFallbackChat(
          safeMessage,
          { ...context, zone: safeZone, language: safeLang },
          reason,
        ),
    });
  }

  async generateEmergencyAdvisory(
    zone: ZoneData,
    severity: 'moderate' | 'severe' | 'critical',
    language: string,
    userId = 'default',
  ): Promise<string> {
    const safeZone = deps.sanitizeZoneData(zone);
    const safeLang = deps.sanitizeUserInput(language || 'en', 24) || 'en';
    return this.runner.runCached<string>({
      operation: 'generateEmergencyAdvisory',
      userId,
      cacheKey: deps.createGeminiCacheKey('emergency-advisory', {
        zone: safeZone,
        severity,
        language: safeLang,
      }),
      logMeta: { severity, aqi: safeZone.aqi },
      execute: async () => {
        const res = await this.runner.invokeModel(
          deps.buildEmergencyPrompt(safeZone, severity, safeLang),
          deps.EMERGENCY_RESPONSE_SCHEMA,
        );
        const validated = deps.EmergencyAdvisoryOutputSchema.parse(
          JSON.parse(deps.extractJsonText(res.text)),
        );
        assertSafeOutput(validated.advisory, safeZone.aqi);
        return `${validated.advisory}\n\nReferences: ${validated.citations.join(' ')}`;
      },
      fallback: () => deps.buildFallbackEmergencyAdvisory(safeZone, severity, safeLang),
    });
  }

  async analyzeImage(
    imageBase64: string,
    analysisType: ImageAnalysisType,
    userId = 'default',
  ): Promise<ImageAnalysisResult> {
    this.runner.enforceRateLimit(userId, 'analyzeImage');
    const { mimeType, data } = deps.parseBase64Image(imageBase64);
    const imageDigest = createHash('sha256').update(data).digest('hex');

    return this.runner.runCached<ImageAnalysisResult>({
      operation: 'analyzeImage',
      userId,
      skipRateLimit: true,
      cacheKey: deps.createGeminiCacheKey('image-analysis', { analysisType, imageDigest }),
      logMeta: { analysisType },
      execute: async () => {
        const res = await this.runner.invokeModel(
          {
            parts: [
              { inlineData: { mimeType, data } },
              {
                text: `${deps.IMAGE_TASK_INSTRUCTIONS[analysisType]}\nReturn JSON with summary, severity, confidence (0-1), findings, recommendations, optional estimatedAqiRange, and WHO/EPA citations.`,
              },
            ],
          },
          deps.IMAGE_ANALYSIS_RESPONSE_SCHEMA,
        );
        const validated = deps.ImageAnalysisOutputSchema.parse(
          JSON.parse(deps.extractJsonText(res.text)),
        );
        assertSafeOutput(`${validated.summary} ${validated.recommendations.join(' ')}`);
        return { analysisType, ...validated, generatedBy: 'gemini' };
      },
      fallback: (reason) => deps.buildFallbackImageAnalysis(analysisType, reason),
    });
  }

  async generateHealthInsights(
    symptomLogs: SymptomLog[],
    aqiHistory: AQIDataPoint[],
    userId = 'default',
  ): Promise<HealthInsight[]> {
    const sanitizedLogs = deps.sanitizeSymptomLogs(symptomLogs);
    const sanitizedHistory = deps.sanitizeAqiHistory(aqiHistory);
    if (sanitizedLogs.length === 0) {
      this.runner.enforceRateLimit(userId, 'generateHealthInsights');
      return deps.buildFallbackHealthInsights([], sanitizedHistory);
    }

    return this.runner.runCached<HealthInsight[]>({
      operation: 'generateHealthInsights',
      userId,
      cacheKey: deps.createGeminiCacheKey('health-insights', {
        logs: sanitizedLogs,
        history: sanitizedHistory,
      }),
      logMeta: { logCount: sanitizedLogs.length },
      execute: async () => {
        const res = await this.runner.invokeModel(
          deps.buildHealthInsightsPrompt(sanitizedLogs, sanitizedHistory),
          deps.HEALTH_INSIGHTS_RESPONSE_SCHEMA,
        );
        const validated = deps.HealthInsightsOutputSchema.parse(
          JSON.parse(deps.extractJsonText(res.text)),
        );
        for (const item of validated.insights) {
          assertSafeOutput(`${item.finding} ${item.recommendedAction}`);
        }
        return validated.insights.map((item) => ({ ...item, generatedBy: 'gemini' }));
      },
      fallback: () => deps.buildFallbackHealthInsights(sanitizedLogs, sanitizedHistory),
    });
  }

  getServiceStatus() {
    return this.runner.getStatus();
  }

  clearCache(): void {
    this.runner.clearCache();
  }
}

export const geminiService = new GeminiService();
