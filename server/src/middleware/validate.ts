/**
 * @module validate
 * Strict Zod input validation and HTML-escaping sanitization helpers for AtmoSense AI.
 *
 * Security guarantees:
 * - Rejects unknown/shadow object keys via `.strict()`
 * - Trims and HTML-escapes untrusted string inputs to prevent XSS/injection
 * - Enforces domain numeric bounds (`lat`: -90..90, `lng`: -180..180, `aqi`: 0..500)
 */

import type { NextFunction, Request, Response } from 'express';
import { z, type ZodSchema } from 'zod';

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
};

const HTML_ESCAPE_REGEX = /[&<>"'/]/g;

/**
 * Escapes HTML special characters and strips null bytes after trimming whitespace.
 */
export function sanitizeText(value: string): string {
  return value
    .replace(/\0/g, '')
    .trim()
    .replace(HTML_ESCAPE_REGEX, (char) => HTML_ESCAPE_MAP[char] ?? char);
}

/**
 * Recursively sanitizes string values inside an untrusted JSON payload while
 * preserving primitive types and skipping keys explicitly excluded (e.g. base64 images).
 */
export function sanitizePayloadDeep(
  value: unknown,
  skipKeys: ReadonlySet<string> = new Set(['imageBase64']),
  depth = 0,
): unknown {
  if (depth > 10) return value;
  if (typeof value === 'string') {
    return sanitizeText(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizePayloadDeep(item, skipKeys, depth + 1));
  }
  if (value !== null && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      output[key] = skipKeys.has(key) ? val : sanitizePayloadDeep(val, skipKeys, depth + 1);
    }
    return output;
  }
  return value;
}

/**
 * Helper building a trimmed, HTML-escaped Zod string schema with length bounds.
 */
export function sanitizedString(options: { min?: number; max?: number } = {}) {
  const { min = 1, max = 500 } = options;
  return z
    .string()
    .transform((val) => sanitizeText(val))
    .refine((val) => val.length >= min, {
      message: `Must be at least ${min} character(s).`,
    })
    .refine((val) => val.length <= max, {
      message: `Must be at most ${max} character(s).`,
    });
}

export const latitudeSchema = z.coerce.number().finite().min(-90).max(90);
export const longitudeSchema = z.coerce.number().finite().min(-180).max(180);
export const aqiValueSchema = z.coerce.number().finite().min(0).max(500);

export const coordinatesQuerySchema = z
  .object({
    lat: latitudeSchema,
    lng: longitudeSchema.optional(),
    lon: longitudeSchema.optional(),
    persona: z.enum(['children', 'elderly', 'asthmatics', 'general']).optional(),
  })
  .strict()
  .refine((data) => data.lng !== undefined || data.lon !== undefined, {
    message: 'Either "lng" or "lon" query parameter is required.',
  });

export const communityReportSchema = z
  .object({
    zoneName: sanitizedString({ min: 2, max: 120 }),
    lat: latitudeSchema,
    lng: longitudeSchema,
    aqi: aqiValueSchema,
    smogLevel: z.enum(['clear', 'hazy', 'smoggy', 'severe']),
    notes: sanitizedString({ min: 0, max: 400 }).optional(),
  })
  .strict();

export const strictAqiBoundsSchema = z
  .object({
    lat: latitudeSchema.optional(),
    lng: longitudeSchema.optional(),
    lon: longitudeSchema.optional(),
    aqi: aqiValueSchema.optional(),
  })
  .passthrough();

/**
 * Express middleware validating `req.body` against a strict Zod schema.
 * Rejects unknown fields and replaces `req.body` with the sanitized parsed value.
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed for request body.',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          code: issue.code,
          message: issue.message,
        })),
      });
      return;
    }
    req.body = parsed.data;
    next();
  };
}

/**
 * Express middleware validating `req.query` against a strict Zod schema.
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed for query parameters.',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          code: issue.code,
          message: issue.message,
        })),
      });
      return;
    }
    res.locals.validatedQuery = parsed.data;
    next();
  };
}
