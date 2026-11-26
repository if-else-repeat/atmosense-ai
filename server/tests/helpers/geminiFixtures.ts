import express from 'express';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { vi } from 'vitest';
import type {
  GeminiLogger,
  GenerativeModel,
  ModelGenerationRequest,
  ZoneData,
} from '../../src/services/geminiService';

export const SAMPLE_ZONE: ZoneData = {
  name: 'Connaught Place, New Delhi',
  aqi: 168,
  pm25: 88.4,
  pm10: 146,
  no2: 44,
  o3: 0.048,
  dominantPollutant: 'pm25',
};

export const VALID_TINY_PNG_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export function createCapturedLogger(): GeminiLogger & {
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

export function createMockModel(
  responder: (req: ModelGenerationRequest) => Promise<string> | string,
): {
  model: GenerativeModel;
  calls: ModelGenerationRequest[];
} {
  const calls: ModelGenerationRequest[] = [];
  const model: GenerativeModel = {
    modelName: 'gemini-4-hydrogen',
    generateContent: vi.fn(async (req: ModelGenerationRequest) => {
      calls.push(req);
      const text = await responder(req);
      return { text };
    }),
  };
  return { model, calls };
}

export async function startAiTestServer(router: express.Router): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const app = express();
  app.use(express.json({ limit: '6mb' }));
  app.use('/api/ai', router);
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
