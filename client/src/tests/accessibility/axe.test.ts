import { cleanup, render } from '@testing-library/react';
import axe from 'axe-core';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { WinterSmogActionHub } from '../../components/ActionHub/WinterSmogActionHub';
import { CommunityHub } from '../../components/Community/CommunityHub';
import { EnvironmentalJustice } from '../../components/Community/EnvironmentalJustice';
import { Leaderboard } from '../../components/Community/Leaderboard';
import { ForecastChart } from '../../components/Dashboard/ForecastChart';
import { FamilyManager } from '../../components/Family/FamilyManager';
import { RoutineOptimizer } from '../../components/Routine/RoutineOptimizer';
import { VoiceInterface } from '../../components/Voice/VoiceInterface';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

async function runAxeAudit(container: HTMLElement) {
  // Disable color-contrast rule in jsdom (no computed canvas/layout engine); keep all semantic/ARIA/form/table checks active
  return axe.run(container, {
    rules: {
      'color-contrast': { enabled: false },
    },
  });
}

describe('Accessibility Compliance Suite (axe-core)', () => {
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
        createElement(RoutineOptimizer, {
          zoneName: 'London, UK',
          aqi: 64,
          pm25: 18.2,
        }),
        createElement(VoiceInterface, {
          aqi: 64,
          locationName: 'London, UK',
        }),
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
