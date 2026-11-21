import { Clock, ShieldCheck, Sparkles, Wind } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { PersonaProfile } from '../../types/aqi';

export interface RoutineOptimizerProps {
  zoneName: string;
  aqi: number;
  pm25: number;
  initialPersona?: PersonaProfile;
}

export interface RoutineSlot {
  window: string;
  activity: string;
  status: 'safe' | 'caution' | 'avoid';
  note: string;
}

export interface RoutinePlanView {
  summary: string;
  safeOutdoorWindow: string;
  maskRecommendation: string;
  indoorGuidance: string;
  schedule: RoutineSlot[];
  source: 'gemini' | 'fallback';
}

const PERSONA_OPTIONS: Array<{ value: PersonaProfile; label: string }> = [
  { value: 'general', label: 'General Adult' },
  { value: 'children', label: 'Children' },
  { value: 'elderly', label: 'Elderly (65+)' },
  { value: 'asthmatics', label: 'Asthma / Respiratory' },
];

export function buildLocalRoutinePlan(
  persona: PersonaProfile,
  aqi: number,
  zoneName: string,
): RoutinePlanView {
  const highRisk = aqi >= 151 || (aqi >= 101 && persona !== 'general');
  const safeOutdoorWindow = aqi <= 50 ? '07:00–19:00' : aqi <= 100 ? '11:00–16:00' : '12:00–14:30';
  const maskRecommendation =
    aqi >= 151
      ? 'Fitted N95/KF94 respirator required for all outdoor movement.'
      : aqi >= 101
        ? persona === 'general'
          ? 'Consider N95 mask during prolonged roadside commutes.'
          : 'Wear fitted N95/KN95 outdoors and keep rescue medication ready.'
        : 'No respirator needed under current conditions.';

  return {
    summary: highRisk
      ? `Elevated particulate risk in ${zoneName} (AQI ${Math.round(aqi)}). Shift strenuous activity indoors and use the midday dispersion window.`
      : `Manageable ambient conditions in ${zoneName} (AQI ${Math.round(aqi)}). Best dispersion occurs during late morning to mid-afternoon.`,
    safeOutdoorWindow,
    maskRecommendation,
    indoorGuidance:
      aqi >= 101
        ? 'Keep windows closed during morning/evening rush hours and run HEPA air purification.'
        : 'Cross-ventilate indoors during midday when ambient particulates dip.',
    schedule: [
      {
        window: '06:00–09:30',
        activity: 'Morning Commute / School Run',
        status: aqi >= 101 ? 'avoid' : 'caution',
        note: 'Surface temperature inversion typically traps peak rush-hour emissions.',
      },
      {
        window: safeOutdoorWindow,
        activity: 'Optimal Outdoor Window',
        status: aqi >= 180 ? 'caution' : 'safe',
        note: 'Peak vertical mixing provides lowest particulate concentration of the day.',
      },
      {
        window: '17:30–21:00',
        activity: 'Evening Wind-Down & Indoor IAQ',
        status: highRisk ? 'avoid' : 'caution',
        note: 'Boundary layer cools; keep bedrooms sealed and run filtration.',
      },
    ],
    source: 'fallback',
  };
}

export function RoutineOptimizer({
  zoneName,
  aqi,
  pm25,
  initialPersona = 'general',
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
        }),
      });

      if (!response.ok) {
        throw new Error(`Routine optimizer returned status ${response.status}`);
      }

      const payload = (await response.json()) as {
        routine?: {
          summary?: string;
          safeOutdoorWindows?: string[];
          maskAdvice?: string;
          indoorGuidance?: string;
          schedule?: Array<{
            timeWindow?: string;
            activity?: string;
            safetyLevel?: string;
            notes?: string;
          }>;
        };
      };

      const routine = payload.routine;
      if (routine && routine.summary) {
        const localBase = buildLocalRoutinePlan(persona, aqi, zoneName);
        setPlan({
          summary: routine.summary,
          safeOutdoorWindow: routine.safeOutdoorWindows?.[0] || localBase.safeOutdoorWindow,
          maskRecommendation: routine.maskAdvice || localBase.maskRecommendation,
          indoorGuidance: routine.indoorGuidance || localBase.indoorGuidance,
          schedule:
            Array.isArray(routine.schedule) && routine.schedule.length > 0
              ? routine.schedule.map((slot) => ({
                  window: slot.timeWindow || '11:00–15:00',
                  activity: slot.activity || 'Outdoor activity',
                  status:
                    slot.safetyLevel === 'avoid'
                      ? 'avoid'
                      : slot.safetyLevel === 'caution'
                        ? 'caution'
                        : 'safe',
                  note: slot.notes || 'Follow EPA exposure guidance.',
                }))
              : localBase.schedule,
          source: 'gemini',
        });
      } else {
        setPlan(buildLocalRoutinePlan(persona, aqi, zoneName));
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} — displaying deterministic heuristic plan.`
          : 'Routine service unavailable — displaying deterministic heuristic plan.',
      );
      setPlan(buildLocalRoutinePlan(persona, aqi, zoneName));
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
          className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-700 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-cyan-800 disabled:opacity-60 whitespace-nowrap shrink-0"
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
