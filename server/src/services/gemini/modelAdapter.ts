/**
 * @module geminiModelAdapter
 * Typed GenerativeModel adapter backed by `@google/genai` plus per-user sliding-window rate limiter.
 */

import { GoogleGenAI, ThinkingLevel, type Schema } from '@google/genai';
import { GeminiServiceError, isConfiguredApiKey } from './security.ts';

/** Generation parameters passed to the underlying GenerativeModel wrapper. */
export interface ModelGenerationRequest {
  contents:
    | string
    | {
        parts: Array<
          | { text: string }
          | {
              inlineData: {
                mimeType: string;
                data: string;
              };
            }
        >;
      };
  systemInstruction: string;
  responseMimeType?: 'application/json' | 'text/plain';
  responseSchema?: Schema;
  temperature: number;
  maxOutputTokens: number;
}

/** Normalized text result from a model invocation. */
export interface ModelGenerationResponse {
  text: string;
}

/** Typed GenerativeModel contract implemented by production adapter and test doubles. */
export interface GenerativeModel {
  readonly modelName: string;
  generateContent(request: ModelGenerationRequest): Promise<ModelGenerationResponse>;
}

/** Structured logger interface (receives only PII-redacted metadata). */
export interface GeminiLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/** Configuration options for {@link GeminiService}. */
export interface GeminiServiceOptions {
  apiKey?: string;
  modelName?: string;
  model?: GenerativeModel;
  now?: () => number;
  logger?: GeminiLogger;
  cacheTtlMs?: number;
  cacheMaxEntries?: number;
  rateLimitPerMinute?: number;
}

/** Production GenerativeModel adapter backed by `@google/genai`. */
export class GoogleGenAIModelAdapter implements GenerativeModel {
  public readonly modelName: string;
  private readonly apiKey?: string;
  private client: GoogleGenAI | null = null;

  constructor(modelName: string, apiKey?: string) {
    this.modelName = modelName;
    this.apiKey = apiKey;
  }

  private getClient(): GoogleGenAI {
    if (!isConfiguredApiKey(this.apiKey)) {
      throw new GeminiServiceError('GEMINI_API_KEY is not configured on the server.', 503);
    }
    if (!this.client) {
      this.client = new GoogleGenAI({
        apiKey: this.apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'atmosense-ai/1.0',
          },
        },
      });
    }
    return this.client;
  }

  async generateContent(request: ModelGenerationRequest): Promise<ModelGenerationResponse> {
    const ai = this.getClient();
    const isGemini4 = /^gemini-4-(?:hydrogen|neon|argon|carbon)/i.test(this.modelName);

    const config: Record<string, unknown> = {
      systemInstruction: request.systemInstruction,
      responseMimeType: request.responseMimeType ?? 'application/json',
    };

    if (request.responseSchema) {
      config.responseSchema = request.responseSchema;
    }

    if (isGemini4) {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
    } else {
      config.temperature = request.temperature;
      config.maxOutputTokens = request.maxOutputTokens;
    }

    const response = await ai.models.generateContent({
      model: this.modelName,
      contents: request.contents,
      config,
    });

    return { text: response.text ?? '' };
  }
}

/** Per-user sliding-window rate limiter enforcing requests/minute quotas. */
export class UserRateLimiter {
  private readonly buckets = new Map<string, number[]>();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly now: () => number;

  constructor(maxRequests: number, windowMs: number, now: () => number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.now = now;
  }

  checkAndConsume(
    userId: string,
  ): { allowed: true; remaining: number } | { allowed: false; retryAfterSeconds: number } {
    const key = userId.trim() || 'anonymous';
    const current = this.now();
    const cutoff = current - this.windowMs;
    const recent = (this.buckets.get(key) ?? []).filter((ts) => ts > cutoff);

    if (recent.length >= this.maxRequests) {
      const oldest = recent[0] ?? current;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + this.windowMs - current) / 1000));
      this.buckets.set(key, recent);
      return { allowed: false, retryAfterSeconds };
    }

    recent.push(current);
    this.buckets.set(key, recent);
    return { allowed: true, remaining: Math.max(0, this.maxRequests - recent.length) };
  }
}
