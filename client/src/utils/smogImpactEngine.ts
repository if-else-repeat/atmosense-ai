/**
 * @module smogImpactEngine
 * Pure, deterministic atmospheric & lifestyle impact engine powering Challenge 6:
 * - Severe winter smog Indoor Air Quality (IAQ) hacks & Corsi-Rosenthal CADR math
 * - Re-exports sustainable alternatives and direct impact quantification.
 */

import { calculateDirectImpactSummary, generateSustainableAlternatives } from './smogAlternatives';
import {
  DEFAULT_LIFESTYLE_PROFILE,
  computeCorsiRosenthalMetrics,
  type CommuteMode,
  type CorsiRosenthalMetrics,
  type DirectImpactSummary,
  type HeatingCookingFuel,
  type HousingType,
  type IndoorAirHack,
  type LifestyleProfile,
  type SustainableAlternative,
} from './smogImpactTypes';

export {
  DEFAULT_LIFESTYLE_PROFILE,
  calculateDirectImpactSummary,
  computeCorsiRosenthalMetrics,
  generateSustainableAlternatives,
};
export type {
  CommuteMode,
  CorsiRosenthalMetrics,
  DirectImpactSummary,
  HeatingCookingFuel,
  HousingType,
  IndoorAirHack,
  LifestyleProfile,
  SustainableAlternative,
};

/** Generates location-, AQI-, and lifestyle-tailored Indoor Air Quality (IAQ) hacks. */
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
