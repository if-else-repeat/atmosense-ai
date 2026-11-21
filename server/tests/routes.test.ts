// @vitest-environment node
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/index';

describe('Express API Routes Integration — /api/*', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createApp();
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });

  it('GET /api/health returns service status and security headers', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
    const json = (await res.json()) as { status: string; service: string; timestamp: string };
    expect(json.status).toBe('ok');
    expect(json.service).toBe('atmosense-ai-server');
    expect(typeof json.timestamp).toBe('string');
  });

  it('GET /api/aqi/sources reports configured providers and cache metrics', async () => {
    const res = await fetch(`${baseUrl}/api/aqi/sources`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { sources: Array<{ name: string }>; cache: unknown };
    expect(json.sources.map((s) => s.name)).toEqual(['WAQI', 'OpenAQ', 'OpenWeather']);
    expect(json.cache).toBeTruthy();
  });

  it('GET /api/aqi/current rejects missing coordinates with HTTP 400', async () => {
    const res = await fetch(`${baseUrl}/api/aqi/current`);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain('lat');
  });

  it('GET /api/aqi/current rejects out-of-range latitude with HTTP 400', async () => {
    const res = await fetch(`${baseUrl}/api/aqi/current?lat=125&lng=77.2`);
    expect(res.status).toBe(400);
  });

  it('GET /api/aqi/forecast rejects out-of-range longitude with HTTP 400', async () => {
    const res = await fetch(`${baseUrl}/api/aqi/forecast?lat=28.6&lng=210`);
    expect(res.status).toBe(400);
  });

  it('GET /api/ai/status returns sanitized status without leaking API keys', async () => {
    const res = await fetch(`${baseUrl}/api/ai/status`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('atmosense-gemini-ai');
    expect(text).not.toContain('GEMINI_API_KEY');
  });

  it('POST /api/ai/routine generates a structured daily routine plan (with fallback support)', async () => {
    const res = await fetch(`${baseUrl}/api/ai/routine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        persona: 'asthmatics',
        zone: { name: 'Central Delhi', aqi: 145, pm25: 53.2 },
        language: 'en',
      }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { routine: Record<string, unknown>; generatedAt: string };
    expect(json.routine).toBeTruthy();
    expect(typeof json.generatedAt).toBe('string');
  });

  it('POST /api/ai/routine returns 400 for invalid persona values', async () => {
    const res = await fetch(`${baseUrl}/api/ai/routine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        persona: 'astronaut',
        zone: { name: 'Central Delhi', aqi: 100, pm25: 35 },
      }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/ai/emergency-advisory returns a bulletin for severe air quality', async () => {
    const res = await fetch(`${baseUrl}/api/ai/emergency-advisory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        zone: { name: 'East Industrial Belt', aqi: 245, pm25: 195 },
        severity: 'severe',
        language: 'en',
      }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { advisory: string; severity: string };
    expect(typeof json.advisory).toBe('string');
    expect(json.advisory.length).toBeGreaterThan(20);
    expect(json.severity).toBe('severe');
  });

  it('POST /api/ai/health-insights returns correlated insights for symptom & AQI history', async () => {
    const now = Date.now();
    const res = await fetch(`${baseUrl}/api/ai/health-insights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symptomLogs: [
          { timestamp: now - 3_600_000, symptoms: ['Coughing'], severity: 3 },
          { timestamp: now - 86_400_000, symptoms: ['Wheezing'], severity: 4 },
        ],
        aqiHistory: [
          { timestamp: now - 3_600_000, aqi: 142, pm25: 52 },
          { timestamp: now - 86_400_000, aqi: 168, pm25: 88 },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { count: number; insights: unknown[] };
    expect(json.count).toBeGreaterThan(0);
    expect(Array.isArray(json.insights)).toBe(true);
  });

  it('GET /api/air-quality/by-coords returns live station telemetry for valid coordinates', async () => {
    const res = await fetch(`${baseUrl}/api/air-quality/by-coords?lat=12.9716&lng=77.5946`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      method: string;
      station: {
        id: string;
        aqi: number;
        latitude: number;
        longitude: number;
        city: string;
        hourly: unknown[];
      };
    };
    expect(json.method).toBe('coords');
    expect(json.station.id).toBe('current-location');
    expect(Number.isFinite(json.station.aqi)).toBe(true);
    expect(json.station.latitude).toBeCloseTo(12.9716, 2);
    expect(json.station.longitude).toBeCloseTo(77.5946, 2);
    expect(json.station.city.length).toBeGreaterThan(0);
    expect(Array.isArray(json.station.hourly)).toBe(true);
    expect(json.station.hourly.length).toBeGreaterThanOrEqual(12);
  });

  it('GET /api/air-quality/by-coords rejects out-of-range coordinates with HTTP 400', async () => {
    const res = await fetch(`${baseUrl}/api/air-quality/by-coords?lat=999&lng=10`);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain('lat');
  });

  it('GET /api/air-quality/detect-location returns structured detection payload', async () => {
    const res = await fetch(`${baseUrl}/api/air-quality/detect-location`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { detected: boolean; station: unknown };
    expect(typeof json.detected).toBe('boolean');
    if (json.detected) {
      expect(json.station).toBeTruthy();
    }
  });

  it('returns 404 JSON for unknown /api/* endpoints', async () => {
    const res = await fetch(`${baseUrl}/api/does-not-exist`);
    expect(res.status).toBe(404);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain('not found');
  });
});
