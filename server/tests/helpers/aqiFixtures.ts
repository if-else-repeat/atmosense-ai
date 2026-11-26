import express from 'express';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { AQILogger } from '../../src/services/aqiService';

export function createSilentLogger(): AQILogger & {
  infos: Array<{ message: string; meta?: Record<string, unknown> }>;
  warns: Array<{ message: string; meta?: Record<string, unknown> }>;
  errors: Array<{ message: string; meta?: Record<string, unknown> }>;
} {
  const infos: Array<{ message: string; meta?: Record<string, unknown> }> = [];
  const warns: Array<{ message: string; meta?: Record<string, unknown> }> = [];
  const errors: Array<{ message: string; meta?: Record<string, unknown> }> = [];
  return {
    infos,
    warns,
    errors,
    info: (message, meta) => infos.push({ message, meta }),
    warn: (message, meta) => warns.push({ message, meta }),
    error: (message, meta) => errors.push({ message, meta }),
  };
}

export function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export function makeWaqiPayload(overrides?: {
  aqi?: number | string;
  pm25?: number;
  pm10?: number;
  no2?: number;
  co?: number;
  o3?: number;
  so2?: number;
  name?: string;
  includeForecast?: boolean;
}) {
  return {
    status: 'ok',
    data: {
      aqi: overrides?.aqi ?? 88,
      city: { geo: [28.6139, 77.209], name: overrides?.name ?? 'New Delhi US Embassy' },
      time: { v: 1_760_000_000 },
      iaqi: {
        pm25: { v: overrides?.pm25 ?? 29.8 },
        pm10: { v: overrides?.pm10 ?? 74 },
        no2: { v: overrides?.no2 ?? 31 },
        co: { v: overrides?.co ?? 1.1 },
        o3: { v: overrides?.o3 ?? 0.042 },
        so2: { v: overrides?.so2 ?? 8.5 },
      },
      forecast:
        overrides?.includeForecast === false
          ? undefined
          : {
              daily: {
                pm25: [
                  { day: '2026-11-19', avg: 30, min: 20, max: 45 },
                  { day: '2026-11-20', avg: 48, min: 35, max: 62 },
                ],
                pm10: [
                  { day: '2026-11-19', avg: 68, min: 50, max: 85 },
                  { day: '2026-11-20', avg: 112, min: 90, max: 140 },
                ],
                o3: [
                  { day: '2026-11-19', avg: 38, min: 20, max: 55 },
                  { day: '2026-11-20', avg: 45, min: 25, max: 65 },
                ],
              },
            },
    },
  };
}

export function makeOpenAqPayload(overrides?: {
  pm25?: number;
  pm10?: number;
  no2?: number;
  co?: number;
  o3?: number;
  so2?: number;
  location?: string;
}) {
  return {
    results: [
      {
        location: overrides?.location ?? 'Connaught Place Monitor',
        city: 'New Delhi',
        coordinates: { latitude: 28.6304, longitude: 77.2177 },
        measurements: [
          {
            parameter: 'pm25',
            value: overrides?.pm25 ?? 30.2,
            unit: 'µg/m³',
            lastUpdated: '2026-11-19T08:00:00Z',
          },
          {
            parameter: 'pm10',
            value: overrides?.pm10 ?? 76,
            unit: 'µg/m³',
            lastUpdated: '2026-11-19T08:00:00Z',
          },
          {
            parameter: 'no2',
            value: overrides?.no2 ?? 32,
            unit: 'ppb',
            lastUpdated: '2026-11-19T08:00:00Z',
          },
          {
            parameter: 'co',
            value: overrides?.co ?? 1.0,
            unit: 'mg/m³',
            lastUpdated: '2026-11-19T08:00:00Z',
          },
          {
            parameter: 'o3',
            value: overrides?.o3 ?? 0.044,
            unit: 'ppm',
            lastUpdated: '2026-11-19T08:00:00Z',
          },
          {
            parameter: 'so2',
            value: overrides?.so2 ?? 9.0,
            unit: 'ppb',
            lastUpdated: '2026-11-19T08:00:00Z',
          },
        ],
      },
    ],
  };
}

export function makeOpenWeatherPayload(overrides?: {
  pm25?: number;
  pm10?: number;
  no2Ug?: number;
  coUg?: number;
  o3Ug?: number;
  so2Ug?: number;
  mainAqi?: number;
}) {
  return {
    coord: { lat: 28.6139, lon: 77.209 },
    list: [
      {
        dt: 1_760_000_200,
        main: { aqi: overrides?.mainAqi ?? 2 },
        components: {
          pm2_5: overrides?.pm25 ?? 29.0,
          pm10: overrides?.pm10 ?? 72.0,
          no2: overrides?.no2Ug ?? 56.4,
          co: overrides?.coUg ?? 1100,
          o3: overrides?.o3Ug ?? 82.32,
          so2: overrides?.so2Ug ?? 22.27,
        },
      },
    ],
  };
}

export async function startAqiTestServer(router: express.Router): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const app = express();
  app.use('/api/aqi', router);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
