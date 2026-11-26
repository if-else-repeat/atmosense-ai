import { Clock, ShieldCheck, Sparkles, Wind } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { PersonaProfile } from '../../types/aqi';
import type { LifestyleProfile } from '../../utils/smogImpactEngine';
import {
  PERSONA_OPTIONS,
  buildLocalRoutinePlan,
  parseRoutineApiResponse,
  type RoutineApiPayload,
  type RoutinePlanView,
  type RoutineSlot,
} from './routineHelpers';

export { buildLocalRoutinePlan, type RoutinePlanView, type RoutineSlot };

export interface RoutineOptimizerProps {
  zoneName: string;
  aqi: number;
  pm25: number;
  initialPersona?: PersonaProfile;
  lifestyle?: LifestyleProfile;
}

export function RoutineOptimizer({
  zoneName,
  aqi,
  pm25,
  initialPersona = 'general',
  lifestyle,
}: RoutineOptimizerProps) {
  const [persona, setPersona] = useState<PersonaProfile>(initialPersona);
  const [language, setLanguage] = useState<'en' | 'es' | 'hi'>('en');
  const [plan, setPlan] = useState<RoutinePlanView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOptimize = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/routine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona,
          zone: { name: zoneName, aqi, pm25 },
          language,
          ...(lifestyle ? { lifestyle } : {}),
        }),
      });

      if (!response.ok) {
        throw new Error(`Routine optimizer returned status ${response.status}`);
      }

      const payload = (await response.json()) as RoutineApiPayload;
      setPlan(parseRoutineApiResponse(payload, persona, aqi, zoneName, lifestyle));
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} — displaying deterministic heuristic plan.`
          : 'Routine service unavailable — displaying deterministic heuristic plan.',
      );
      setPlan(buildLocalRoutinePlan(persona, aqi, zoneName, lifestyle));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      aria-labelledby="routine-optimizer-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
        <div>
          <h3
            id="routine-optimizer-heading"
            className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            <Clock className="h-4 w-4 text-cyan-700 dark:text-cyan-400" aria-hidden="true" />
            Daily Routine Optimizer
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Generates a personalized low-exposure schedule for {zoneName} (AQI{' '}
            <span className="font-mono font-semibold tabular-nums">{Math.round(aqi)}</span>).
          </p>
        </div>
      </div>

      <form onSubmit={handleOptimize} className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[160px] flex-1">
          <label
            htmlFor="routine-persona-select"
            className="block text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            Profile
          </label>
          <select
            id="routine-persona-select"
            value={persona}
            onChange={(e) => setPersona(e.target.value as PersonaProfile)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-cyan-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {PERSONA_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="w-32">
          <label
            htmlFor="routine-language-select"
            className="block text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            Language
          </label>
          <select
            id="routine-language-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value as 'en' | 'es' | 'hi')}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-cyan-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="hi">हिन्दी</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-cyan-700 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-cyan-800 disabled:opacity-60"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          {loading ? 'Optimizing…' : 'Optimize Daily Routine'}
        </button>
      </form>

      {error && (
        <p
          role="status"
          className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          {error}
        </p>
      )}

      {plan && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <p className="text-sm text-slate-800 dark:text-slate-200">{plan.summary}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/60">
              <p className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                <Wind
                  className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400"
                  aria-hidden="true"
                />
                Best Outdoor Window: <span className="font-mono">{plan.safeOutdoorWindow}</span>
              </p>
              <p className="mt-1 text-slate-600 dark:text-slate-400">{plan.indoorGuidance}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/60">
              <p className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                <ShieldCheck
                  className="h-3.5 w-3.5 text-cyan-700 dark:text-cyan-400"
                  aria-hidden="true"
                />
                Mask &amp; Respiratory Guidance
              </p>
              <p className="mt-1 text-slate-600 dark:text-slate-400">{plan.maskRecommendation}</p>
            </div>
          </div>

          <ul className="space-y-2">
            {plan.schedule.map((slot) => (
              <li
                key={`${slot.window}-${slot.activity}`}
                className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-xs dark:border-slate-800"
              >
                <div>
                  <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {slot.window}
                  </span>{' '}
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    · {slot.activity}
                  </span>
                  <p className="mt-0.5 text-slate-500 dark:text-slate-400">{slot.note}</p>
                </div>
                <span className="rounded border border-slate-200 px-2 py-0.5 font-medium capitalize text-slate-700 dark:border-slate-700 dark:text-slate-300">
                  {slot.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
