import { describe, expect, it } from 'vitest';
import { createAiRouter } from '../src/routes/ai';
import { GeminiService } from '../src/services/geminiService';
import {
  SAMPLE_ZONE,
  VALID_TINY_PNG_BASE64,
  createCapturedLogger,
  createMockModel,
  startAiTestServer,
} from './helpers/geminiFixtures';

describe('GeminiRunner & Express /api/ai/* Routes — Rate Limits, Caching & Validation', () => {
  it('enforces 30 requests/minute per-user rate limit inside GeminiService', async () => {
    const { model } = createMockModel(() =>
      JSON.stringify({
        advisory:
          'Moderate air quality advisory for local urban commuters; shift exercise to 11:00-16:00 convective mixing.',
        citations: ['US EPA AQI Guidelines'],
      }),
    );

    const service = new GeminiService({
      model,
      now: () => 1_760_000_000_000,
      logger: createCapturedLogger(),
      rateLimitPerMinute: 30,
    });

    for (let i = 0; i < 30; i++) {
      await service.generateEmergencyAdvisory(SAMPLE_ZONE, 'moderate', 'en', 'user-rate-test');
    }

    await expect(
      service.generateEmergencyAdvisory(SAMPLE_ZONE, 'moderate', 'en', 'user-rate-test'),
    ).rejects.toMatchObject({ statusCode: 429 });

    const otherUserRes = await service.generateEmergencyAdvisory(
      SAMPLE_ZONE,
      'moderate',
      'en',
      'user-other',
    );
    expect(otherUserRes).toContain('Moderate air quality advisory');
  });

  it('handles all 5 POST endpoints + GET /status, validates bodies, enforces rate limits, and never leaks keys', async () => {
    const { model } = createMockModel((req) => {
      const promptText =
        typeof req.contents === 'string'
          ? req.contents
          : req.contents.parts.map((p) => ('text' in p ? p.text : '')).join(' ');

      if (promptText.includes('daily air-quality routine')) {
        return JSON.stringify({
          summary: 'Prefer 11:00-16:00 solar convection window and avoid morning/evening trapping.',
          safeOutdoorWindow: '11:00-16:00',
          avoidWindows: ['06:00-10:00', '17:00-20:00'],
          slots: [
            {
              window: '06:00-10:00',
              riskLevel: 'high',
              activity: 'Stay indoors.',
              precautions: ['Close windows'],
              scientificRationale: 'Morning inversion traps particulates.',
            },
            {
              window: '11:00-16:00',
              riskLevel: 'moderate',
              activity: 'Brief errands outdoors.',
              precautions: ['Wear N95 if sensitive'],
              scientificRationale: 'Solar convection improves vertical mixing.',
            },
          ],
          maskGuidance: 'N95/FFP2 outdoors.',
          indoorAirActions: ['Run HEPA purifier'],
          citations: ['WHO 2021 Guidelines'],
        });
      }
      if (promptText.includes('Untrusted User Question')) {
        return JSON.stringify({
          reply: 'Run indoors today; 11:00-16:00 is the safest brief outdoor window.',
          actionItems: ['Use HEPA purifier indoors'],
          citations: ['US EPA AQI Guidance'],
          riskLevel: 'high',
        });
      }
      if (promptText.includes('emergency air quality advisory')) {
        return JSON.stringify({
          advisory: 'SEVERE ALERT: Avoid outdoor exertion and seal indoor windows immediately.',
          citations: ['WHO 2021 Guidelines'],
        });
      }
      if (promptText.includes('Symptom Logs')) {
        return JSON.stringify({
          insights: [
            {
              title: 'PM2.5 Sensitivity Alert',
              finding: 'Symptoms spiked on elevated PM2.5 days.',
              correlationStrength: 'high',
              triggerPollutant: 'PM2.5',
              recommendedAction: 'Wear N95 mask when AQI > 100.',
              citations: ['WHO 2021 Guidelines'],
            },
          ],
        });
      }
      return JSON.stringify({
        summary: 'N95 mask sits securely across nose bridge and chin.',
        severity: 'low',
        confidence: 0.91,
        findings: ['Tight perimeter seal'],
        recommendations: ['Continue replacing filter after 8h heavy haze'],
        citations: ['NIOSH N95 Respirator Guidance'],
      });
    });

    const service = new GeminiService({ model, logger: createCapturedLogger() });
    const server = await startAiTestServer(
      createAiRouter(service, { maxRequests: 6, windowMs: 60_000 }),
    );

    try {
      const headers = { 'Content-Type': 'application/json', 'X-User-Id': 'route-test-user' };

      const r1 = await fetch(`${server.baseUrl}/api/ai/routine`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ persona: 'asthmatics', zone: SAMPLE_ZONE, language: 'en' }),
      });
      expect(r1.status).toBe(200);
      expect(
        ((await r1.json()) as { routine: { safeOutdoorWindow: string } }).routine.safeOutdoorWindow,
      ).toBe('11:00-16:00');

      const r2 = await fetch(`${server.baseUrl}/api/ai/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: 'Should I exercise outside?',
          context: { persona: 'general', zone: SAMPLE_ZONE },
          history: [],
        }),
      });
      expect(r2.status).toBe(200);

      const r3 = await fetch(`${server.baseUrl}/api/ai/emergency-advisory`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ zone: SAMPLE_ZONE, severity: 'severe', language: 'en' }),
      });
      expect(r3.status).toBe(200);

      const r4 = await fetch(`${server.baseUrl}/api/ai/analyze-image`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ imageBase64: VALID_TINY_PNG_BASE64, analysisType: 'mask-check' }),
      });
      expect(r4.status).toBe(200);

      const r5 = await fetch(`${server.baseUrl}/api/ai/health-insights`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          symptomLogs: [{ timestamp: 1_760_000_000_000, symptoms: ['cough'], severity: 3 }],
          aqiHistory: [{ timestamp: 1_760_000_000_000, aqi: 160 }],
        }),
      });
      expect(r5.status).toBe(200);

      const r6 = await fetch(`${server.baseUrl}/api/ai/status`, {
        headers: { 'X-User-Id': 'route-test-user' },
      });
      expect(r6.status).toBe(200);
      const statusText = await r6.text();
      expect(statusText).not.toContain('apiKey');
      expect(statusText).toContain('rateLimitPerMinute');

      const r7 = await fetch(`${server.baseUrl}/api/ai/status`, {
        headers: { 'X-User-Id': 'route-test-user' },
      });
      expect(r7.status).toBe(429);
      expect(r7.headers.get('retry-after')).toBeTruthy();

      const badReq = await fetch(`${server.baseUrl}/api/ai/routine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': 'another-user' },
        body: JSON.stringify({ persona: 'invalid-persona', zone: SAMPLE_ZONE }),
      });
      expect(badReq.status).toBe(400);
    } finally {
      await server.close();
    }
  });
});
