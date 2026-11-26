/**
 * @module aqiHttpClient
 * Resilient HTTP JSON transport with rate limiting, timeouts, exponential backoff,
 * HTTP 429 cooldowns, silent HTTP 410 circuit-breaking, and secret-redacted logging.
 */

import type { AQILogger, AQISourceName } from './types.ts';
import { parseRetryAfterMs, redactUrlSecrets, type SourceRateLimiter } from './utils.ts';

export interface UpstreamFetchContext {
  fetchFn: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  logger: AQILogger;
  maxRetries: number;
  baseRetryDelayMs: number;
  requestTimeoutMs: number;
  rateLimiters: Record<AQISourceName, SourceRateLimiter>;
  retiredSources: Set<AQISourceName>;
}

/**
 * Executes an upstream JSON request with per-source rate limiting, timeouts,
 * exponential backoff retries on transient errors, and secret-redacted logging.
 */
export async function fetchUpstreamJson<T>(
  ctx: UpstreamFetchContext,
  source: AQISourceName,
  url: string,
  init?: RequestInit,
): Promise<T | null> {
  if (ctx.retiredSources.has(source)) {
    return null;
  }

  const safeUrl = redactUrlSecrets(url);
  const limiter = ctx.rateLimiters[source];

  for (let attempt = 0; attempt <= ctx.maxRetries; attempt++) {
    if (!limiter.tryAcquire()) {
      ctx.logger.warn(`Rate limit active for ${source}; skipping upstream call`, {
        source,
        url: safeUrl,
      });
      return null;
    }

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), ctx.requestTimeoutMs);

    try {
      const response = await ctx.fetchFn(url, {
        ...init,
        signal: controller.signal,
      });

      if (response.status === 429) {
        const retryAfterMs =
          parseRetryAfterMs(response.headers?.get?.('retry-after') ?? null) ??
          ctx.baseRetryDelayMs * Math.pow(2, attempt + 1);
        limiter.applyCooldown(retryAfterMs);
        ctx.logger.warn(`Upstream ${source} returned HTTP 429 (rate limited)`, {
          source,
          attempt: attempt + 1,
          retryAfterMs,
        });
        return null;
      }

      if (response.status === 410) {
        ctx.retiredSources.add(source);
        return null;
      }

      if (!response.ok) {
        const isRetryable = response.status >= 500 || response.status === 408;
        ctx.logger.warn(`Upstream ${source} HTTP error ${response.status}`, {
          source,
          status: response.status,
          attempt: attempt + 1,
          url: safeUrl,
        });
        if (!isRetryable || attempt === ctx.maxRetries) {
          return null;
        }
        await ctx.sleep(ctx.baseRetryDelayMs * Math.pow(2, attempt));
        continue;
      }

      return (await response.json()) as T;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      ctx.logger.warn(`Upstream ${source} request failed`, {
        source,
        attempt: attempt + 1,
        error: errorMessage,
        url: safeUrl,
      });
      if (attempt === ctx.maxRetries) {
        ctx.logger.error(`Upstream ${source} exhausted all retry attempts`, {
          source,
          attempts: attempt + 1,
          url: safeUrl,
        });
        return null;
      }
      await ctx.sleep(ctx.baseRetryDelayMs * Math.pow(2, attempt));
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  return null;
}
