import { cleanup, render } from '@testing-library/react';
import axe from 'axe-core';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { CommunityHub } from '../../components/Community/CommunityHub';
import { EnvironmentalJustice } from '../../components/Community/EnvironmentalJustice';
import { Leaderboard } from '../../components/Community/Leaderboard';
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
});
