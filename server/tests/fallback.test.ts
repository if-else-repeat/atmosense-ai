import { describe, expect, it } from 'vitest';
import {
  buildFallbackChat,
  buildFallbackEmergencyAdvisory,
  buildFallbackHealthInsights,
  buildFallbackImageAnalysis,
  buildFallbackRoutine,
  type ZoneData,
} from '../src/services/heuristicFallback';

const CLEAN_ZONE: ZoneData = {
  name: 'Embarcadero, San Francisco',
  aqi: 34,
  pm25: 7.2,
  pm10: 18,
  no2: 12,
  o3: 0.028,
  dominantPollutant: 'pm25',
};

const SMOG_ZONE: ZoneData = {
  name: 'Anand Vihar, New Delhi',
  aqi: 318,
  pm25: 242,
  pm10: 360,
  no2: 72,
  o3: 0.052,
  dominantPollutant: 'pm25',
};

describe('heuristicFallback — Deterministic Offline Advisory Suite', () => {
  it('builds persona-tailored daily routines across low and hazardous AQI bands', () => {
    const cleanPlan = buildFallbackRoutine('general', CLEAN_ZONE, 'en');
    expect(cleanPlan.generatedBy).toBe('heuristic-fallback');
    expect(cleanPlan.safeOutdoorWindow).toBe('11:00-16:00');
    expect(cleanPlan.slots.length).toBeGreaterThanOrEqual(3);
    expect(cleanPlan.citations.length).toBeGreaterThanOrEqual(1);

    const severePlan = buildFallbackRoutine('asthmatics', SMOG_ZONE, 'en', 'offline');
    expect(severePlan.fallbackReason).toBe('offline');
    expect(severePlan.maskGuidance).toMatch(/N95|FFP2/i);
    expect(severePlan.indoorAirActions.some((a) => /HEPA/i.test(a))).toBe(true);
  });

  it('answers chat queries deterministically with diurnal boundary-layer context', () => {
    const reply = buildFallbackChat('Should my child play outside this morning?', {
      persona: 'children',
      zone: SMOG_ZONE,
      language: 'en',
    });
    expect(reply.generatedBy).toBe('heuristic-fallback');
    expect(reply.riskLevel).toBe('critical');
    expect(reply.reply).toContain('06:00-10:00');
    expect(reply.reply).toContain('11:00-16:00');
    expect(reply.actionItems.length).toBeGreaterThanOrEqual(2);
  });

  it('produces structured emergency bulletins for moderate, severe, and critical alerts', () => {
    const mod = buildFallbackEmergencyAdvisory(CLEAN_ZONE, 'moderate', 'en');
    const sev = buildFallbackEmergencyAdvisory(SMOG_ZONE, 'severe', 'en');
    const crit = buildFallbackEmergencyAdvisory(SMOG_ZONE, 'critical', 'en');

    expect(mod).toContain('MODERATE');
    expect(sev).toContain('SEVERE');
    expect(crit).toContain('CRITICAL');
    expect(crit).toContain('WHO');
  });

  it('covers all 3 multimodal image fallback modes', () => {
    const smog = buildFallbackImageAnalysis('smog-severity', 'quota');
    const monitor = buildFallbackImageAnalysis('aqi-display', 'quota');
    const mask = buildFallbackImageAnalysis('mask-check', 'quota');

    expect(smog.analysisType).toBe('smog-severity');
    expect(monitor.analysisType).toBe('aqi-display');
    expect(mask.analysisType).toBe('mask-check');
    expect(mask.recommendations.some((r) => /seal|nose/i.test(r))).toBe(true);
  });

  it('handles empty symptom logs and elevated AQI symptom correlations safely', () => {
    const empty = buildFallbackHealthInsights([], []);
    expect(empty.length).toBeGreaterThanOrEqual(1);
    expect(empty[0]?.generatedBy).toBe('heuristic-fallback');

    const correlated = buildFallbackHealthInsights(
      [
        { timestamp: 1_760_000_000_000, symptoms: ['coughing', 'wheezing'], severity: 4 },
        { timestamp: 1_760_086_400_000, symptoms: ['wheezing'], severity: 5 },
      ],
      [
        { timestamp: 1_760_000_000_000, aqi: 210, pm25: 140 },
        { timestamp: 1_760_086_400_000, aqi: 240, pm25: 165 },
      ],
    );
    expect(correlated[0]?.correlationStrength).toBe('high');
    expect(correlated[0]?.finding).toContain('wheezing');
  });
});
