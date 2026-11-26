import { CalendarClock, Home, Leaf } from 'lucide-react';
import { useState } from 'react';
import type { PersonaProfile } from '../../types/aqi';
import { DEFAULT_LIFESTYLE_PROFILE, type LifestyleProfile } from '../../utils/smogImpactEngine';
import { RoutineOptimizer } from '../Routine/RoutineOptimizer';
import { IndoorAirHacks } from './IndoorAirHacks';
import { SustainableAlternatives } from './SustainableAlternatives';

export interface WinterSmogActionHubProps {
  locationName: string;
  aqi: number;
  pm25: number;
  persona: PersonaProfile;
}

type ActionHubTab = 'routine' | 'iaq' | 'alternatives';

const LIFESTYLE_STORAGE_KEY = 'atmosense-lifestyle-profile-v1';

function readStoredLifestyle(): LifestyleProfile {
  try {
    const raw = window.localStorage.getItem(LIFESTYLE_STORAGE_KEY);
    if (!raw) return DEFAULT_LIFESTYLE_PROFILE;
    const parsed = JSON.parse(raw) as Partial<LifestyleProfile>;
    return {
      commuteMode: parsed.commuteMode ?? DEFAULT_LIFESTYLE_PROFILE.commuteMode,
      heatingCookingFuel: parsed.heatingCookingFuel ?? DEFAULT_LIFESTYLE_PROFILE.heatingCookingFuel,
      housingType: parsed.housingType ?? DEFAULT_LIFESTYLE_PROFILE.housingType,
      householdSize:
        typeof parsed.householdSize === 'number' && parsed.householdSize >= 1
          ? Math.min(8, Math.round(parsed.householdSize))
          : DEFAULT_LIFESTYLE_PROFILE.householdSize,
    };
  } catch {
    return DEFAULT_LIFESTYLE_PROFILE;
  }
}

/**
 * Unified Winter Smog Action Hub surfacing all three core Challenge 6 pillars:
 * 1. Low-Emission Daily Routines (GenAI + atmospheric inversion physics)
 * 2. Indoor Air Quality (IAQ) Hacks (DIY Corsi-Rosenthal CADR math & sealing)
 * 3. Sustainable Alternatives & Direct Impact Simulator (location + lifestyle tailored)
 */
export function WinterSmogActionHub({
  locationName,
  aqi,
  pm25,
  persona,
}: WinterSmogActionHubProps) {
  const [activeTab, setActiveTab] = useState<ActionHubTab>('alternatives');
  const [lifestyle, setLifestyle] = useState<LifestyleProfile>(readStoredLifestyle);

  const handleUpdateLifestyle = (next: LifestyleProfile) => {
    setLifestyle(next);
    try {
      window.localStorage.setItem(LIFESTYLE_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  };

  return (
    <section
      aria-labelledby="winter-smog-action-hub-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-end dark:border-slate-800">
        <div className="max-w-xl">
          <h2
            id="winter-smog-action-hub-heading"
            className="font-display text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100"
          >
            Winter Smog Action Hub — {locationName}
          </h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Tailored low-emission routines, indoor air quality hacks, and sustainable alternatives
            with clear direct impact on family health and local emissions.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Winter smog guidance views"
          className="inline-flex shrink-0 flex-wrap gap-1 rounded-lg bg-slate-100 p-1 lg:flex-nowrap dark:bg-slate-800"
        >
          <button
            type="button"
            role="tab"
            id="tab-alternatives"
            aria-selected={activeTab === 'alternatives'}
            aria-controls="panel-alternatives"
            onClick={() => setActiveTab('alternatives')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'alternatives'
                ? 'bg-white text-slate-950 shadow-xs dark:bg-slate-900 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            <Leaf className="h-3.5 w-3.5" aria-hidden="true" />
            Sustainable Alternatives &amp; Impact
          </button>

          <button
            type="button"
            role="tab"
            id="tab-iaq"
            aria-selected={activeTab === 'iaq'}
            aria-controls="panel-iaq"
            onClick={() => setActiveTab('iaq')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'iaq'
                ? 'bg-white text-slate-950 shadow-xs dark:bg-slate-900 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            <Home className="h-3.5 w-3.5" aria-hidden="true" />
            Indoor Air Hacks
          </button>

          <button
            type="button"
            role="tab"
            id="tab-routine"
            aria-selected={activeTab === 'routine'}
            aria-controls="panel-routine"
            onClick={() => setActiveTab('routine')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'routine'
                ? 'bg-white text-slate-950 shadow-xs dark:bg-slate-900 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
            Low-Emission Daily Routine
          </button>
        </div>
      </div>

      <div className="mt-5">
        {activeTab === 'alternatives' && (
          <div id="panel-alternatives" role="tabpanel" aria-labelledby="tab-alternatives">
            <SustainableAlternatives
              aqi={aqi}
              pm25={pm25}
              locationName={locationName}
              lifestyle={lifestyle}
              onChangeLifestyle={handleUpdateLifestyle}
            />
          </div>
        )}

        {activeTab === 'iaq' && (
          <div id="panel-iaq" role="tabpanel" aria-labelledby="tab-iaq">
            <IndoorAirHacks aqi={aqi} pm25={pm25} lifestyle={lifestyle} />
          </div>
        )}

        {activeTab === 'routine' && (
          <div id="panel-routine" role="tabpanel" aria-labelledby="tab-routine">
            <RoutineOptimizer
              zoneName={locationName}
              aqi={aqi}
              pm25={pm25}
              initialPersona={persona}
              lifestyle={lifestyle}
            />
          </div>
        )}
      </div>
    </section>
  );
}

export default WinterSmogActionHub;
