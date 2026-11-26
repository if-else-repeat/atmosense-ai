import { BookmarkCheck, ShieldAlert } from 'lucide-react';
import type { FormEvent } from 'react';
import type {
  AirQualityStation,
  HealthAdvisoryResult,
  SensitivityProfile,
} from '../../types/airQuality';
import { getAqiTone } from '../../utils/airQuality';

const PROFILES: ReadonlyArray<{ id: SensitivityProfile; label: string; detail: string }> = [
  { id: 'general', label: 'General Public', detail: 'Standard EPA exposure guidance' },
  { id: 'respiratory', label: 'Asthma / Respiratory', detail: 'Tighter PM2.5 & NO₂ precaution' },
  { id: 'athlete', label: 'Outdoor Runner', detail: 'High-ventilation exertion timing' },
  { id: 'vulnerable', label: 'Children & Seniors', detail: 'Conservative exposure ceilings' },
];

export interface HealthBriefCardProps {
  station: AirQualityStation;
  sensitivityProfile: SensitivityProfile;
  onChangeSensitivity: (profile: SensitivityProfile) => void;
  activityGoal: string;
  onChangeActivityGoal: (goal: string) => void;
  advisory: HealthAdvisoryResult | null;
  advisoryLoading: boolean;
  advisoryError: string | null;
  advisorySaved: boolean;
  onGenerateAdvisory: (e: FormEvent) => void;
  onSaveAdvisory: () => void;
}

export function HealthBriefCard({
  station,
  sensitivityProfile,
  onChangeSensitivity,
  activityGoal,
  onChangeActivityGoal,
  advisory,
  advisoryLoading,
  advisoryError,
  advisorySaved,
  onGenerateAdvisory,
  onSaveAdvisory,
}: HealthBriefCardProps) {
  const tone = getAqiTone(station.category.key);

  return (
    <section className="flex min-w-0 flex-col gap-5 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 lg:col-span-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Respiratory Health Brief
        </h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          AtmoSense AI analysis grounded in {station.city} telemetry · AQI{' '}
          <span className={`font-mono font-semibold tabular-nums ${tone.textClass}`}>
            {station.aqi}
          </span>
        </p>
      </div>

      <form onSubmit={onGenerateAdvisory} className="space-y-4">
        <fieldset>
          <legend className="text-xs font-medium text-slate-700 dark:text-slate-300">
            Sensitivity Profile
          </legend>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PROFILES.map((item) => {
              const selected = sensitivityProfile === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChangeSensitivity(item.id)}
                  aria-pressed={selected}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    selected
                      ? 'border-cyan-700 bg-cyan-50/70 text-slate-900 dark:border-cyan-500 dark:bg-cyan-950/40 dark:text-slate-100'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="text-xs font-semibold">{item.label}</div>
                  <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {item.detail}
                  </div>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label
            htmlFor="activity-goal-input"
            className="block text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            Planned Outdoor Activity
          </label>
          <input
            id="activity-goal-input"
            type="text"
            maxLength={180}
            value={activityGoal}
            onChange={(e) => onChangeActivityGoal(e.target.value)}
            placeholder="e.g., 40-minute bike commute at 18:00"
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        <button
          type="submit"
          disabled={advisoryLoading}
          className="w-full rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {advisoryLoading ? 'Analyzing Live Telemetry...' : 'Generate Health Brief'}
        </button>
      </form>

      {advisoryError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{advisoryError}</span>
        </div>
      )}

      {advisory && (
        <article className="space-y-4 border-t border-slate-200 pt-5 dark:border-slate-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verdict · Risk level:{' '}
                <span className="font-medium capitalize">{advisory.riskLevel}</span>
              </p>
              <h2 className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
                {advisory.outdoorVerdict}
              </h2>
            </div>
            <button
              type="button"
              onClick={onSaveAdvisory}
              disabled={advisorySaved}
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <BookmarkCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {advisorySaved ? 'Saved' : 'Save Brief'}
            </button>
          </div>

          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {advisory.summary}
          </p>

          <div className="grid grid-cols-1 gap-3 border-y border-slate-100 py-3 text-xs dark:border-slate-800">
            <div>
              <span className="text-slate-500 dark:text-slate-400">Recommended Window: </span>
              <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                {advisory.recommendedWindow}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Pollutant Note: </span>
              <span className="text-slate-700 dark:text-slate-300">{advisory.pollutantNote}</span>
            </div>
          </div>

          {advisory.protectiveActions.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Recommended Precautions
              </h3>
              <ul className="mt-2 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                {advisory.protectiveActions.map((action, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="font-mono text-cyan-700 dark:text-cyan-400">0{idx + 1}.</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>
      )}
    </section>
  );
}
