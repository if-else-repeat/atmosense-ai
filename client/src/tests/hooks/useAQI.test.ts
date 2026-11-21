import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { useAQI } from '../../hooks/useAQI';

const server = setupServer(
  http.get('/api/aqi/current', ({ request }) => {
    const url = new URL(request.url);
    const lat = Number(url.searchParams.get('lat') ?? 28.61);
    const aqi = lat > 40 ? 48 : 136;
    return HttpResponse.json({
      data: {
        aqi,
        pm25: lat > 40 ? 11.2 : 49.5,
        pm10: lat > 40 ? 22.0 : 98.4,
        no2: 28.0,
        co: 1.2,
        o3: 0.044,
        so2: 9.5,
        source: 'WAQI',
        timestamp: Date.now() - 60_000,
        location: { lat, lng: 77.2, name: lat > 40 ? 'London, UK' : 'New Delhi, India' },
        confidence: 0.94,
      },
    });
  }),
  http.get('/api/aqi/forecast', () => {
    const now = Date.now();
    return HttpResponse.json({
      forecast: Array.from({ length: 24 }, (_, idx) => ({
        timestamp: now + idx * 3_600_000,
        date: new Date(now + idx * 3_600_000).toISOString(),
        aqi: 110 + (idx % 5) * 6,
        pm25: 38,
        pm10: 82,
        no2: 24,
        co: 1.1,
        o3: 0.04,
      })),
    });
  }),
  http.get('/api/air-quality', () => HttpResponse.json({ stations: [] })),
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  window.localStorage.clear();
});
afterAll(() => server.close());

describe('useAQI Hook (MSW API Mocking)', () => {
  it('fetches live AQI telemetry and 24-hour forecast from /api/aqi/*', async () => {
    const { result } = renderHook(() =>
      useAQI({ lat: 28.6139, lng: 77.209, locationName: 'New Delhi, India' }),
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.aqi).toBe(136);
    expect(result.current.data?.source).toBe('WAQI');
    expect(result.current.data?.forecast).toHaveLength(24);
    expect(result.current.error).toBeNull();
  });

  it('re-fetches updated readings when coordinates change', async () => {
    const { result, rerender } = renderHook(({ lat, lng }) => useAQI({ lat, lng }), {
      initialProps: { lat: 28.6139, lng: 77.209 },
    });

    await waitFor(() => expect(result.current.data?.aqi).toBe(136));

    rerender({ lat: 51.5074, lng: -0.1278 });
    await waitFor(() => expect(result.current.data?.aqi).toBe(48));
  });

  it('supports manual refresh() and updates state cleanly', async () => {
    let callCount = 0;
    server.use(
      http.get('/api/aqi/current', () => {
        callCount += 1;
        return HttpResponse.json({
          data: {
            aqi: callCount === 1 ? 82 : 96,
            pm25: 27,
            pm10: 54,
            no2: 19,
            co: 0.9,
            o3: 0.036,
            so2: 6,
            source: 'OpenAQ',
            timestamp: Date.now(),
            location: { lat: 35.68, lng: 139.65, name: 'Tokyo' },
            confidence: 0.9,
          },
        });
      }),
    );

    const { result } = renderHook(() => useAQI({ lat: 35.68, lng: 139.65 }));
    await waitFor(() => expect(result.current.data?.aqi).toBe(82));

    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.data?.aqi).toBe(96);
  });

  it('surfaces error message cleanly when both primary and fallback APIs fail', async () => {
    server.use(
      http.get('/api/aqi/current', () =>
        HttpResponse.json({ error: 'Upstream failure' }, { status: 503 }),
      ),
      http.get('/api/air-quality', () =>
        HttpResponse.json({ error: 'Telemetry down' }, { status: 500 }),
      ),
    );

    const { result } = renderHook(() => useAQI({ lat: 19.07, lng: 72.87 }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toContain('500');
  });

  it('synthesizes 24-hour forecast points if /api/aqi/forecast returns an empty array', async () => {
    server.use(http.get('/api/aqi/forecast', () => HttpResponse.json({ forecast: [] })));

    const { result } = renderHook(() => useAQI({ lat: 28.6139, lng: 77.209 }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.forecast).toHaveLength(24);
  });
});
