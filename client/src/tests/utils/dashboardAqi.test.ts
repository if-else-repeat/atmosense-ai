import { describe, expect, it } from 'vitest';
import {
  assessInversionRisk,
  buildForecastSrDescription,
  buildPollutantMetricCards,
  computeTrendDelta,
  formatUpdatedAgo,
  getAQIStatusPresentation,
  getPersonaHealthGuidance,
} from '../../utils/dashboardAqi';

describe('Client dashboardAqi utilities', () => {
  it('maps all 6 EPA tiers with color, text, and icon keys', () => {
    expect(getAQIStatusPresentation(32).category).toBe('Good');
    expect(getAQIStatusPresentation(78).category).toBe('Moderate');
    expect(getAQIStatusPresentation(125).category).toBe('Unhealthy for Sensitive Groups');
    expect(getAQIStatusPresentation(180).category).toBe('Unhealthy');
    expect(getAQIStatusPresentation(240).category).toBe('Very Unhealthy');
    expect(getAQIStatusPresentation(360).category).toBe('Hazardous');
  });

  it('produces human-readable elapsed timestamp strings', () => {
    const now = 1_760_000_000_000;
    expect(formatUpdatedAgo(now - 10_000, now)).toBe('just now');
    expect(formatUpdatedAgo(now - 120_000, now)).toBe('2 min ago');
    expect(formatUpdatedAgo(now - 7_200_000, now)).toBe('2 hr ago');
  });

  it('flags high inversion risk during calm morning inversion and low risk during windy midday convection', () => {
    const highRisk = assessInversionRisk({
      localHour: 7,
      windKph: 4,
      humidityPct: 82,
      temperatureC: 11,
      pm25: 92,
    });
    expect(highRisk.level).toBe('high');
    expect(highRisk.currentPeriod).toBe('morning-inversion');
    expect(highRisk.dispersionWindow).toBe('11:00–16:00');

    const lowRisk = assessInversionRisk({
      localHour: 14,
      windKph: 18,
      humidityPct: 42,
      temperatureC: 26,
      pm25: 12,
    });
    expect(lowRisk.level).toBe('low');
    expect(lowRisk.currentPeriod).toBe('convective-mixing');
  });

  it('builds all 5 pollutant cards with trend calculations', () => {
    const cards = buildPollutantMetricCards({ pm25: 42, pm10: 84, no2: 36, co: 1.2, o3: 0.048 }, [
      { hourLabel: '08:00', isoTime: '', aqi: 100, pm25: 35, pm10: 70, no2: 30, o3: 0.04, co: 1.1 },
      { hourLabel: '09:00', isoTime: '', aqi: 120, pm25: 45, pm10: 90, no2: 40, o3: 0.05, co: 1.2 },
    ]);
    expect(cards).toHaveLength(5);
    expect(cards.map((c) => c.id)).toEqual(['pm25', 'pm10', 'no2', 'co', 'o3']);
    expect(computeTrendDelta([35, 45]).trend).toBe('rising');
    expect(computeTrendDelta([45, 35]).trend).toBe('falling');
    expect(computeTrendDelta([40, 40]).trend).toBe('steady');
  });

  it('differentiates guidance by persona and summarizes min/max in forecast description', () => {
    const general = getPersonaHealthGuidance(145, 'general');
    const asthmatics = getPersonaHealthGuidance(145, 'asthmatics');
    expect(general.recommendation).not.toBe(asthmatics.recommendation);
    expect(asthmatics.recommendation).toMatch(/asthma/i);

    const sr = buildForecastSrDescription(
      [
        {
          hourLabel: '08:00',
          isoTime: '',
          aqi: 135,
          pm25: 48,
          pm10: 90,
          no2: 35,
          o3: 0.04,
          co: 1.1,
        },
        {
          hourLabel: '13:00',
          isoTime: '',
          aqi: 82,
          pm25: 27,
          pm10: 60,
          no2: 20,
          o3: 0.05,
          co: 0.9,
        },
      ],
      'New Delhi',
    );
    expect(sr).toMatch(/Cleanest reading is AQI 82 at 13:00/);
    expect(sr).toMatch(/highest predicted pollution peak is AQI 135 at 08:00/);
  });
});
