import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { ForecastChart } from '../../components/Dashboard/ForecastChart';
import { TrendChartSvg } from '../../components/TrendChartSvg';
import { OFFLINE_FALLBACK_STATIONS } from '../../utils/airQuality';

function linearizeChannel(channel255: number): number {
  const srgb = channel255 / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return 0.2126 * linearizeChannel(r) + 0.7152 * linearizeChannel(g) + 0.0722 * linearizeChannel(b);
}

function contrastRatio(fgHex: string, bgHex: string): number {
  const l1 = relativeLuminance(fgHex);
  const l2 = relativeLuminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('WCAG 2.1 AA Structure, Contrast Ratios & Keyboard Navigation', () => {
  it('verifies >= 4.5:1 WCAG AA text contrast across light and dark AQI status badge palettes', () => {
    const lightPairs: ReadonlyArray<[string, string, string]> = [
      ['Good', '#065F46', '#ECFDF5'],
      ['Moderate', '#78350F', '#FFFBEB'],
      ['Sensitive', '#7C2D12', '#FFF7ED'],
      ['Unhealthy', '#991B1B', '#FEF2F2'],
      ['Very Unhealthy', '#581C87', '#FAF5FF'],
      ['Hazardous', '#881337', '#FFF1F2'],
      ['Primary CTA', '#FFFFFF', '#0E7490'],
    ];

    const darkPairs: ReadonlyArray<[string, string, string]> = [
      ['Good Dark', '#A7F3D0', '#022C22'],
      ['Moderate Dark', '#FDE68A', '#451A03'],
      ['Sensitive Dark', '#FED7AA', '#431407'],
      ['Unhealthy Dark', '#FECACA', '#450A0A'],
      ['Very Unhealthy Dark', '#E9D5FF', '#3B0764'],
      ['Hazardous Dark', '#FECDD3', '#4C0519'],
      ['Dark Primary Text', '#F1F5F9', '#020617'],
    ];

    for (const [label, fg, bg] of [...lightPairs, ...darkPairs]) {
      expect(contrastRatio(fg, bg), `${label} contrast must be >= 4.5:1`).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });

  it('renders skip-to-main-content link and all 4 semantic landmarks (banner, navigation, main, contentinfo)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ stations: OFFLINE_FALLBACK_STATIONS }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    render(<App />);

    const skipLink = screen.getByRole('link', { name: /Skip to main content/i });
    expect(skipLink).toHaveAttribute('href', '#main-content');
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /Primary navigation/i })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('provides accessible SVG titles/descriptions and keyboard interaction on charts', () => {
    const station = OFFLINE_FALLBACK_STATIONS[0]!;
    const { container: trendContainer } = render(
      <TrendChartSvg hourly={station.hourly} city={station.city} />,
    );
    expect(trendContainer.querySelector('svg[role="img"] title')?.textContent).toContain(
      station.city,
    );
    expect(trendContainer.querySelector('svg[role="img"] desc')?.textContent).toBeTruthy();

    const { container: forecastContainer } = render(
      <ForecastChart
        locationName="New Delhi, India"
        forecast={[
          {
            hourLabel: '08:00',
            isoTime: '2026-01-10T08:00:00Z',
            aqi: 175,
            pm25: 102,
            pm10: 148,
            no2: 52,
            o3: 0.032,
            co: 1.4,
          },
          {
            hourLabel: '12:00',
            isoTime: '2026-01-10T12:00:00Z',
            aqi: 118,
            pm25: 42,
            pm10: 76,
            no2: 28,
            o3: 0.048,
            co: 0.8,
          },
        ]}
      />,
    );
    expect(forecastContainer.querySelector('svg[role="img"] title')?.textContent).toContain(
      'New Delhi, India',
    );
    expect(forecastContainer.querySelector('svg[role="img"] desc')?.textContent).toBeTruthy();

    const region = forecastContainer.querySelector('[tabindex="0"]');
    expect(region).not.toBeNull();
    if (region) {
      fireEvent.keyDown(region, { key: 'ArrowRight' });
      expect(forecastContainer.textContent).toContain('12:00');
    }
  });
});
