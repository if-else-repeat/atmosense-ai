import { Check, Leaf, Sparkles } from 'lucide-react';
import type { SustainableAlternative } from '../../utils/smogImpactEngine';

export interface AlternativeCardProps {
  alternative: SustainableAlternative;
  selected: boolean;
  onToggle: (id: string) => void;
}

export function AlternativeCard({ alternative: alt, selected, onToggle }: AlternativeCardProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(alt.id)}
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
}
