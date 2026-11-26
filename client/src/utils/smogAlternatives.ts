/**
 * @module smogAlternatives
 * Location- and lifestyle-tailored sustainable alternatives and direct impact aggregator.
 */

import type {
  DirectImpactSummary,
  LifestyleProfile,
  SustainableAlternative,
} from './smogImpactTypes';

/** Generates location- and lifestyle-tailored Sustainable Alternatives with impact explanations. */
export function generateSustainableAlternatives(
  aqi: number,
  pm25: number,
  lifestyle: LifestyleProfile,
  locationName: string,
): SustainableAlternative[] {
  const safeAqi = Math.max(0, Math.round(aqi));
  const cityLabel = locationName.split(',')[0]?.trim() || 'your city';
  const sizeFactor = Math.max(1, Math.min(8, Math.round(lifestyle.householdSize)));

  const items: SustainableAlternative[] = [
    {
      id: 'transit-carpool-commute',
      title:
        lifestyle.commuteMode === 'solo_car'
          ? 'Switch 3 Workdays/Week from Solo Car to Metro, Bus, or 3-Person Carpool'
          : 'Consolidate Motorized Trips into Shared Transit or Micro-Mobility',
      replaces:
        lifestyle.commuteMode === 'solo_car'
          ? 'Solo petrol/diesel car commute during peak rush hour'
          : 'Single-occupancy motorized errands',
      category: 'commute',
      co2KgPerMonth: lifestyle.commuteMode === 'solo_car' ? 78 : 36,
      pm25GramsPerMonth: lifestyle.commuteMode === 'solo_car' ? 26 : 14,
      noxGramsPerMonth: lifestyle.commuteMode === 'solo_car' ? 210 : 95,
      personalExposureReductionPct: 18,
      directImpactExplanation: `Avoids ${lifestyle.commuteMode === 'solo_car' ? 78 : 36} kg CO₂ and ${lifestyle.commuteMode === 'solo_car' ? 210 : 95} g NOx every month while cutting in-cabin tailpipe PM2.5 exposure (stop-and-go car cabins trap up to 2× roadside pollution).`,
      winterSmogMechanism:
        'Cold-start exhaust emits 3×–5× more hydrocarbons and NOx during winter mornings—directly fueling secondary PM2.5 haze.',
      recommendedForUser:
        lifestyle.commuteMode === 'solo_car' || lifestyle.commuteMode === 'motorbike',
    },
    {
      id: 'clean-heating-cooking',
      title:
        lifestyle.heatingCookingFuel === 'wood_biomass'
          ? 'Replace Open Wood/Biomass Burning with Electric Heat Pump or LPG'
          : 'Shift High-Duty Heating & Boiling to High-Efficiency Electric / Induction',
      replaces:
        lifestyle.heatingCookingFuel === 'wood_biomass'
          ? 'Solid wood, coal, or biomass winter heating'
          : 'Open gas burner / fossil space heating',
      category: 'heating_cooking',
      co2KgPerMonth:
        lifestyle.heatingCookingFuel === 'wood_biomass'
          ? 145
          : lifestyle.heatingCookingFuel === 'diesel_backup'
            ? 120
            : 48,
      pm25GramsPerMonth:
        lifestyle.heatingCookingFuel === 'wood_biomass'
          ? 185
          : lifestyle.heatingCookingFuel === 'diesel_backup'
            ? 92
            : 28,
      noxGramsPerMonth:
        lifestyle.heatingCookingFuel === 'wood_biomass'
          ? 160
          : lifestyle.heatingCookingFuel === 'diesel_backup'
            ? 310
            : 115,
      personalExposureReductionPct: lifestyle.heatingCookingFuel === 'wood_biomass' ? 42 : 24,
      directImpactExplanation:
        lifestyle.heatingCookingFuel === 'wood_biomass'
          ? `Eliminates ~185 g of fine smoke PM2.5 per month from ${cityLabel}'s winter boundary layer and cuts indoor household particulate inhalation by ~42% for ${sizeFactor} family members.`
          : `Prevents ${lifestyle.heatingCookingFuel === 'diesel_backup' ? 92 : 28} g PM2.5 and ${lifestyle.heatingCookingFuel === 'diesel_backup' ? 310 : 115} g NOx monthly while keeping indoor air free of combustion gases.`,
      winterSmogMechanism:
        'Residential solid-fuel and diesel combustion accounts for 25%–50% of winter smog PM2.5 spikes in cold urban basins.',
      recommendedForUser:
        lifestyle.heatingCookingFuel === 'wood_biomass' ||
        lifestyle.heatingCookingFuel === 'diesel_backup' ||
        lifestyle.heatingCookingFuel === 'gas_lpg',
    },
    {
      id: 'midday-errand-batching',
      title: 'Batch Errands & School Runs into Midday (11:30–15:30) Low-Smog Window',
      replaces: 'Multiple cold-start morning/evening trips during thermal inversion',
      category: 'routine_timing',
      co2KgPerMonth: 28,
      pm25GramsPerMonth: 12,
      noxGramsPerMonth: 82,
      personalExposureReductionPct: safeAqi >= 100 ? 28 : 16,
      directImpactExplanation: `Cuts family outdoor PM2.5 inhalation by ~${safeAqi >= 100 ? 28 : 16}% (avoiding morning inversion peaks that are often 1.6× higher than midday) and eliminates 28 kg CO₂/month of cold-engine fuel waste.`,
      winterSmogMechanism:
        'Midday solar warming lifts the mixing height, dispersing street-level emissions vertically instead of trapping them at lung height.',
      recommendedForUser: true,
    },
    {
      id: 'zero-idling-thermal-prep',
      title: 'Zero-Idling School/Transit Pickup + Thermal Window Curtains',
      replaces: 'Idling engines at school gates & over-heating drafty rooms',
      category: 'community',
      co2KgPerMonth: 32,
      pm25GramsPerMonth: 15,
      noxGramsPerMonth: 96,
      personalExposureReductionPct: 14,
      directImpactExplanation:
        'Turning off engines during 10-minute school/errand waits prevents localized NO₂/PM2.5 plumes right where children breathe, while thermal curtains trim winter heating fuel use by 15%–20%.',
      winterSmogMechanism:
        'Idling cold engines outside schools creates concentrated micro-plumes of PM2.5 and benzene in calm winter air.',
      recommendedForUser: true,
    },
    {
      id: 'neighborhood-smog-carpool',
      title: 'Join a 4-Family School & Neighborhood Winter Carpool Circle',
      replaces: '4 separate household vehicles running identical morning routes',
      category: 'community',
      co2KgPerMonth: 64,
      pm25GramsPerMonth: 22,
      noxGramsPerMonth: 175,
      personalExposureReductionPct: 12,
      directImpactExplanation: `Removes 3 cold-start cars per day from ${cityLabel} school streets—preventing 64 kg CO₂, 22 g PM2.5, and 175 g NOx per household every month.`,
      winterSmogMechanism:
        'Morning school-zone congestion coincides directly with the shallowest nocturnal thermal inversion layer of the day.',
      recommendedForUser: sizeFactor >= 2 || pm25 >= 25,
    },
  ];

  return items.sort((a, b) => Number(b.recommendedForUser) - Number(a.recommendedForUser));
}

