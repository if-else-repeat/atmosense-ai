import { Check, Leaf, Sparkles, TrendingDown, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  calculateDirectImpactSummary,
  generateSustainableAlternatives,
  type CommuteMode,
  type HeatingCookingFuel,
  type HousingType,
  type LifestyleProfile,
} from '../../utils/smogImpactEngine';

export interface SustainableAlternativesProps {
  aqi: number;
  pm25: number;
  locationName: string;
  lifestyle: LifestyleProfile;
  onChangeLifestyle: (next: LifestyleProfile) => void;
}

const SELECTED_SWAPS_KEY = 'atmosense-sustainable-swaps-v1';

function readInitialSelectedSwaps(defaultIds: string[]): string[] {
  try {
    const raw = window.localStorage.getItem(SELECTED_SWAPS_KEY);
    if (!raw) return defaultIds;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string')
      : defaultIds;
  } catch {
    return defaultIds;
  }
}

/**
 * Interactive Sustainable Alternatives & Direct Impact Simulator tailored to
 * the user's location, commute, heating/cooking fuel, housing type, and family size.
 */
export function SustainableAlternatives({
  aqi,
  pm25,
  locationName,
  lifestyle,
  onChangeLifestyle,
}: SustainableAlternativesProps) {
  const alternatives = useMemo(
    () => generateSustainableAlternatives(aqi, pm25, lifestyle, locationName),
    [aqi, pm25, lifestyle, locationName],
  );

  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    readInitialSelectedSwaps(
      alternatives
        .filter((item) => item.recommendedForUser)
        .slice(0, 2)
        .map((item) => item.id),
    ),
  );

  const impact = useMemo(
    () => calculateDirectImpactSummary(selectedIds, alternatives, lifestyle.householdSize, 500),
    [selectedIds, alternatives, lifestyle.householdSize],
  );

  const toggleAlternative = (id: string) => {
    setSelectedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      try {
        window.localStorage.setItem(SELECTED_SWAPS_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage quota errors
      }
      return next;
    });
  };

  return (
    <div className="space-y-5">
      {/* Lifestyle Tailoring Controls */}
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800 dark:bg-slate-950/60">
        <div>
          <label
            htmlFor="lifestyle-commute"
            className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
          >
            Primary Commute
          </label>
          <select
            id="lifestyle-commute"
            value={lifestyle.commuteMode}
            onChange={(e) =>
              onChangeLifestyle({ ...lifestyle, commuteMode: e.target.value as CommuteMode })
            }
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="solo_car">Solo Petrol / Diesel Car</option>
            <option value="motorbike">Motorbike / Scooter</option>
            <option value="carpool">Shared Carpool</option>
            <option value="public_transit">Metro / Bus Transit</option>
            <option value="bike_walk">Bike / Walk</option>
            <option value="remote">Work From Home</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="lifestyle-heating"
            className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
          >
            Heating &amp; Cooking Fuel
          </label>
          <select
            id="lifestyle-heating"
            value={lifestyle.heatingCookingFuel}
            onChange={(e) =>
              onChangeLifestyle({
                ...lifestyle,
                heatingCookingFuel: e.target.value as HeatingCookingFuel,
              })
            }
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="gas_lpg">Gas Stove / LPG</option>
            <option value="wood_biomass">Wood / Biomass / Coal</option>
            <option value="diesel_backup">Diesel Generator / Heater</option>
            <option value="electric_induction">Electric / Induction</option>
            <option value="heat_pump">Clean Electric Heat Pump</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="lifestyle-housing"
            className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
          >
            Home Type
          </label>
          <select
            id="lifestyle-housing"
            value={lifestyle.housingType}
            onChange={(e) =>
              onChangeLifestyle({ ...lifestyle, housingType: e.target.value as HousingType })
            }
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="older_drafty">Older / Drafty Home</option>
            <option value="apartment_highrise">Urban Apartment</option>
            <option value="suburban_home">Detached House</option>
            <option value="shared_flat">Shared Flat / Dorm</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="lifestyle-household-size"
            className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
          >
            Household Members
          </label>
          <input
            id="lifestyle-household-size"
            type="number"
            min={1}
            max={8}
            value={lifestyle.householdSize}
            onChange={(e) =>
              onChangeLifestyle({
                ...lifestyle,
                householdSize: Math.min(8, Math.max(1, Number(e.target.value) || 1)),
              })
            }
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Direct Impact Summary Card */}
      <div
        role="region"
        aria-label="Direct impact of your sustainable choices"
        className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/25"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-950 dark:text-emerald-200">
            <TrendingDown
              className="h-4 w-4 text-emerald-700 dark:text-emerald-400"
              aria-hidden="true"
            />
            Direct Impact of Your Choices
          </h3>
          <span className="font-mono text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            {impact.selectedCount} active choice{impact.selectedCount === 1 ? '' : 's'}
          </span>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-emerald-200/80 bg-white p-3 dark:border-emerald-900/50 dark:bg-slate-900">
            <dt className="text-[11px] text-slate-500 dark:text-slate-400">Family Lung PM2.5</dt>
            <dd className="mt-0.5 font-mono text-lg font-bold text-emerald-700 dark:text-emerald-400">
              -{impact.personalExposureReductionPct}%
            </dd>
          </div>
          <div className="rounded-lg border border-emerald-200/80 bg-white p-3 dark:border-emerald-900/50 dark:bg-slate-900">
            <dt className="text-[11px] text-slate-500 dark:text-slate-400">CO₂ Avoided / Mo</dt>
            <dd className="mt-0.5 font-mono text-lg font-bold text-slate-900 dark:text-slate-100">
              {impact.householdCo2KgPerMonth} kg
            </dd>
          </div>
          <div className="rounded-lg border border-emerald-200/80 bg-white p-3 dark:border-emerald-900/50 dark:bg-slate-900">
            <dt className="text-[11px] text-slate-500 dark:text-slate-400">PM2.5 + NOx Cut</dt>
            <dd className="mt-0.5 font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
              {impact.householdPm25GramsPerMonth}g · {impact.householdNoxGramsPerMonth}g
            </dd>
          </div>
          <div className="rounded-lg border border-emerald-200/80 bg-white p-3 dark:border-emerald-900/50 dark:bg-slate-900">
            <dt className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              <Users className="h-3 w-3" aria-hidden="true" />
              500 Families Scale
            </dt>
            <dd className="mt-0.5 font-mono text-sm font-bold text-cyan-800 dark:text-cyan-300">
              {impact.communityPm25KgPerMonth} kg PM2.5
            </dd>
          </div>
        </dl>

        <p className="mt-3 text-xs leading-relaxed text-emerald-950 dark:text-emerald-100">
          {impact.plainLanguageSummary}
        </p>
      </div>

      {/* Sustainable Alternative Cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {alternatives.map((alt) => {
          const selected = selectedIds.includes(alt.id);
          return (
            <button
              key={alt.id}
              type="button"
              onClick={() => toggleAlternative(alt.id)}
              aria-pressed={selected}
              className={`flex flex-col justify-between rounded-xl border p-4 text-left transition-colors ${
                selected
                  ? 'border-cyan-700 bg-cyan-50/45 dark:border-cyan-500 dark:bg-cyan-950/30'
                  : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-800 dark:text-cyan-300">
                      {alt.recommendedForUser ? (
                        <>
                          <Sparkles className="h-3 w-3" aria-hidden="true" />
                          Tailored to Your Lifestyle
                        </>
                      ) : (
                        <>
                          <Leaf className="h-3 w-3" aria-hidden="true" />
                          Community Option
                        </>
                      )}
                    </span>
                    <h4 className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {alt.title}
                    </h4>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      Replaces: {alt.replaces}
                    </p>
                  </div>
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                      selected
                        ? 'border-cyan-700 bg-cyan-700 text-white'
                        : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900'
                    }`}
                    aria-hidden="true"
                  >
                    {selected && <Check className="h-3.5 w-3.5" />}
                  </span>
                </div>

                <p className="mt-2.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                  {alt.directImpactExplanation}
                </p>
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Why it matters in winter smog: {alt.winterSmogMechanism}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2.5 font-mono text-[11px] text-slate-600 dark:border-slate-800 dark:text-slate-300">
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  -{alt.personalExposureReductionPct}% exposure
                </span>
                <span aria-hidden="true">·</span>
                <span>-{alt.co2KgPerMonth} kg CO₂/mo</span>
                <span aria-hidden="true">·</span>
                <span>-{alt.pm25GramsPerMonth} g PM2.5/mo</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
