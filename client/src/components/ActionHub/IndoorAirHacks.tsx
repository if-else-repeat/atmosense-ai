import { CheckSquare, Fan, ShieldCheck, Square, Wind } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  computeCorsiRosenthalMetrics,
  generateIaqHacks,
  type LifestyleProfile,
} from '../../utils/smogImpactEngine';

export interface IndoorAirHacksProps {
  aqi: number;
  pm25: number;
  lifestyle: LifestyleProfile;
}

const COMPLETED_HACKS_KEY = 'atmosense-iaq-hacks-completed-v1';

function readCompletedHackIds(): string[] {
  try {
    const raw = window.localStorage.getItem(COMPLETED_HACKS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Interactive Indoor Air Quality (IAQ) Hacks panel tailored to live winter smog AQI,
 * housing draftiness, cooking/heating fuel, and user room dimensions.
 */
export function IndoorAirHacks({ aqi, pm25, lifestyle }: IndoorAirHacksProps) {
  const [roomAreaSqm, setRoomAreaSqm] = useState<number>(25);
  const [completedIds, setCompletedIds] = useState<string[]>(readCompletedHackIds);

  const crMetrics = useMemo(() => computeCorsiRosenthalMetrics(roomAreaSqm), [roomAreaSqm]);
  const hacks = useMemo(
    () => generateIaqHacks(aqi, pm25, lifestyle, roomAreaSqm),
    [aqi, pm25, lifestyle, roomAreaSqm],
  );

  const toggleCompleted = (hackId: string) => {
    setCompletedIds((prev) => {
      const next = prev.includes(hackId) ? prev.filter((id) => id !== hackId) : [...prev, hackId];
      try {
        window.localStorage.setItem(COMPLETED_HACKS_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage quota errors
      }
      return next;
    });
  };

  return (
    <div className="space-y-5">
      {/* Interactive Room Sizing & Corsi-Rosenthal Calculator */}
      <div className="rounded-xl border border-cyan-200/80 bg-cyan-50/50 p-4 dark:border-cyan-900/60 dark:bg-cyan-950/30">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Fan className="h-4 w-4 text-cyan-700 dark:text-cyan-400" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Room Filtration &amp; DIY Air Cleaner Sizer
              </h3>
            </div>
            <label
              htmlFor="iaq-room-area-slider"
              className="mt-2 block text-xs text-slate-600 dark:text-slate-300"
            >
              Target room area:{' '}
              <span className="font-mono font-semibold text-cyan-900 dark:text-cyan-200">
                {roomAreaSqm} m²
              </span>{' '}
              ({crMetrics.roomVolumeM3} m³ volume)
            </label>
            <input
              id="iaq-room-area-slider"
              type="range"
              min={10}
              max={80}
              step={5}
              value={roomAreaSqm}
              onChange={(e) => setRoomAreaSqm(Number(e.target.value))}
              className="mt-2 w-full max-w-md accent-cyan-700"
            />
          </div>

          <dl className="grid grid-cols-3 gap-3 text-center sm:min-w-[300px]">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
              <dt className="text-[11px] text-slate-500 dark:text-slate-400">DIY CR-Box ACH</dt>
              <dd className="mt-0.5 font-mono text-sm font-bold text-cyan-800 dark:text-cyan-300">
                {crMetrics.airChangesPerHour}×/hr
              </dd>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
              <dt className="text-[11px] text-slate-500 dark:text-slate-400">80% Clear Time</dt>
              <dd className="mt-0.5 font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                {crMetrics.minutesToClear80Pct} min
              </dd>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
              <dt className="text-[11px] text-slate-500 dark:text-slate-400">Indoor PM2.5 Drop</dt>
              <dd className="mt-0.5 font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400">
                -{crMetrics.indoorPm25ReductionPct}%
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Tailored IAQ Hacks Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {hacks.map((hack) => {
          const isDone = completedIds.includes(hack.id);
          return (
            <article
              key={hack.id}
              className={`flex flex-col justify-between rounded-xl border p-4 transition-colors ${
                isDone
                  ? 'border-emerald-300 bg-emerald-50/40 dark:border-emerald-800/70 dark:bg-emerald-950/20'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/60'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-cyan-800 dark:text-cyan-300">
                      {hack.priority} · {hack.estimatedCostLabel}
                    </span>
                    <h4 className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {hack.title}
                    </h4>
                  </div>
                  <span className="shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                    -{hack.pm25ReductionPct}% PM2.5
                  </span>
                </div>

                <ul className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  {hack.actionSteps.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Wind
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400"
                        aria-hidden="true"
                      />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 rounded-lg bg-slate-50 p-2.5 text-xs dark:bg-slate-900">
                  <p className="font-medium text-slate-800 dark:text-slate-200">
                    <ShieldCheck
                      className="mr-1 inline h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
                      aria-hidden="true"
                    />
                    Direct Impact: {hack.directImpactExplanation}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Winter Smog Context: {hack.winterSmogNote}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => toggleCompleted(hack.id)}
                aria-pressed={isDone}
                className={`mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  isDone
                    ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {isDone ? (
                  <>
                    <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />
                    Active in Our Home
                  </>
                ) : (
                  <>
                    <Square className="h-3.5 w-3.5" aria-hidden="true" />
                    Mark Hack Active
                  </>
                )}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
