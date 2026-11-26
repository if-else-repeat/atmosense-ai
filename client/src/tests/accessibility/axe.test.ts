import { cleanup, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WinterSmogActionHub } from '../../components/ActionHub/WinterSmogActionHub';
import { CommunityHub } from '../../components/Community/CommunityHub';
import { EnvironmentalJustice } from '../../components/Community/EnvironmentalJustice';
import { Leaderboard } from '../../components/Community/Leaderboard';
import { AQIDashboard } from '../../components/Dashboard/AQIDashboard';
import { ForecastChart } from '../../components/Dashboard/ForecastChart';
import { FamilyManager } from '../../components/Family/FamilyManager';
import { HealthAssistantPanel } from '../../components/HealthAssistantPanel';
import { RoutineOptimizer } from '../../components/Routine/RoutineOptimizer';
import { VoiceInterface } from '../../components/Voice/VoiceInterface';
import { WorkspaceProvider } from '../../context/AuthContext';
import { OFFLINE_FALLBACK_STATIONS } from '../../utils/airQuality';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

async function runAxeAudit(container: HTMLElement) {
  return axe.run(container, {
    rules: {
      'color-contrast': { enabled: false },
    },
  });
}

describe('Accessibility Compliance Suite (axe-core)', () => {
  it('AQIDashboard has zero axe-core accessibility violations', async () => {
    const now = Date.now();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes('/api/aqi/current')) {
          return new Response(
            JSON.stringify({
              data: {
                aqi: 132,
                pm25: 48,
                pm10: 92,
                no2: 34,
                co: 1.2,
                o3: 0.045,
                so2: 9,
                source: 'WAQI',
                timestamp: now - 60_000,
                location: { lat: 28.6139, lng: 77.209, name: 'New Delhi, India' },
                confidence: 0.92,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(JSON.stringify({ forecast: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );

    const { container } = render(
      createElement(AQIDashboard, { lat: 28.6139, lng: 77.209, locationName: 'New Delhi, India' }),
    );
    await screen.findByTestId('realtime-aqi-value');
    const results = await runAxeAudit(container);
    expect(results.violations).toEqual([]);
  });

  it('FamilyManager has zero axe-core accessibility violations', async () => {
    const { container } = render(
      createElement(FamilyManager, { currentAqi: 138, locationName: 'New Delhi, India' }),
    );
    const results = await runAxeAudit(container);
    expect(results.violations).toEqual([]);
  });

  it('CommunityHub has zero axe-core accessibility violations', async () => {
    const { container } = render(
      createElement(CommunityHub, { currentAqi: 112, locationName: 'New Delhi, India' }),
    );
    const results = await runAxeAudit(container);
    expect(results.violations).toEqual([]);
  });

  it('EnvironmentalJustice heatmap has zero axe-core accessibility violations', async () => {
    const { container } = render(createElement(EnvironmentalJustice));
    const results = await runAxeAudit(container);
    expect(results.violations).toEqual([]);
  });

  it('Leaderboard semantic HTML table has zero axe-core accessibility violations', async () => {
    const { container } = render(
      createElement(Leaderboard, {
        optedIn: true,
        onToggleOptIn: () => {},
        userPoints: 640,
        userStreakDays: 7,
        userCo2Kg: 40,
      }),
    );
    const results = await runAxeAudit(container);
    expect(results.violations).toEqual([]);
  });

  it('RoutineOptimizer and VoiceInterface have zero axe-core accessibility violations', async () => {
    const { container } = render(
      createElement(
        'div',
        null,
        createElement(RoutineOptimizer, { zoneName: 'London, UK', aqi: 64, pm25: 18.2 }),
        createElement(VoiceInterface, { aqi: 64, locationName: 'London, UK' }),
      ),
    );
    const results = await runAxeAudit(container);
    expect(results.violations).toEqual([]);
  });

  it('WinterSmogActionHub has zero axe-core accessibility violations', async () => {
    const { container } = render(
      createElement(WinterSmogActionHub, {
        locationName: 'New Delhi, India',
        aqi: 185,
        pm25: 115,
        persona: 'asthmatics',
      }),
    );
    const results = await runAxeAudit(container);
    expect(results.violations).toEqual([]);
  });

  it('HealthAssistantPanel has zero axe-core accessibility violations', async () => {
    const { container } = render(
      createElement(
        WorkspaceProvider,
        null,
        createElement(HealthAssistantPanel, {
          station: OFFLINE_FALLBACK_STATIONS[0]!,
          sensitivityProfile: 'respiratory',
          onChangeSensitivity: () => {},
        }),
      ),
    );
    const results = await runAxeAudit(container);
    expect(results.violations).toEqual([]);
  });

  it('ForecastChart interactive SVG region has zero axe-core accessibility violations', async () => {
    const { container } = render(
      createElement(ForecastChart, {
        locationName: 'New Delhi, India',
        forecast: [
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
          {
            hourLabel: '18:00',
            isoTime: '2026-01-10T18:00:00Z',
            aqi: 162,
            pm25: 76,
            pm10: 120,
            no2: 46,
            o3: 0.035,
            co: 1.2,
          },
        ],
      }),
    );
    const results = await runAxeAudit(container);
    expect(results.violations).toEqual([]);
  });
});
