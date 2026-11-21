import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AQIDashboard } from './AQIDashboard';

function mockMultiSourceResponses(overrides?: {
  aqi?: number;
  source?: string;
  minutesAgo?: number;
}) {
  const now = Date.now();
  const minutesAgo = overrides?.minutesAgo ?? 2;
  const timestamp = now - minutesAgo * 60 * 1000;
  const aqi = overrides?.aqi ?? 142;
  const source = overrides?.source ?? 'WAQI';

  const forecast = Array.from({ length: 24 }, (_, idx) => ({
    timestamp: now + idx * 3600 * 1000,
    date: new Date(now + idx * 3600 * 1000).toISOString(),
    aqi: Math.max(35, aqi + ((idx % 6) - 2) * 8),
    pm25: 52 + (idx % 5) * 3,
    pm10: 96 + (idx % 4) * 5,
    no2: 38 + (idx % 3) * 4,
    co: 1.25,
    o3: 0.044,
  }));

  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('/api/aqi/current')) {
      return new Response(
        JSON.stringify({
          data: {
            aqi,
            pm25: 52.4,
            pm10: 98.2,
            no2: 39.5,
            co: 1.24,
            o3: 0.046,
            so2: 9.1,
            source,
            timestamp,
            location: { lat: 28.6139, lng: 77.209, name: 'New Delhi, India' },
            confidence: 0.95,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (url.includes('/api/aqi/forecast')) {
      return new Response(JSON.stringify({ forecast }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('AQIDashboard', () => {
  it('renders loading skeleton initially, then displays live AQI, 5 pollutant cards, lazy SVG forecast chart, inversion indicator, and persona guidance', async () => {
    const fetchMock = mockMultiSourceResponses({ aqi: 142, source: 'WAQI', minutesAgo: 2 });
    vi.stubGlobal('fetch', fetchMock);

    render(<AQIDashboard lat={28.6139} lng={77.209} locationName="New Delhi, India" />);

    // Loading skeleton shown during fetch
    expect(screen.getByTestId('aqi-dashboard-skeleton')).toBeInTheDocument();

    // Real-time AQI value with aria-live="polite"
    const aqiLiveRegion = await screen.findByTestId('realtime-aqi-value');
    expect(aqiLiveRegion).toHaveAttribute('aria-live', 'polite');
    expect(aqiLiveRegion).toHaveTextContent('142');

    // Data source attribution format
    expect(screen.getByTestId('aqi-source-attribution')).toHaveTextContent(
      'Source: WAQI, updated 2 min ago',
    );

    // All 5 pollutant cards (PM2.5, PM10, NO2, CO, O3)
    expect(screen.getByRole('button', { name: /PM2\.5/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /PM10/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /NO₂/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^CO Carbon Monoxide/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /O₃/i })).toBeInTheDocument();

    // Lazy-loaded native SVG 24-hour forecast chart + .sr-only description
    expect(await screen.findByText('24-Hour Air Quality Forecast')).toBeInTheDocument();
    expect(
      screen.getByText(/24-hour AQI forecast chart for New Delhi, India/i),
    ).toBeInTheDocument();

    // Inversion risk indicator with plain-language explanation
    expect(screen.getByText('Thermal Inversion Risk')).toBeInTheDocument();

    // Switch persona to Asthmatics and confirm guidance updates
    fireEvent.click(screen.getByRole('button', { name: 'Asthmatics' }));
    expect(screen.getByText(/asthma action plan/i)).toBeInTheDocument();

    // Switch persona to Children
    fireEvent.click(screen.getByRole('button', { name: 'Children' }));
    expect(screen.getByText(/outdoor sports practices/i)).toBeInTheDocument();
  });

  it('displays error state with working Retry button that recovers when API comes back', async () => {
    let shouldFail = true;
    const successMock = mockMultiSourceResponses({ aqi: 68, source: 'OpenAQ', minutesAgo: 1 });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        if (shouldFail) {
          return new Response(JSON.stringify({ error: 'Upstream unavailable' }), { status: 503 });
        }
        return successMock(input);
      }),
    );

    render(<AQIDashboard lat={51.5074} lng={-0.1278} locationName="London, UK" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Unable to load live air quality data/i,
    );

    shouldFail = false;
    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));

    await waitFor(() => {
      expect(screen.getByTestId('realtime-aqi-value')).toHaveTextContent('68');
    });
    expect(screen.getByTestId('aqi-source-attribution')).toHaveTextContent('Source: OpenAQ');
  });

  it('shows offline indicator when browser goes offline and supports pull-to-refresh gesture', async () => {
    const fetchMock = mockMultiSourceResponses({ aqi: 84, source: 'WAQI', minutesAgo: 2 });
    vi.stubGlobal('fetch', fetchMock);

    render(<AQIDashboard lat={35.6762} lng={139.6503} locationName="Tokyo, Japan" />);
    await screen.findByTestId('realtime-aqi-value');

    const initialCalls = fetchMock.mock.calls.length;

    // Simulate mobile pull-to-refresh gesture
    const container = screen.getByTestId('aqi-dashboard');
    fireEvent.touchStart(container, { touches: [{ clientY: 10 }] });
    fireEvent.touchMove(container, { touches: [{ clientY: 180 }] });
    expect(screen.getByText(/Release to refresh air quality data/i)).toBeInTheDocument();
    fireEvent.touchEnd(container);

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(initialCalls);
    });

    // Trigger browser offline event
    fireEvent(window, new Event('offline'));
    expect(await screen.findByText(/Offline mode/i)).toBeInTheDocument();
  });
});