/** Aggregates personal, household, and 500-family community airshed impact. */
export function calculateDirectImpactSummary(
  selectedIds: readonly string[],
  alternatives: readonly SustainableAlternative[],
  householdSize: number,
  communityScaleFamilies = 500,
): DirectImpactSummary {
  const chosen = alternatives.filter((item) => selectedIds.includes(item.id));
  const householdCo2KgPerMonth = Math.round(
    chosen.reduce((sum, item) => sum + item.co2KgPerMonth, 0),
  );
  const householdPm25GramsPerMonth = Math.round(
    chosen.reduce((sum, item) => sum + item.pm25GramsPerMonth, 0),
  );
  const householdNoxGramsPerMonth = Math.round(
    chosen.reduce((sum, item) => sum + item.noxGramsPerMonth, 0),
  );

  const remainingRisk = chosen.reduce(
    (risk, item) => risk * (1 - item.personalExposureReductionPct / 100),
    1,
  );
  const personalExposureReductionPct = Math.min(75, Math.round((1 - remainingRisk) * 100));
  const communityCo2TonnesPerMonth = Number(
    ((householdCo2KgPerMonth * communityScaleFamilies) / 1000).toFixed(1),
  );
  const communityPm25KgPerMonth = Number(
    ((householdPm25GramsPerMonth * communityScaleFamilies) / 1000).toFixed(1),
  );

  const safeHousehold = Math.max(1, Math.round(householdSize));
  const plainLanguageSummary =
    chosen.length === 0
      ? 'Select one or more sustainable alternatives below to see the direct reduction in your family’s inhaled PM2.5 and local winter smog emissions.'
      : `Your ${chosen.length} selected choice${chosen.length === 1 ? '' : 's'} cut estimated inhaled winter smog exposure by ~${personalExposureReductionPct}% for ${safeHousehold} household member${safeHousehold === 1 ? '' : 's'} and keep ${householdCo2KgPerMonth} kg CO₂, ${householdNoxGramsPerMonth} g NOx, and ${householdPm25GramsPerMonth} g PM2.5 out of local air every month. If ${communityScaleFamilies} neighborhood families make the same choices, the community prevents ${communityPm25KgPerMonth} kg of lung-damaging PM2.5 and ${communityCo2TonnesPerMonth} tonnes of CO₂ each winter month.`;

  return {
    selectedCount: chosen.length,
    personalExposureReductionPct,
    householdCo2KgPerMonth,
    householdPm25GramsPerMonth,
    householdNoxGramsPerMonth,
    communityScaleFamilies,
    communityCo2TonnesPerMonth,
    communityPm25KgPerMonth,
    plainLanguageSummary,
  };
}
