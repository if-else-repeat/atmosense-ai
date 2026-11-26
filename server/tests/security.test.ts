// @vitest-environment node
import express, { type Express } from 'express';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import {
  buildAllowedOrigins,
  createApiKeyAuth,
  createCorsMiddleware,
  createRateLimiter,
  createRequestLogger,
  errorHandler,
  helmetMiddleware,
  inputValidator,
  sanitizeUrlForLog,
  timingSafeKeyEquals,
} from '../src/middleware/security';
import { communityReportSchema, sanitizeText, validateBody } from '../src/middleware/validate';

async function startServer(app: Express): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}

describe('Security Middleware Stack — Helmet, CORS, Rate Limiting, Validation, CWE-209, Auth', () => {
  it('sets strict Content-Security-Policy headers via helmetMiddleware', async () => {
    const app = express();
    app.use(helmetMiddleware);
    app.get('/api/ping', (_req, res) => res.json({ ok: true }));

    const server = await startServer(app);
    try {
      const res = await fetch(`${server.baseUrl}/api/ping`);
      expect(res.status).toBe(200);
      const csp = res.headers.get('content-security-policy') || '';
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self' 'unsafe-inline'");
      expect(csp).toContain("style-src 'self' 'unsafe-inline'");
      expect(csp).toContain("img-src 'self' data: blob: https:");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("frame-ancestors 'self' https:");
      expect(csp).toContain('https://api.waqi.info');
      expect(csp).toContain('https://api.openaq.org');
      expect(csp).toContain('https://api.openweathermap.org');
      expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
      expect(res.headers.get('permissions-policy')).toContain('camera=(self)');
      expect(res.headers.get('permissions-policy')).toContain('microphone=(self)');
      expect(res.headers.get('permissions-policy')).toContain('geolocation=(self)');
      expect(res.headers.get('permissions-policy')).toContain('payment=()');
      expect(res.headers.get('permissions-policy')).toContain('usb=()');
    } finally {
      await server.close();
    }
  });

  it('allows whitelisted CORS origins with credentials and blocks unauthorized origins (no wildcard)', async () => {
    const app = express();
    app.use(createCorsMiddleware(['https://atmosense.example.com']));
    app.get('/api/ping', (_req, res) => res.json({ ok: true }));

    const server = await startServer(app);
    try {
      const allowedRes = await fetch(`${server.baseUrl}/api/ping`, {
        headers: { Origin: 'https://atmosense.example.com' },
      });
      expect(allowedRes.headers.get('access-control-allow-origin')).toBe(
        'https://atmosense.example.com',
      );
      expect(allowedRes.headers.get('access-control-allow-credentials')).toBe('true');

      const cloudRunRes = await fetch(`${server.baseUrl}/api/ping`, {
        headers: { Origin: 'https://ais-dev-preview.asia-east1.run.app' },
      });
      expect(cloudRunRes.headers.get('access-control-allow-origin')).toBe(
        'https://ais-dev-preview.asia-east1.run.app',
      );

      const blockedRes = await fetch(`${server.baseUrl}/api/ping`, {
        headers: { Origin: 'https://evil-attacker.invalid' },
      });
      expect(blockedRes.headers.get('access-control-allow-origin')).toBeNull();
    } finally {
      await server.close();
    }
  });

  it('strips wildcard entries from dynamic CORS origin whitelist', () => {
    const origins = buildAllowedOrigins([
      '*',
      'http://localhost:3000',
      'https://prod.atmosense.app/path',
    ]);
    expect(origins.has('*')).toBe(false);
    expect(origins.has('http://localhost:3000')).toBe(true);
    expect(origins.has('https://prod.atmosense.app')).toBe(true);
  });

  it('enforces tiered rate limiting (AI tier vs Data tier) while skipping /api/health', async () => {
    const app = express();
    app.use(createRateLimiter({ aiMaxRequests: 2, dataMaxRequests: 4, windowMs: 60_000 }));
    app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
    app.get('/api/ai/test', (_req, res) => res.json({ tier: 'ai' }));
    app.get('/api/aqi/test', (_req, res) => res.json({ tier: 'data' }));

    const server = await startServer(app);
    try {
      // AI tier: 2 allowed, 3rd returns 429
      expect((await fetch(`${server.baseUrl}/api/ai/test`)).status).toBe(200);
      expect((await fetch(`${server.baseUrl}/api/ai/test`)).status).toBe(200);
      const aiBlocked = await fetch(`${server.baseUrl}/api/ai/test`);
      expect(aiBlocked.status).toBe(429);
      expect(aiBlocked.headers.get('x-ratelimit-limit')).toBe('2');

      // Data tier has independent higher limit (4 allowed, 5th returns 429)
      for (let i = 0; i < 4; i += 1) {
        expect((await fetch(`${server.baseUrl}/api/aqi/test`)).status).toBe(200);
      }
      expect((await fetch(`${server.baseUrl}/api/aqi/test`)).status).toBe(429);

      // /api/health is never rate-limited
      for (let i = 0; i < 6; i += 1) {
        expect((await fetch(`${server.baseUrl}/api/health`)).status).toBe(200);
      }
    } finally {
      await server.close();
    }
  });

  it('rejects unknown fields via strict Zod validateBody middleware', async () => {
    const app = express();
    app.use(express.json());
    app.post('/api/community/report', validateBody(communityReportSchema), (req, res) => {
      res.json({ received: req.body });
    });

    const server = await startServer(app);
    try {
      const badRes = await fetch(`${server.baseUrl}/api/community/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zoneName: 'Zone B',
          lat: 28.6,
          lng: 77.2,
          aqi: 150,
          smogLevel: 'smoggy',
          isAdminOverride: true, // Unknown shadow field
        }),
      });
      expect(badRes.status).toBe(400);
    } finally {
      await server.close();
    }
  });

  it('sanitizes HTML injection payloads and trims strings safely', async () => {
    expect(sanitizeText('  <script>alert("xss")</script>  ')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;',
    );

    const app = express();
    app.use(express.json());
    app.use(inputValidator);
    app.post('/api/echo', (req, res) => res.json(req.body));

    const server = await startServer(app);
    try {
      const res = await fetch(`${server.baseUrl}/api/echo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: '  <img src=x onerror=alert(1)>  ', aqi: 85 }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { note: string; aqi: number };
      expect(body.note).not.toContain('<img');
      expect(body.note).toContain('&lt;img');
      expect(body.aqi).toBe(85);
    } finally {
      await server.close();
    }
  });

  it('rejects out-of-range lat, lng, and aqi inputs via inputValidator', async () => {
    const app = express();
    app.use(express.json());
    app.use(inputValidator);
    app.get('/api/coords', (_req, res) => res.json({ ok: true }));
    app.post('/api/reading', (_req, res) => res.json({ ok: true }));

    const server = await startServer(app);
    try {
      expect((await fetch(`${server.baseUrl}/api/coords?lat=95&lng=10`)).status).toBe(400);
      expect((await fetch(`${server.baseUrl}/api/coords?lat=20&lng=-190`)).status).toBe(400);

      const badAqi = await fetch(`${server.baseUrl}/api/reading`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aqi: 650 }),
      });
      expect(badAqi.status).toBe(400);
    } finally {
      await server.close();
    }
  });

  it('prevents CWE-209 information exposure in errorHandler (never leaks stack traces)', async () => {
    const app = express();
    app.get('/api/boom', () => {
      throw new Error('SECRET_DB_PASSWORD=topsecret internal failure');
    });
    app.use(errorHandler);

    const server = await startServer(app);
    try {
      const res = await fetch(`${server.baseUrl}/api/boom`);
      expect(res.status).toBe(500);
      const text = await res.text();
      expect(JSON.parse(text)).toEqual({ error: 'Internal Server Error' });
      expect(text).not.toContain('SECRET_DB_PASSWORD');
      expect(text).not.toContain('Error:');
      expect(text).not.toContain('.ts:');
    } finally {
      await server.close();
    }
  });

  it('returns 400 on malformed JSON payloads without leaking parser internals', async () => {
    const app = express();
    app.use(express.json());
    app.post('/api/json', (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);

    const server = await startServer(app);
    try {
      const res = await fetch(`${server.baseUrl}/api/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"broken": ',
      });
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe('Malformed JSON request body.');
    } finally {
      await server.close();
    }
  });

  it('logs method, sanitized URL, status, and response time via Morgan without bodies, tokens, or PII', async () => {
    expect(sanitizeUrlForLog('/api/aqi?lat=28.6&token=abc123&email=user@test.com')).toBe(
      '/api/aqi?lat=28.6&token=%5BREDACTED%5D&email=%5BREDACTED%5D',
    );

    const logs: string[] = [];
    const app = express();
    app.use(express.json());
    app.use(createRequestLogger({ write: (msg) => logs.push(msg) }));
    app.post('/api/log-check', (_req, res) => res.status(201).json({ ok: true }));

    const server = await startServer(app);
    try {
      await fetch(`${server.baseUrl}/api/log-check?apiKey=secret999`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer secret-jwt' },
        body: JSON.stringify({ patientName: 'Private Patient Name' }),
      });

      expect(logs.length).toBe(1);
      const line = logs[0]!;
      expect(line).toContain('POST');
      expect(line).toContain('201');
      expect(line).toContain('ms');
      expect(line).not.toContain('secret999');
      expect(line).not.toContain('secret-jwt');
      expect(line).not.toContain('Private Patient Name');
    } finally {
      await server.close();
    }
  });

  it('validates X-API-Key using constant-time SHA-256 timingSafeEqual comparison', async () => {
    expect(timingSafeKeyEquals('atmo-prod-key-123', 'atmo-prod-key-123')).toBe(true);
    expect(timingSafeKeyEquals('atmo-prod-key-123', 'wrong-key')).toBe(false);

    const app = express();
    app.use(createApiKeyAuth({ validKeys: ['atmo-secret-key-99'], required: true }));
    app.get('/api/protected', (_req, res) =>
      res.json({ authenticated: res.locals.apiKeyAuthenticated }),
    );

    const server = await startServer(app);
    try {
      const missingRes = await fetch(`${server.baseUrl}/api/protected`);
      expect(missingRes.status).toBe(401);

      const wrongRes = await fetch(`${server.baseUrl}/api/protected`, {
        headers: { 'X-API-Key': 'invalid-key' },
      });
      expect(wrongRes.status).toBe(401);

      const validRes = await fetch(`${server.baseUrl}/api/protected`, {
        headers: { 'X-API-Key': 'atmo-secret-key-99' },
      });
      expect(validRes.status).toBe(200);
      expect(await validRes.json()).toEqual({ authenticated: true });
    } finally {
      await server.close();
    }
  });

  it('allows optional API key auth when no header is supplied but rejects invalid supplied headers', async () => {
    const app = express();
    app.use(createApiKeyAuth({ validKeys: ['valid-optional-key'], required: false }));
    app.get('/api/public-or-key', (_req, res) => res.json({ ok: true }));

    const server = await startServer(app);
    try {
      expect((await fetch(`${server.baseUrl}/api/public-or-key`)).status).toBe(200);
      expect(
        (
          await fetch(`${server.baseUrl}/api/public-or-key`, {
            headers: { 'X-API-Key': 'forged-key' },
          })
        ).status,
      ).toBe(401);
      expect(
        (
          await fetch(`${server.baseUrl}/api/public-or-key`, {
            headers: { 'X-API-Key': 'valid-optional-key' },
          })
        ).status,
      ).toBe(200);
    } finally {
      await server.close();
    }
  });
});
