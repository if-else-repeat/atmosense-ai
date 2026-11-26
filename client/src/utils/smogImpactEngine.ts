/**
 * @module smogImpactEngine
 * Pure, deterministic atmospheric & lifestyle impact engine powering Challenge 6:
 * - Severe winter smog Indoor Air Quality (IAQ) hacks & Corsi-Rosenthal CADR math
 * - Location- and lifestyle-tailored Sustainable Alternatives
 * - Transparent direct impact quantification (personal lung PM2.5 + CO2/NOx/PM2.5 avoided + community scale)
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

/**
 * Computes DIY Corsi-Rosenthal box-fan filter (4x MERV-13 filters) performance
 * and required commercial HEPA CADR for a target room floor area.
 */
export function computeCorsiRosenthalMetrics(
  roomAreaSqm: number,
  ceilingHeightM = 2.7,
): CorsiRosenthalMetrics {
  const clampedArea = Math.min(120, Math.max(8, Math.round(roomAreaSqm)));
  const roomVolumeM3 = Number((clampedArea * ceilingHeightM).toFixed(1));
  const estimatedCadrM3h = 540; // Benchmarked 20-inch box fan + four 20x20x2 MERV-13 filters
  const airChangesPerHour = Number((estimatedCadrM3h / roomVolumeM3).toFixed(1));
  // First-order exponential decay: t = ln(5) / ACH * 60 min for 80% reduction
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

/**
 * Generates location-, AQI-, and lifestyle-tailored Indoor Air Quality (IAQ) hacks
 * engineered for severe winter smog and thermal inversion episodes.
 */
export function generateIaqHacks(
  aqi: number,
  pm25: number,
  lifestyle: LifestyleProfile,
  roomAreaSqm = 25,
): IndoorAirHack[] {
  const safeAqi = Math.max(0, Math.round(aqi));
  const safePm25 = Math.max(0, Number(pm25.toFixed(1)));
  const cr = computeCorsiRosenthalMetrics(roomAreaSqm);
  const isDrafty = lifestyle.housingType === 'older_drafty';
  const usesCombustion =
    lifestyle.heatingCookingFuel === 'wood_biomass' ||
    lifestyle.heatingCookingFuel === 'gas_lpg' ||
    lifestyle.heatingCookingFuel === 'diesel_backup';

  const projectedIndoorPm25 = Math.max(
    4,
    Math.round(safePm25 * 0.65 * (1 - cr.indoorPm25ReductionPct / 100)),
  );

  return [
    {
      id: 'corsi-rosenthal-diy',
      title: 'Build a DIY Corsi-Rosenthal MERV-13 Air Cleaner',
      category: 'filtration',
      priority: safeAqi >= 100 ? 'essential' : 'high',
      pm25ReductionPct: cr.indoorPm25ReductionPct,
      estimatedCostLabel: '$55–$75 DIY (vs $300+ HEPA)',
      actionSteps: [
        'Tape four 20×20×2 inch MERV-13 furnace filters into an open cube with airflow arrows pointing inward.',
        `Seal a 20-inch box fan facing upward on top with duct tape — delivers ~${cr.estimatedCadrM3h} m³/h CADR (${cr.airChangesPerHour} ACH in your ${roomAreaSqm} m² room).`,
        `Run on medium speed for ${cr.minutesToClear80Pct} minutes after morning or evening smog peaks.`,
      ],
      directImpactExplanation: `Cuts indoor PM2.5 in a ${roomAreaSqm} m² room by ~${cr.indoorPm25ReductionPct}% (lowering estimated bedroom exposure from ~${Math.round(safePm25 * 0.65)} µg/m³ down to ~${projectedIndoorPm25} µg/m³).`,
      winterSmogNote:
        'During winter smog episodes, continuous MERV-13 recirculation prevents fine particulate infiltration from accumulating overnight while windows stay shut.',
    },
    {
      id: 'inversion-ventilation-timing',
      title: 'Thermal-Inversion Seal & Midday 15-Minute Flush',
      category: 'ventilation',
      priority: 'essential',
      pm25ReductionPct: 38,
      estimatedCostLabel: 'Free',
      actionSteps: [
        'Keep exterior windows and balcony doors firmly latched during 06:00–10:00 and 17:00–21:00 inversion traps.',
        'Open opposite-side windows for 15 minutes between 11:30–15:30 when solar heating lifts the winter smog layer.',
        'Close windows immediately afterward and run indoor filtration for 20 minutes.',
      ],
      directImpactExplanation:
        'Blocks peak stagnant morning and evening PM2.5 plumes while clearing trapped indoor CO₂ by ~45% during the cleanest midday window.',
      winterSmogNote: `At AQI ${safeAqi}, unscheduled morning ventilation pulls cold ground-level traffic and heating smoke straight into living spaces.`,
    },
    {
      id: 'clean-kitchen-combustion',
      title: usesCombustion
        ? 'Eliminate Indoor Combustion Spikes (Exhaust + Electric Swap)'
        : 'Zero-Combustion Cooking & Exhaust Protocol',
      category: 'source_control',
      priority: usesCombustion ? 'essential' : 'recommended',
      pm25ReductionPct: usesCombustion ? 55 : 28,
      estimatedCostLabel: usesCombustion ? '$0–$45 (portable induction / kettle)' : 'Free',
      actionSteps: [
        'Run a ducted range hood on high 5 minutes before and 15 minutes after frying or high-heat cooking.',
        usesCombustion
          ? 'Shift boiling and simmering from gas/biomass burners to an electric kettle, rice cooker, or portable induction plate.'
          : 'Avoid burning incense, scented candles, or open fireplaces while outdoor ventilation is restricted.',
        'Keep kitchen doors closed from bedrooms during cooking to isolate ultrafine aerosol plumes.',
      ],
      directImpactExplanation: usesCombustion
        ? 'Reduces indoor NO₂ peaks by up to 65% and cuts indoor cooking PM2.5 spikes by ~55%—critical for children and asthmatics.'
        : 'Prevents indoor PM2.5 from surging above 80 µg/m³ even when exterior windows are sealed against winter smog.',
      winterSmogNote:
        'Closed winter windows trap indoor gas, woodsmoke, and frying aerosols 3×–5× longer than in summer.',
    },
    {
      id: 'micro-sealing-draft-barriers',
      title: isDrafty
        ? 'Emergency Draft Sealing for Older Windows & Doors'
        : 'Door-Sweep & Window Gasket Smog Sealing',
      category: 'sealing',
      priority: isDrafty || safeAqi >= 150 ? 'essential' : 'recommended',
      pm25ReductionPct: isDrafty ? 34 : 22,
      estimatedCostLabel: '$8–$20 (silicone tape / towel roll)',
      actionSteps: [
        'Press self-adhesive EPDM foam or silicone weatherstripping along loose window sashes.',
        'Place a rolled damp towel or rubber door sweep across the bottom gap of exterior entry doors.',
        'Switch window AC or HVAC units to internal recirculation mode (close fresh-air intake damper).',
      ],
      directImpactExplanation: `Cuts outdoor smog seepage through building cracks by ~${isDrafty ? 34 : 22}%, letting your purifier work at lower noise and electricity draw.`,
      winterSmogNote:
        'Stack-effect pressure in heated winter homes sucks cold smog-laden outdoor air through lower-floor door and window gaps.',
    },
    {
      id: 'wet-cleaning-resuspension',
      title: 'Damp Microfiber Mopping & Entryway Shoe-Off Zone',
      category: 'source_control',
      priority: 'recommended',
      pm25ReductionPct: 24,
      estimatedCostLabel: 'Free',
      actionSteps: [
        'Replace dry sweeping and non-HEPA vacuuming with damp microfiber mopping twice weekly.',
        'Leave outdoor shoes and heavy winter coats in a single entryway tray to stop soot and road dust tracking.',
        `Size bedroom HEPA purifiers to at least ${cr.recommendedHepaCadrM3h} m³/h CADR for ${roomAreaSqm} m² rooms.`,
      ],
      directImpactExplanation:
        'Prevents settled soot and heavy-metal PM10 dust from re-entering the breathing zone by ~24%—especially near floor level where children play.',
      winterSmogNote:
        'Dry brooms kick settled winter soot back into suspension for 2+ hours in poorly ventilated rooms.',
    },
  ];
}

/**
 * Generates location- and lifestyle-tailored Sustainable Alternatives with clear,
 * transparent direct impact explanations for both family lungs and the shared urban airshed.
 */
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

  // Prioritize items directly tailored to the user's lifestyle first
  return items.sort((a, b) => Number(b.recommendedForUser) - Number(a.recommendedForUser));
}

/**
 * Aggregates the direct personal, household, and 500-family community airshed impact
 * for the user's selected sustainable alternatives.
 */
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

  // Diminishing-returns combination so stacked exposure reductions stay physically realistic (<= 75%)
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
