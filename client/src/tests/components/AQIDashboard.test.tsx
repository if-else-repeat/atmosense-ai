import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AQIDashboard } from '../../components/Dashboard/AQIDashboard';
import { ErrorBoundary } from '../../components/ErrorBoundary';

function makeCurrentPayload(aqi = 128, source = 'WAQI') {
  return {
    data: {
      aqi,
      pm25: 46.5,
      pm10: 94.0,
      no2: 32.1,
      co: 1.4,
      o3: 0.048,
      so2: 11.2,
      source,
      timestamp: Date.now() - 120_000,
      location: { lat: 28.6139, lng: 77.209, name: 'New Delhi, India' },
      confidence: 0.92,
    },
  };
}

function makeHourlyForecastPayload() {
  const now = Date.now();
  return {
    forecast: Array.from({ length: 24 }, (_, idx) => ({
      timestamp: now + idx * 3_600_000,
      date: new Date(now + idx * 3_600_000).toISOString(),
      aqi: 95 + (idx % 6) * 8,
      pm25: 34 + (idx % 6) * 4,
      pm10: 78 + (idx % 6) * 5,
      no2: 24 + (idx % 4) * 3,
      co: 1.1,
      o3: 0.042,
    })),
  };
}

const server = setupServer(
  http.get('/api/aqi/current', () => HttpResponse.json(makeCurrentPayload())),
  http.get('/api/aqi/forecast', () => HttpResponse.json(makeHourlyForecastPayload())),
  http.get('/api/air-quality', () => HttpResponse.json({ stations: [] })),
);

beforeAll(() => server.listen());
afterEach(() => {
  cleanup();
  server.resetHandlers();
  window.localStorage.clear();
});
afterAll(() => server.close());

describe('AQIDashboard Component', () => {
  it('displays loading skeleton while telemetry is in flight', async () => {
    server.use(
      http.get('/api/aqi/current', async () => {
        await new Promise((r) => setTimeout(r, 80));
        return HttpResponse.json(makeCurrentPayload());
      }),
    );

    render(<AQIDashboard lat={28.6139} lng={77.209} locationName="New Delhi, India" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('128')).toBeInTheDocument());
  });

  it('renders live AQI inside aria-live="polite" region with category label', async () => {
    render(<AQIDashboard lat={28.6139} lng={77.209} locationName="New Delhi, India" />);
    const aqiNumber = await screen.findByText('128');
    expect(aqiNumber.closest('[aria-live="polite"]')).not.toBeNull();
    expect(screen.getAllByText(/Unhealthy for Sensitive Groups/i).length).toBeGreaterThan(0);
  });

  it('renders all 5 pollutant cards (PM2.5, PM10, NO2, CO, O3)', async () => {
    render(<AQIDashboard lat={28.6139} lng={77.209} locationName="New Delhi, India" />);
    await screen.findByText('128');
    expect(screen.getByText('PM2.5')).toBeInTheDocument();
    expect(screen.getByText('PM10')).toBeInTheDocument();
    expect(screen.getByText('NO₂')).toBeInTheDocument();
    expect(screen.getByText('CO')).toBeInTheDocument();
    expect(screen.getByText('O₃')).toBeInTheDocument();
  });

  it('shows data source attribution with relative timestamp', async () => {
    render(<AQIDashboard lat={28.6139} lng={77.209} locationName="New Delhi, India" />);
    await screen.findByText('128');
    expect(screen.getByText(/Source:\s*WAQI/i)).toBeInTheDocument();
  });

  it('renders error state with retry button when both endpoints fail and recovers on retry', async () => {
    let attempts = 0;
    server.use(
      http.get('/api/aqi/current', () => {
        attempts += 1;
        if (attempts === 1) {
          return HttpResponse.json({ error: 'Upstream unavailable' }, { status: 503 });
        }
        return HttpResponse.json(makeCurrentPayload(72, 'OpenAQ'));
      }),
      http.get('/api/air-quality', () => HttpResponse.json({ error: 'Down' }, { status: 503 })),
    );

    render(<AQIDashboard lat={28.6139} lng={77.209} locationName="New Delhi, India" />);
    const retryBtn = await screen.findByRole('button', { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();

    fireEvent.click(retryBtn);
    await waitFor(() => expect(screen.getByText('72')).toBeInTheDocument());
  });

  it('updates health recommendation when user switches persona profile', async () => {
    const onChangePersona = vi.fn();
    render(
      <AQIDashboard
        lat={28.6139}
        lng={77.209}
        locationName="New Delhi, India"
        initialPersona="general"
        onChangePersona={onChangePersona}
      />,
    );
    await screen.findByText('128');

    const asthmaButton = screen.getByRole('button', { name: /asthma/i });
    fireEvent.click(asthmaButton);
    expect(onChangePersona).toHaveBeenCalledWith('asthmatics');
  });

  it('gracefully synthesizes forecast when upstream forecast endpoint returns empty array', async () => {
    server.use(http.get('/api/aqi/forecast', () => HttpResponse.json({ forecast: [] })));

    render(<AQIDashboard lat={28.6139} lng={77.209} locationName="New Delhi, India" />);
    await screen.findByText('128');
    expect(screen.getByText(/24-Hour Air Quality Forecast/i)).toBeInTheDocument();
  });

  it('renders accessible inversion risk indicator with plain-language explanation', async () => {
    render(<AQIDashboard lat={28.6139} lng={77.209} locationName="New Delhi, India" />);
    await screen.findByText('128');
    expect(screen.getAllByText(/Inversion Risk/i).length).toBeGreaterThan(0);
  });

  it('catches runtime render exceptions safely inside ErrorBoundary', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function BrokenChild(): never {
      throw new Error('Simulated dashboard crash');
    }

    render(
      <ErrorBoundary>
        <BrokenChild />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reload/i })).toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});
