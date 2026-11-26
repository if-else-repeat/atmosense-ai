/**
 * @module geminiResponseSchemas
 * Structured JSON output schemas for `@google/genai` model invocations.
 */

import { Type, type Schema } from '@google/genai';

export const ROUTINE_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    safeOutdoorWindow: { type: Type.STRING },
    avoidWindows: { type: Type.ARRAY, items: { type: Type.STRING } },
    slots: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          window: { type: Type.STRING },
          riskLevel: { type: Type.STRING },
          activity: { type: Type.STRING },
          precautions: { type: Type.ARRAY, items: { type: Type.STRING } },
          scientificRationale: { type: Type.STRING },
        },
        required: ['window', 'riskLevel', 'activity', 'precautions', 'scientificRationale'],
      },
    },
    maskGuidance: { type: Type.STRING },
    indoorAirActions: { type: Type.ARRAY, items: { type: Type.STRING } },
    citations: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: [
    'summary',
    'safeOutdoorWindow',
    'avoidWindows',
    'slots',
    'maskGuidance',
    'indoorAirActions',
    'citations',
  ],
};

export const CHAT_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    reply: { type: Type.STRING },
    actionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
    citations: { type: Type.ARRAY, items: { type: Type.STRING } },
    riskLevel: { type: Type.STRING },
  },
  required: ['reply', 'actionItems', 'citations', 'riskLevel'],
};

export const EMERGENCY_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    advisory: { type: Type.STRING },
    citations: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['advisory', 'citations'],
};

export const IMAGE_ANALYSIS_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    severity: { type: Type.STRING },
    confidence: { type: Type.NUMBER },
    findings: { type: Type.ARRAY, items: { type: Type.STRING } },
    recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
    estimatedAqiRange: {
      type: Type.OBJECT,
      properties: {
        min: { type: Type.NUMBER },
        max: { type: Type.NUMBER },
      },
      required: ['min', 'max'],
    },
    citations: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['summary', 'severity', 'confidence', 'findings', 'recommendations', 'citations'],
};

export const HEALTH_INSIGHTS_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    insights: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          finding: { type: Type.STRING },
          correlationStrength: { type: Type.STRING },
          triggerPollutant: { type: Type.STRING },
          recommendedAction: { type: Type.STRING },
          citations: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          'title',
          'finding',
          'correlationStrength',
          'triggerPollutant',
          'recommendedAction',
          'citations',
        ],
      },
    },
  },
  required: ['insights'],
};
