/**
 * @module geminiStationBrief
 * Station-scoped Gemini health brief and conversational Q&A helpers for `/api/ai/advisory` and `/api/ai/chat`.
 */

import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  AirQualityStation,
  ChatTurn,
  HealthAdvisoryResult,
  SensitivityProfile,
} from '../../types/airQuality.ts';
import { validateGeminiOutputSafety } from './outputGuard.ts';
import { GeminiServiceError, isConfiguredApiKey, sanitizeUserInput } from './security.ts';

const DEFAULT_MODEL = 'gemini-4-hydrogen';

function getStationGeminiClient(): { ai: GoogleGenAI; model: string } {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!isConfiguredApiKey(apiKey)) {
    throw new GeminiServiceError(
      'GEMINI_API_KEY is not configured on the server. Add a valid key in Settings > Secrets to enable Gemini advisories.',
      503,
    );
  }
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'atmosense-ai/1.0' } },
  });
  return { ai, model: process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL };
}

function describeSensitivity(profile: SensitivityProfile): string {
  switch (profile) {
    case 'respiratory':
      return 'Person with asthma, COPD, or heightened respiratory sensitivity';
    case 'athlete':
      return 'High-ventilation outdoor runner or endurance cyclist';
    case 'vulnerable':
      return 'Children, older adults (65+), or pregnant individuals';
    default:
      return 'Healthy adult general public';
  }
}

function buildStationContext(station: AirQualityStation): string {
  return [
    `Station: ${station.city} — ${station.district} (${station.country})`,
    `Coordinates: ${station.latitude.toFixed(4)}, ${station.longitude.toFixed(4)}`,
    `US EPA AQI: ${station.aqi} (${station.category.label})`,
    `Dominant Pollutant: ${station.dominantPollutant}`,
    `PM2.5: ${station.metrics.pm25} µg/m³ (${station.whoPm25Ratio}x WHO 24h guideline of 15 µg/m³)`,
    `PM10: ${station.metrics.pm10} µg/m³ | NO2: ${station.metrics.no2} µg/m³ | O3: ${station.metrics.o3} µg/m³ | SO2: ${station.metrics.so2} µg/m³ | CO: ${station.metrics.co} µg/m³`,
    `Meteorology: ${station.temperatureC}°C, ${station.humidityPct}% humidity, ${station.windKph} km/h wind`,
    `Cleanest 3-hour window (UTC): ${station.bestOutdoorWindow}`,
  ].join('\n');
}

export async function generateHealthAdvisory(
  station: AirQualityStation,
  sensitivityProfile: SensitivityProfile,
  activityGoal?: string,
): Promise<HealthAdvisoryResult> {
  const { ai, model } = getStationGeminiClient();
  const safeGoal = activityGoal ? sanitizeUserInput(activityGoal, 240) : '';

  const prompt = [
    'Analyze the following urban air quality telemetry and return a concise, evidence-based respiratory health brief.',
    '',
    buildStationContext(station),
    `User Sensitivity Profile: ${describeSensitivity(sensitivityProfile)}`,
    safeGoal
      ? `Planned Activity: ${safeGoal}`
      : 'Planned Activity: General daily commute and outdoor errands',
  ].join('\n');

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      systemInstruction:
        'You are AtmoSense AI, an evidence-based urban air quality and environmental health advisor grounded in WHO 2021 and US EPA AQI standards. Keep language clinical, calm, practical, and concise. Never diagnose medical conditions or alter prescribed medications.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          outdoorVerdict: { type: Type.STRING, description: 'Short 4-10 word outdoor verdict.' },
          riskLevel: { type: Type.STRING, description: 'One of: low, moderate, elevated, high.' },
          summary: { type: Type.STRING, description: '2-3 crisp sentences on exposure risk.' },
          recommendedWindow: { type: Type.STRING, description: 'Recommended outdoor window.' },
          protectiveActions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '3 concise protective actions.',
          },
          pollutantNote: { type: Type.STRING, description: 'One sentence on dominant pollutant.' },
        },
        required: [
          'outdoorVerdict',
          'riskLevel',
          'summary',
          'recommendedWindow',
          'protectiveActions',
          'pollutantNote',
        ],
      },
    },
  });

  const rawText = (response.text ?? '').trim();
  if (!rawText) throw new Error('Gemini returned an empty response payload.');

  const safety = validateGeminiOutputSafety(rawText, { groundedAqi: station.aqi });
  if (!safety.safe) {
    throw new Error(safety.reason ?? 'Generated advisory failed safety validation.');
  }

  const parsed = JSON.parse(rawText) as Omit<HealthAdvisoryResult, 'model' | 'generatedAt'>;
  const normalizedRisk: HealthAdvisoryResult['riskLevel'] =
    parsed.riskLevel === 'low' ||
    parsed.riskLevel === 'moderate' ||
    parsed.riskLevel === 'elevated' ||
    parsed.riskLevel === 'high'
      ? parsed.riskLevel
      : station.aqi > 150
        ? 'high'
        : station.aqi > 100
          ? 'elevated'
          : station.aqi > 50
            ? 'moderate'
            : 'low';

  return {
    outdoorVerdict: String(parsed.outdoorVerdict ?? '').slice(0, 120),
    riskLevel: normalizedRisk,
    summary: String(parsed.summary ?? '').slice(0, 1400),
    recommendedWindow: String(parsed.recommendedWindow ?? station.bestOutdoorWindow).slice(0, 120),
    protectiveActions: Array.isArray(parsed.protectiveActions)
      ? parsed.protectiveActions.slice(0, 4).map((item) => String(item).slice(0, 180))
      : [],
    pollutantNote: String(parsed.pollutantNote ?? '').slice(0, 320),
    model,
    generatedAt: new Date().toISOString(),
  };
}

export async function generateAirQualityChatReply(
  station: AirQualityStation,
  sensitivityProfile: SensitivityProfile,
  history: readonly ChatTurn[],
  message: string,
): Promise<{ reply: string; model: string; generatedAt: string }> {
  const { ai, model } = getStationGeminiClient();
  const safeMessage = sanitizeUserInput(message, 800);

  const transcript = history
    .slice(-6)
    .map(
      (turn) =>
        `${turn.role === 'user' ? 'User' : 'AtmoSense AI'}: ${sanitizeUserInput(turn.content, 400)}`,
    )
    .join('\n');

  const prompt = [
    'Current Station Telemetry:',
    buildStationContext(station),
    `Sensitivity Profile: ${describeSensitivity(sensitivityProfile)}`,
    transcript ? `\nRecent Conversation:\n${transcript}` : '',
    `\nUser Question: ${safeMessage}`,
  ].join('\n');

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      systemInstruction:
        'You are AtmoSense AI, a precise urban air quality assistant. Ground every response in the live station metrics provided. Answer in 2-4 crisp paragraphs or short bullet points. Cite exact µg/m³ and AQI numbers from context. Do not invent sensor readings or prescribe medication dosage changes.',
    },
  });

  const reply = (response.text ?? '').trim();
  if (!reply) throw new Error('Gemini returned an empty reply.');

  const safety = validateGeminiOutputSafety(reply, { groundedAqi: station.aqi });
  if (!safety.safe) {
    throw new Error(safety.reason ?? 'Generated reply failed safety validation.');
  }

  return { reply, model, generatedAt: new Date().toISOString() };
}
