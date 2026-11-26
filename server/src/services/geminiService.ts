import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  AirQualityStation,
  ChatTurn,
  HealthAdvisoryResult,
  SensitivityProfile,
} from '../types/airQuality.ts';

export * from './geminiEngineService.ts';

const DEFAULT_MODEL = 'gemini-4-hydrogen';

function getGeminiClient(): { ai: GoogleGenAI; model: string } {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === 'YOUR_SERVER_SIDE_GEMINI_API_KEY') {
    const err = new Error(
      'GEMINI_API_KEY is not configured on the server. Add a valid key in Settings > Secrets to enable Gemini advisories.',
    );
    (err as Error & { statusCode?: number }).statusCode = 503;
    throw err;
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'atmosense-ai/1.0',
      },
    },
  });

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  return { ai, model };
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
  const { ai, model } = getGeminiClient();

  const prompt = [
    'Analyze the following urban air quality telemetry and return a concise, evidence-based respiratory health brief.',
    '',
    buildStationContext(station),
    `User Sensitivity Profile: ${describeSensitivity(sensitivityProfile)}`,
    activityGoal
      ? `Planned Activity: ${activityGoal}`
      : 'Planned Activity: General daily commute and outdoor errands',
  ].join('\n');

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      systemInstruction:
        'You are AtmoSense AI, an evidence-based urban air quality and environmental health advisor grounded in WHO 2021 and US EPA AQI standards. Keep language clinical, calm, practical, and concise. Never diagnose medical conditions.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          outdoorVerdict: {
            type: Type.STRING,
            description: 'Short 4-10 word outdoor activity verdict.',
          },
          riskLevel: {
            type: Type.STRING,
            description: 'One of: low, moderate, elevated, high.',
          },
          summary: {
            type: Type.STRING,
            description:
              '2-3 crisp sentences explaining current exposure risk and practical guidance.',
          },
          recommendedWindow: {
            type: Type.STRING,
            description: 'Recommended outdoor timing window or indoor mitigation timing.',
          },
          protectiveActions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '3 concise, concrete protective actions tailored to the profile.',
          },
          pollutantNote: {
            type: Type.STRING,
            description:
              'One sentence explaining the dominant pollutant and its local dispersion context.',
          },
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
  if (!rawText) {
    throw new Error('Gemini returned an empty response payload.');
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
  const { ai, model } = getGeminiClient();

  const transcript = history
    .slice(-6)
    .map((turn) => `${turn.role === 'user' ? 'User' : 'AtmoSense AI'}: ${turn.content}`)
    .join('\n');

  const prompt = [
    'Current Station Telemetry:',
    buildStationContext(station),
    `Sensitivity Profile: ${describeSensitivity(sensitivityProfile)}`,
    transcript ? `\nRecent Conversation:\n${transcript}` : '',
    `\nUser Question: ${message}`,
  ].join('\n');

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      systemInstruction:
        'You are AtmoSense AI, a precise urban air quality assistant. Ground every response in the live station metrics provided. Answer in 2-4 crisp paragraphs or short bullet points. Cite exact µg/m³ and AQI numbers from context. Do not invent sensor readings.',
    },
  });

  const reply = (response.text ?? '').trim();
  if (!reply) {
    throw new Error('Gemini returned an empty reply.');
  }

  return {
    reply,
    model,
    generatedAt: new Date().toISOString(),
  };
}
