import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assessInversionRisk,
  buildForecastSrDescription,
  buildPollutantMetricCards,
  computeTrendDelta,
  formatUpdatedAgo,
  getAQIStatusPresentation,
  getPersonaHealthGuidance,
} from './dashboardAqi';

test('getAQIStatusPresentation maps all 6 EPA tiers with color, text, and icon keys', () => {
  assert.equal(getAQIStatusPresentation(32).category, 'Good');
  assert.equal(getAQIStatusPresentation(78).category, 'Moderate');
  assert.equal(getAQIStatusPresentation(125).category, 'Unhealthy for Sensitive Groups');
  assert.equal(getAQIStatusPresentation(180).category, 'Unhealthy');
  assert.equal(getAQIStatusPresentation(240).category, 'Very Unhealthy');
  assert.equal(getAQIStatusPresentation(360).category, 'Hazardous');
});

test('formatUpdatedAgo produces human-readable elapsed strings', () => {
  const now = 1_760_000_000_000;
  assert.equal(formatUpdatedAgo(now - 10_000, now), 'just now');
  assert.equal(formatUpdatedAgo(now - 120_000, now), '2 min ago');
  assert.equal(formatUpdatedAgo(now - 7_200_000, now), '2 hr ago');
});

test('assessInversionRisk flags high risk during calm morning inversion and low risk during windy midday convection', () => {
  const highRisk = assessInversionRisk({
    localHour: 7,
    windKph: 4,
    humidityPct: 82,
    temperatureC: 11,
    pm25: 92,
  });
  assert.equal(highRisk.level, 'high');
  assert.equal(highRisk.currentPeriod, 'morning-inversion');
  assert.equal(highRisk.dispersionWindow, '11:00–16:00');

  const lowRisk = assessInversionRisk({
    localHour: 14,
    windKph: 18,
    humidityPct: 42,
    temperatureC: 26,
    pm25: 12,
  });
  assert.equal(lowRisk.level, 'low');
  assert.equal(lowRisk.currentPeriod, 'convective-mixing');
});

test('buildPollutantMetricCards builds all 5 pollutants with trend calculations', () => {
  const cards = buildPollutantMetricCards({ pm25: 42, pm10: 84, no2: 36, co: 1.2, o3: 0.048 }, [
    { hourLabel: '08:00', isoTime: '', aqi: 100, pm25: 35, pm10: 70, no2: 30, o3: 0.04, co: 1.1 },
    { hourLabel: '09:00', isoTime: '', aqi: 120, pm25: 45, pm10: 90, no2: 40, o3: 0.05, co: 1.2 },
  ]);
  assert.equal(cards.length, 5);
  assert.deepEqual(
    cards.map((c) => c.id),
    ['pm25', 'pm10', 'no2', 'co', 'o3'],
  );
  assert.equal(computeTrendDelta([35, 45]).trend, 'rising');
  assert.equal(computeTrendDelta([45, 35]).trend, 'falling');
  assert.equal(computeTrendDelta([40, 40]).trend, 'steady');
});

test('getPersonaHealthGuidance differentiates advice by persona and buildForecastSrDescription summarizes min/max', () => {
  const general = getPersonaHealthGuidance(145, 'general');
  const asthmatics = getPersonaHealthGuidance(145, 'asthmatics');
  assert.notEqual(general.recommendation, asthmatics.recommendation);
  assert.match(asthmatics.recommendation, /asthma/i);

  const sr = buildForecastSrDescription(
    [
      { hourLabel: '08:00', isoTime: '', aqi: 135, pm25: 48, pm10: 90, no2: 35, o3: 0.04, co: 1.1 },
      { hourLabel: '13:00', isoTime: '', aqi: 82, pm25: 27, pm10: 60, no2: 20, o3: 0.05, co: 0.9 },
    ],
    'New Delhi',
  );
  assert.match(sr, /Cleanest reading is AQI 82 at 13:00/);
  assert.match(sr, /highest predicted pollution peak is AQI 135 at 08:00/);
});
