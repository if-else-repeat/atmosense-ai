import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LIFESTYLE_PROFILE,
  calculateDirectImpactSummary,
  computeCorsiRosenthalMetrics,
  generateIaqHacks,
  generateSustainableAlternatives,
  type LifestyleProfile,
} from '../../utils/smogImpactEngine';

describe('smogImpactEngine — Challenge 6 IAQ Hacks & Direct Impact Math', () => {
  it('computes Corsi-Rosenthal CADR, ACH, clear time, and HEPA sizing accurately', () => {
    const smallRoom = computeCorsiRosenthalMetrics(20);
    const largeRoom = computeCorsiRosenthalMetrics(60);

    expect(smallRoom.roomVolumeM3).toBe(54);
    expect(smallRoom.airChangesPerHour).toBe(10);
    expect(smallRoom.minutesToClear80Pct).toBeLessThan(largeRoom.minutesToClear80Pct);
    expect(smallRoom.indoorPm25ReductionPct).toBeGreaterThanOrEqual(75);
    expect(largeRoom.recommendedHepaCadrM3h).toBeGreaterThan(smallRoom.recommendedHepaCadrM3h);
  });

  it('clamps extreme room area inputs safely within physical bounds', () => {
    const tiny = computeCorsiRosenthalMetrics(1);
    const huge = computeCorsiRosenthalMetrics(500);
    expect(tiny.roomVolumeM3).toBeGreaterThan(0);
    expect(huge.roomVolumeM3).toBeCloseTo(120 * 2.7, 1);
  });

  it('tailors IAQ hacks to combustion fuels and drafty housing during severe winter smog', () => {
    const draftyWoodHome: LifestyleProfile = {
      commuteMode: 'solo_car',
      heatingCookingFuel: 'wood_biomass',
      housingType: 'older_drafty',
      householdSize: 4,
    };

    const hacks = generateIaqHacks(210, 140, draftyWoodHome, 30);
    expect(hacks.length).toBe(5);

    const kitchenHack = hacks.find((h) => h.id === 'clean-kitchen-combustion');
    const sealHack = hacks.find((h) => h.id === 'micro-sealing-draft-barriers');

    expect(kitchenHack?.priority).toBe('essential');
    expect(kitchenHack?.pm25ReductionPct).toBe(55);
    expect(sealHack?.priority).toBe('essential');
    expect(sealHack?.pm25ReductionPct).toBe(34);
  });

  it('adapts IAQ hack priorities for modern electric apartments', () => {
    const electricApt: LifestyleProfile = {
      commuteMode: 'public_transit',
      heatingCookingFuel: 'heat_pump',
      housingType: 'apartment_highrise',
      householdSize: 2,
    };

    const hacks = generateIaqHacks(65, 19, electricApt, 25);
    const kitchenHack = hacks.find((h) => h.id === 'clean-kitchen-combustion');
    expect(kitchenHack?.priority).toBe('recommended');
    expect(kitchenHack?.pm25ReductionPct).toBe(28);
  });

  it('tailors sustainable alternatives to solo car and biomass heating profiles', () => {
    const profile: LifestyleProfile = {
      commuteMode: 'solo_car',
      heatingCookingFuel: 'wood_biomass',
      housingType: 'older_drafty',
      householdSize: 5,
    };

    const alts = generateSustainableAlternatives(185, 110, profile, 'New Delhi, India');
    expect(alts.length).toBe(5);

    const commuteAlt = alts.find((a) => a.id === 'transit-carpool-commute');
    const heatAlt = alts.find((a) => a.id === 'clean-heating-cooking');
    expect(commuteAlt?.recommendedForUser).toBe(true);
    expect(commuteAlt?.co2KgPerMonth).toBe(78);
    expect(heatAlt?.pm25GramsPerMonth).toBe(185);
    expect(heatAlt?.directImpactExplanation).toContain('New Delhi');
    expect(heatAlt?.directImpactExplanation).toContain('5 family members');
  });

  it('aggregates direct personal exposure drop and 500-family community scaling transparently', () => {
    const alts = generateSustainableAlternatives(
      170,
      95,
      DEFAULT_LIFESTYLE_PROFILE,
      'Lahore, Pakistan',
    );
    const selectedIds = ['transit-carpool-commute', 'clean-heating-cooking'];
    const summary = calculateDirectImpactSummary(selectedIds, alts, 3, 500);

    expect(summary.selectedCount).toBe(2);
    expect(summary.householdCo2KgPerMonth).toBe(78 + 48);
    expect(summary.householdPm25GramsPerMonth).toBe(26 + 28);
    expect(summary.personalExposureReductionPct).toBeGreaterThan(25);
    expect(summary.personalExposureReductionPct).toBeLessThanOrEqual(75);
    expect(summary.communityCo2TonnesPerMonth).toBeCloseTo((126 * 500) / 1000, 1);
    expect(summary.communityPm25KgPerMonth).toBeCloseTo((54 * 500) / 1000, 1);
    expect(summary.plainLanguageSummary).toContain('500 neighborhood families');
  });

  it('returns clear zero-state guidance when no alternatives are selected', () => {
    const alts = generateSustainableAlternatives(120, 42, DEFAULT_LIFESTYLE_PROFILE, 'London, UK');
    const summary = calculateDirectImpactSummary([], alts, 2, 500);
    expect(summary.selectedCount).toBe(0);
    expect(summary.personalExposureReductionPct).toBe(0);
    expect(summary.plainLanguageSummary).toMatch(/Select one or more sustainable alternatives/i);
  });
});
