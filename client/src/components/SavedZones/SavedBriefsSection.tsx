import { Trash2 } from 'lucide-react';
import type { SavedAdvisoryRecord } from '../../types/airQuality';

export interface SavedBriefsSectionProps {
  savedAdvisories: readonly SavedAdvisoryRecord[];
  onRemoveAdvisory: (id: string) => void;
}

export function SavedBriefsSection({ savedAdvisories, onRemoveAdvisory }: SavedBriefsSectionProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
        Archived Health Briefs
      </h2>
      {savedAdvisories.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Generated health briefs saved from the Health AI tab will appear here.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
          {savedAdvisories.map((adv) => (
            <li key={adv.id} className="py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {adv.outdoorVerdict}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {adv.cityName} · AQI{' '}
                    <span className="font-mono tabular-nums">{adv.aqiAtGeneration}</span> ·{' '}
                    {adv.sensitivityProfile} · {adv.createdAtLabel}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Delete saved brief for ${adv.cityName}`}
                  onClick={() => onRemoveAdvisory(adv.id)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {adv.summary}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
