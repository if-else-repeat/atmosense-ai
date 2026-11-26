import { TrendingDown, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  calculateDirectImpactSummary,
  generateSustainableAlternatives,
  type LifestyleProfile,
} from '../../utils/smogImpactEngine';
import { AlternativeCard } from './AlternativeCard';
import { LifestyleProfileControls } from './LifestyleProfileControls';

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
      <LifestyleProfileControls lifestyle={lifestyle} onChangeLifestyle={onChangeLifestyle} />

      {/* Direct Impact Summary Card */}
      <div
        role="region"
        aria-label="Direct impact of your sustainable choices"
        aria-live="polite"
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
        {alternatives.map((alt) => (
          <AlternativeCard
            key={alt.id}
            alternative={alt}
            selected={selectedIds.includes(alt.id)}
            onToggle={toggleAlternative}
          />
        ))}
      </div>
    </div>
  );
}
