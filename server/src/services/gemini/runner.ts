/**
 * @module geminiRunner
 * Reusable rate-limited, SHA-256 cached Gemini model execution runner with fallback handling.
 */

import { logger } from '../../utils/logger.ts';
import { LRUCache } from '../aqi/cache.ts';
import {
  GoogleGenAIModelAdapter,
  UserRateLimiter,
  type GeminiLogger,
  type GeminiServiceOptions,
  type GenerativeModel,
  type ModelGenerationRequest,
  type ModelGenerationResponse,
} from './modelAdapter.ts';
import { safeGeminiErrorSummary } from './sanitizers.ts';
import {
  ATMOSENSE_SYSTEM_INSTRUCTION,
  GeminiServiceError,
  hashUserTag,
  isConfiguredApiKey,
} from './security.ts';

const DEFAULT_MODEL_NAME = 'gemini-4-hydrogen';
const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_MAX_OUTPUT_TOKENS = 2048;
const DEFAULT_RATE_LIMIT_PER_MINUTE = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_CACHE_MAX_ENTRIES = 200;

const defaultLogger: GeminiLogger = {
  info: (message, meta) => logger.info(`[GeminiService] ${message}`, meta),
  warn: (message, meta) => logger.warn(`[GeminiService] ${message}`, meta),
  error: (message, meta) => logger.error(`[GeminiService] ${message}`, meta),
};

export interface CachedOperationOptions<T> {
  operation: string;
  userId: string;
  cacheKey: string;
  logMeta: Record<string, unknown>;
  skipRateLimit?: boolean;
  execute: () => Promise<T>;
  fallback: (reason: string) => T;
}

/** Handles model invocation, per-user rate limiting, SHA-256 LRU caching, and safe fallback logging. */
export class GeminiOperationRunner {
  readonly model: GenerativeModel;
  readonly apiKeyConfigured: boolean;
  readonly rateLimitPerMinute: number;
  private readonly logger: GeminiLogger;
  private readonly cache: LRUCache<unknown>;
  private readonly rateLimiter: UserRateLimiter;

  constructor(options: GeminiServiceOptions = {}) {
    const resolvedKey = options.apiKey ?? process.env.GEMINI_API_KEY;
    const resolvedModel = options.modelName ?? process.env.GEMINI_MODEL ?? DEFAULT_MODEL_NAME;
    this.apiKeyConfigured = Boolean(options.model) || isConfiguredApiKey(resolvedKey);
    this.model = options.model ?? new GoogleGenAIModelAdapter(resolvedModel, resolvedKey);
    this.logger = options.logger ?? defaultLogger;

    const now = options.now ?? Date.now;
    this.cache = new LRUCache<unknown>(
      options.cacheMaxEntries ?? DEFAULT_CACHE_MAX_ENTRIES,
      options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS,
      now,
    );
    this.rateLimitPerMinute = options.rateLimitPerMinute ?? DEFAULT_RATE_LIMIT_PER_MINUTE;
    this.rateLimiter = new UserRateLimiter(this.rateLimitPerMinute, RATE_LIMIT_WINDOW_MS, now);
  }

  enforceRateLimit(userId: string, operation: string): void {
    const decision = this.rateLimiter.checkAndConsume(userId);
    if (!decision.allowed) {
      this.logger.warn('Per-user AI rate limit exceeded', {
        operation,
        userTag: hashUserTag(userId),
        retryAfterSeconds: decision.retryAfterSeconds,
      });
      throw new GeminiServiceError(
        `AI rate limit exceeded (${this.rateLimitPerMinute} requests/minute per user). Please retry in ${decision.retryAfterSeconds}s.`,
        429,
        decision.retryAfterSeconds,
      );
    }
  }

  invokeModel(
    contents: ModelGenerationRequest['contents'],
    responseSchema: ModelGenerationRequest['responseSchema'],
  ): Promise<ModelGenerationResponse> {
    return this.model.generateContent({
      contents,
      systemInstruction: ATMOSENSE_SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema,
      temperature: DEFAULT_TEMPERATURE,
      maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
    });
  }

  async runCached<T>(opts: CachedOperationOptions<T>): Promise<T> {
    if (!opts.skipRateLimit) this.enforceRateLimit(opts.userId, opts.operation);
    const cached = this.cache.get(opts.cacheKey) as T | undefined;
    if (cached !== undefined) {
      this.logRequest(opts.operation, opts.userId, { cacheHit: true, ...opts.logMeta });
      return typeof cached === 'string' ? cached : structuredClone(cached);
    }

    try {
      const value = await opts.execute();
      this.cache.set(opts.cacheKey, value);
      this.logRequest(opts.operation, opts.userId, {
        cacheHit: false,
        generatedBy: 'gemini',
        ...opts.logMeta,
      });
      return typeof value === 'string' ? value : structuredClone(value);
    } catch (error) {
      const reason = safeGeminiErrorSummary(error);
      this.logger.warn(`Falling back to deterministic heuristics for ${opts.operation}`, {
        operation: opts.operation,
        userTag: hashUserTag(opts.userId),
        ...opts.logMeta,
        reason,
      });
      return opts.fallback(reason);
    }
  }

  getStatus() {
    return {
      model: this.model.modelName,
      configured: this.apiKeyConfigured,
      rateLimitPerMinute: this.rateLimitPerMinute,
      cache: this.cache.stats(),
    };
  }

  clearCache(): void {
    this.cache.clear();
  }

  private logRequest(operation: string, userId: string, meta: Record<string, unknown>): void {
    this.logger.info(`Completed ${operation}`, {
      operation,
      userTag: hashUserTag(userId),
      model: this.model.modelName,
      ...meta,
    });
  }
}
