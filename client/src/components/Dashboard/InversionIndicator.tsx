import { AlertTriangle, CloudFog, Wind } from 'lucide-react';
import type { InversionAssessment } from '../../types/aqi';

export interface InversionIndicatorProps {
  assessment: InversionAssessment;
}

const RISK_STYLES: Readonly<
  Record<
    InversionAssessment['level'],
    {
      textClass: string;
      surfaceClass: string;
      borderClass: string;
      Icon: typeof Wind;
    }
  >
> = {
  low: {
    textClass: 'text-emerald-700 dark:text-emerald-400',
    surfaceClass: 'bg-emerald-50/70 dark:bg-emerald-950/30',
    borderClass: 'border-emerald-200 dark:border-emerald-800/70',
    Icon: Wind,
  },
  moderate: {
    textClass: 'text-amber-700 dark:text-amber-400',
    surfaceClass: 'bg-amber-50/70 dark:bg-amber-950/30',
    borderClass: 'border-amber-200 dark:border-amber-800/70',
    Icon: CloudFog,
  },
  high: {
    textClass: 'text-red-700 dark:text-red-400',
    surfaceClass: 'bg-red-50/70 dark:bg-red-950/30',
    borderClass: 'border-red-200 dark:border-red-800/70',
    Icon: AlertTriangle,
  },
};

const DIURNAL_SCHEDULE = [
  {
    key: 'morning-inversion' as const,
    window: '06:00–10:00',
    title: 'Morning Inversion',
    detail: 'Cool ground air traps overnight and commute particulates.',
  },
  {
    key: 'convective-mixing' as const,
    window: '11:00–16:00',
    title: 'Solar Convection',
    detail: 'Warming sunlight lifts the boundary layer for cleanest air.',
  },
  {
    key: 'evening-settling' as const,
    window: '17:00–20:00',
    title: 'Evening Settling',
    detail: 'Rush-hour traffic meets cooling air, spiking street-level PM2.5.',
  },
];

/**
 * Displays thermal inversion trapping risk with explicit color + icon + text status,
 * plain-language explanation, and the diurnal atmospheric dispersion timeline.
 */
export function InversionIndicator({ assessment }: InversionIndicatorProps) {
  const style = RISK_STYLES[assessment.level];
  const StatusIcon = style.Icon;

  return (
    <section
      aria-labelledby="inversion-indicator-heading"
      className="flex h-full flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
    >
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            id="inversion-indicator-heading"
            className="font-display text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            Thermal Inversion Risk
          </h2>
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold ${style.textClass}`}
          >
            <StatusIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{assessment.label}</span>
          </span>
        </div>

        <div className={`mt-4 rounded-lg border p-3.5 ${style.borderClass} ${style.surfaceClass}`}>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {assessment.headline}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
            {assessment.explanation}
          </p>
        </div>

        {/* Boundary-layer weather drivers */}
        <dl className="mt-4 grid grid-cols-3 gap-3 border-y border-slate-100 py-3 dark:border-slate-800">
          <div>
            <dt className="text-[11px] text-slate-500 dark:text-slate-400">Surface Wind</dt>
            <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {assessment.windKph.toFixed(0)} km/h
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-slate-500 dark:text-slate-400">Humidity</dt>
            <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {assessment.humidityPct.toFixed(0)}%
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-slate-500 dark:text-slate-400">Best Mixing</dt>
            <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
              {assessment.dispersionWindow}
            </dd>
          </div>
        </dl>
      </div>

      {/* Diurnal dispersion schedule */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {DIURNAL_SCHEDULE.map((slot) => {
          const isActive = assessment.currentPeriod === slot.key;
          return (
            <div
              key={slot.key}
              className={`border-t pt-2.5 ${
                isActive
                  ? 'border-cyan-600 dark:border-cyan-400'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {slot.window}
                </span>
                {isActive && (
                  <span className="text-[11px] font-medium text-cyan-700 dark:text-cyan-400">
                    Current
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                {slot.title}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                {slot.detail}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default InversionIndicator;
