import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Minus,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { memo, useMemo } from 'react';
import type { PollutantMetricCardData } from '../../types/aqi';

export interface PollutantCardProps {
  metric: PollutantMetricCardData;
  selected?: boolean;
  onSelect?: (id: PollutantMetricCardData['id']) => void;
}

const STATUS_STYLES: Readonly<
  Record<
    PollutantMetricCardData['status'],
    {
      label: string;
      textClass: string;
      barClass: string;
      strokeHex: string;
    }
  >
> = {
  good: {
    label: 'Nominal',
    textClass: 'text-emerald-700 dark:text-emerald-400',
    barClass: 'bg-emerald-600 dark:bg-emerald-500',
    strokeHex: '#16A34A',
  },
  moderate: {
    label: 'Moderate',
    textClass: 'text-amber-700 dark:text-amber-400',
    barClass: 'bg-amber-600 dark:bg-amber-500',
    strokeHex: '#D97706',
  },
  elevated: {
    label: 'Elevated',
    textClass: 'text-orange-700 dark:text-orange-400',
    barClass: 'bg-orange-600 dark:bg-orange-500',
    strokeHex: '#EA580C',
  },
  high: {
    label: 'High',
    textClass: 'text-red-700 dark:text-red-400',
    barClass: 'bg-red-600 dark:bg-red-500',
    strokeHex: '#DC2626',
  },
};

function StatusGlyph({ status }: { status: PollutantMetricCardData['status'] }) {
  switch (status) {
    case 'good':
      return <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
    case 'moderate':
      return <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
    case 'elevated':
      return <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
    case 'high':
      return <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
  }
}

/**
 * Memoized scientific telemetry card for a single ambient pollutant (PM2.5, PM10, NO2, CO, O3)
 * with tabular readout, native SVG micro-sparkline, explicit trend icon+text, and WHO/EPA gauge.
 */
export const PollutantCard = memo(function PollutantCard({
  metric,
  selected = false,
  onSelect,
}: PollutantCardProps) {
  const statusStyle = STATUS_STYLES[metric.status];

  const sparklinePath = useMemo(() => {
    const pts = metric.history;
    if (pts.length < 2) return '';
    const width = 72;
    const height = 26;
    const padY = 4;
    const minVal = Math.min(...pts);
    const maxVal = Math.max(...pts);
    const span = Math.max(maxVal - minVal, 0.001);

    return pts
      .map((val, idx) => {
        const x = (idx / (pts.length - 1)) * width;
        const y = height - padY - ((val - minVal) / span) * (height - padY * 2);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [metric.history]);

  const ratioPercent = useMemo(() => {
    const raw = (metric.value / Math.max(metric.guidelineValue, 0.001)) * 50;
    return Math.max(6, Math.min(100, Math.round(raw)));
  }, [metric.guidelineValue, metric.value]);

  const trendPresentation = useMemo(() => {
    if (metric.trend === 'rising') {
      return {
        label: `Rising ${metric.deltaPercent > 0 ? `+${metric.deltaPercent}%` : ''}`.trim(),
        className: 'text-orange-700 dark:text-orange-400',
        Icon: TrendingUp,
      };
    }
    if (metric.trend === 'falling') {
      return {
        label: `Falling ${metric.deltaPercent}%`,
        className: 'text-emerald-700 dark:text-emerald-400',
        Icon: TrendingDown,
      };
    }
    return {
      label: 'Steady',
      className: 'text-slate-600 dark:text-slate-400',
      Icon: Minus,
    };
  }, [metric.deltaPercent, metric.trend]);

  const TrendIcon = trendPresentation.Icon;
  const formattedValue =
    metric.id === 'o3'
      ? metric.value.toFixed(3)
      : metric.id === 'co'
        ? metric.value.toFixed(2)
        : metric.value.toFixed(1);

  return (
    <button
      type="button"
      onClick={() => onSelect?.(metric.id)}
      aria-pressed={selected}
      aria-label={`${metric.formula} ${metric.label}: ${formattedValue} ${metric.unit}, ${statusStyle.label}, trend ${trendPresentation.label}`}
      className={`group flex w-full flex-col justify-between rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 ${
        selected
          ? 'border-cyan-700 bg-cyan-50/40 dark:border-cyan-500 dark:bg-cyan-950/25'
          : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
      }`}
    >
      {/* Top block: Formula + status on line 1, full pollutant name cleanly on line 2 */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
            {metric.formula}
          </span>
          <span
            className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-medium ${statusStyle.textClass}`}
          >
            <StatusGlyph status={metric.status} />
            <span>{statusStyle.label}</span>
          </span>
        </div>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{metric.label}</p>
      </div>

      {/* Middle row: Tabular value + native SVG micro-sparkline */}
      <div className="mt-4 flex items-end justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-1">
          <span className="font-mono text-2xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-slate-50">
            {formattedValue}
          </span>
          <span className="whitespace-nowrap font-mono text-[11px] text-slate-500 dark:text-slate-400">
            {metric.unit}
          </span>
        </div>

        <svg
          width="72"
          height="26"
          viewBox="0 0 72 26"
          aria-hidden="true"
          className="shrink-0 overflow-visible"
        >
          <path
            d={sparklinePath}
            fill="none"
            stroke={statusStyle.strokeHex}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Bottom block: Single-line trend + threshold bar + clean guideline */}
      <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span
            className={`inline-flex items-center gap-1 whitespace-nowrap font-mono font-medium tabular-nums ${trendPresentation.className}`}
          >
            <TrendIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{trendPresentation.label}</span>
          </span>
        </div>

        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
          aria-hidden="true"
        >
          <div
            className={`h-full rounded-full transition-transform duration-200 ${statusStyle.barClass}`}
            style={{ width: `${ratioPercent}%` }}
          />
        </div>

        <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
          {metric.guidelineLabel}
        </p>
      </div>
    </button>
  );
});

export default PollutantCard;
