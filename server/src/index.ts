import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import {
  apiKeyAuth,
  corsMiddleware,
  errorHandler,
  helmetMiddleware,
  inputValidator,
  rateLimiter,
  requestLogger,
} from '../middleware/security.ts';
import { aiRouter } from './routes/ai.ts';
import { airQualityRouter } from './routes/airQuality.ts';
import { aqiRouter } from './routes/aqi.ts';
import { logger } from './utils/logger.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const DIST_DIR = path.resolve(ROOT_DIR, 'dist');

export function createApp(): express.Express {
  const app = express();
  app.set('trust proxy', 1);

  // Layered security stack
  app.use(helmetMiddleware);
  app.use(corsMiddleware);

  const standardJsonParser = express.json({ limit: '256kb' });
  const imageJsonParser = express.json({ limit: '6mb' });
  app.use((req, res, next) => {
    if (req.path === '/api/ai/analyze-image') {
      imageJsonParser(req, res, next);
      return;
    }
    standardJsonParser(req, res, next);
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'atmosense-ai-server',
      aiConfigured: Boolean(
        process.env.GEMINI_API_KEY &&
        process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' &&
        process.env.GEMINI_API_KEY !== 'YOUR_SERVER_SIDE_GEMINI_API_KEY',
      ),
      model: process.env.GEMINI_MODEL || 'gemini-4-hydrogen',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api', requestLogger, rateLimiter, apiKeyAuth, inputValidator);
  app.use('/api/air-quality', airQualityRouter);
  app.use('/api/aqi', aqiRouter);
  app.use('/api/ai', aiRouter);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API route not found.' });
  });

  app.use(errorHandler);

  return app;
}

export async function startServer(): Promise<void> {
  const app = createApp();
  const isProd = process.env.NODE_ENV === 'production';
  const port = Number(process.env.PORT) || 3000;

  if (!isProd) {
    const vite = await createViteServer({
      configFile: path.resolve(ROOT_DIR, 'vite.config.ts'),
      server: { middlewareMode: true, allowedHosts: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(DIST_DIR, { maxAge: '1d' }));
    app.use((_req, res) => {
      const indexFile = path.join(DIST_DIR, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(500).send('Client build missing. Run npm run build first.');
      }
    });
  }

  app.use(errorHandler);

  app.listen(port, '0.0.0.0', () => {
    logger.info(`AtmoSense AI server running on http://0.0.0.0:${port}`);
  });
}
