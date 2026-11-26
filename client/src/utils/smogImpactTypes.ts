/**
 * @module smogImpactTypes
 * Domain types, default household lifestyle profile, and Corsi-Rosenthal MERV-13 CADR physics.
 */

export type CommuteMode =
  'solo_car' | 'motorbike' | 'public_transit' | 'carpool' | 'bike_walk' | 'remote';

export type HeatingCookingFuel =
  'wood_biomass' | 'gas_lpg' | 'diesel_backup' | 'electric_induction' | 'heat_pump';

export type HousingType = 'apartment_highrise' | 'suburban_home' | 'older_drafty' | 'shared_flat';

export interface LifestyleProfile {
  commuteMode: CommuteMode;
  heatingCookingFuel: HeatingCookingFuel;
  housingType: HousingType;
  householdSize: number;
}

export interface CorsiRosenthalMetrics {
  roomVolumeM3: number;
  estimatedCadrM3h: number;
  airChangesPerHour: number;
  minutesToClear80Pct: number;
  recommendedHepaCadrM3h: number;
  indoorPm25ReductionPct: number;
}

export interface IndoorAirHack {
  id: string;
  title: string;
  category: 'filtration' | 'ventilation' | 'source_control' | 'sealing';
  priority: 'essential' | 'high' | 'recommended';
  pm25ReductionPct: number;
  estimatedCostLabel: string;
  actionSteps: string[];
  directImpactExplanation: string;
  winterSmogNote: string;
}

export interface SustainableAlternative {
  id: string;
  title: string;
  replaces: string;
  category: 'commute' | 'heating_cooking' | 'routine_timing' | 'community';
  co2KgPerMonth: number;
  pm25GramsPerMonth: number;
  noxGramsPerMonth: number;
  personalExposureReductionPct: number;
  directImpactExplanation: string;
  winterSmogMechanism: string;
  recommendedForUser: boolean;
}

export interface DirectImpactSummary {
  selectedCount: number;
  personalExposureReductionPct: number;
  householdCo2KgPerMonth: number;
  householdPm25GramsPerMonth: number;
  householdNoxGramsPerMonth: number;
  communityScaleFamilies: number;
  communityCo2TonnesPerMonth: number;
  communityPm25KgPerMonth: number;
  plainLanguageSummary: string;
}

export const DEFAULT_LIFESTYLE_PROFILE: LifestyleProfile = {
  commuteMode: 'solo_car',
  heatingCookingFuel: 'gas_lpg',
  housingType: 'older_drafty',
  householdSize: 3,
};

/** Computes DIY Corsi-Rosenthal box-fan filter (4x MERV-13) CADR/ACH metrics. */
export function computeCorsiRosenthalMetrics(
  roomAreaSqm: number,
  ceilingHeightM = 2.7,
): CorsiRosenthalMetrics {
  const clampedArea = Math.min(120, Math.max(8, Math.round(roomAreaSqm)));
  const roomVolumeM3 = Number((clampedArea * ceilingHeightM).toFixed(1));
  const estimatedCadrM3h = 540;
  const airChangesPerHour = Number((estimatedCadrM3h / roomVolumeM3).toFixed(1));
  const minutesToClear80Pct = Math.max(6, Math.round((Math.log(5) / airChangesPerHour) * 60));
  const recommendedHepaCadrM3h = Math.round(roomVolumeM3 * 4.8);
  const indoorPm25ReductionPct = Math.min(
    84,
    Math.max(52, Math.round(50 + Math.min(airChangesPerHour, 8) * 4.2)),
  );

  return {
    roomVolumeM3,
    estimatedCadrM3h,
    airChangesPerHour,
    minutesToClear80Pct,
    recommendedHepaCadrM3h,
    indoorPm25ReductionPct,
  };
}
