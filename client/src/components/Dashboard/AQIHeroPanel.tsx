import {
  AlertTriangle,
  CheckCircle2,
  Droplets,
  Info,
  MapPin,
  OctagonAlert,
  RefreshCw,
  ShieldAlert,
  Thermometer,
  Wind,
} from 'lucide-react';
import type { AQIDashboardData } from '../../types/aqi';
import type { AQIStatusPresentation } from '../../utils/dashboardAqi';

export interface AQIHeroPanelProps {
  data: AQIDashboardData;
  statusPresentation: AQIStatusPresentation;
  lastUpdatedText: string;
  whoPm25Ratio: string;
  refreshing: boolean;
  onRefresh: () => void;
  onNavigateMap?: () => void;
}

function AQIStatusIcon({ iconKey }: { iconKey: AQIStatusPresentation['iconKey'] }) {
  switch (iconKey) {
    case 'check':
      return <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />;
    case 'info':
      return <Info className="h-5 w-5 shrink-0" aria-hidden="true" />;
    case 'alert-triangle':
      return <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />;
    case 'shield-alert':
      return <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden="true" />;
    case 'octagon-alert':
      return <OctagonAlert className="h-5 w-5 shrink-0" aria-hidden="true" />;
  }
}

export function AQIHeroPanel({
  data,
  statusPresentation,
  lastUpdatedText,
  whoPm25Ratio,
  refreshing,
  onRefresh,
  onNavigateMap,
}: AQIHeroPanelProps) {
  return (
    <section
      aria-labelledby="realtime-aqi-heading"
      className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
        {/* Left: Location + Large Accessible AQI Number + Status (Color + Icon + Text) */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <MapPin
              className="h-3.5 w-3.5 shrink-0 text-cyan-700 dark:text-cyan-400"
              aria-hidden="true"
            />
            <h1
              id="realtime-aqi-heading"
              className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100"
            >
              {data.location.name}
            </h1>
            {data.location.district && (
              <>
                <span aria-hidden="true">·</span>
                <span>{data.location.district}</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-baseline gap-4">
            <div
              aria-live="polite"
              aria-atomic="true"
              className="flex items-baseline gap-2"
              data-testid="realtime-aqi-value"
            >
              <span className="font-mono text-6xl font-bold tracking-tight tabular-nums text-slate-950 sm:text-7xl dark:text-white">
                {data.aqi}
              </span>
              <span className="font-mono text-sm font-medium text-slate-500 dark:text-slate-400">
                US AQI
              </span>
            </div>

            <div
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold ${statusPresentation.borderClass} ${statusPresentation.surfaceClass} ${statusPresentation.textClass}`}
            >
              <AQIStatusIcon iconKey={statusPresentation.iconKey} />
              <span>{statusPresentation.category}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span data-testid="aqi-source-attribution">
              Source: {data.source}, updated {lastUpdatedText}
            </span>
            <span aria-hidden="true">·</span>
            <span>Dominant pollutant: {data.dominantPollutant}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{whoPm25Ratio}× WHO 24h PM2.5 guideline</span>
          </div>
        </div>

        {/* Right: Meteorological drivers + Direct Actions */}
        <div className="flex flex-col items-start gap-4 sm:items-end">
          <dl className="grid grid-cols-3 gap-5 border-t border-slate-100 pt-3 sm:border-t-0 sm:pt-0 dark:border-slate-800">
            <div>
              <dt className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                <Thermometer className="h-3 w-3" aria-hidden="true" />
                Temp
              </dt>
              <dd className="mt-0.5 font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {data.temperatureC.toFixed(1)}°C
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                <Droplets className="h-3 w-3" aria-hidden="true" />
                Humidity
              </dt>
              <dd className="mt-0.5 font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {data.humidityPct.toFixed(0)}%
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                <Wind className="h-3 w-3" aria-hidden="true" />
                Wind
              </dt>
              <dd className="mt-0.5 font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {data.windKph.toFixed(0)} km/h
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Refresh live air quality readings"
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {refreshing ? 'Updating…' : 'Refresh now'}
            </button>

            {onNavigateMap && (
              <button
                type="button"
                onClick={onNavigateMap}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-cyan-700 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 dark:bg-cyan-600 dark:hover:bg-cyan-500 dark:focus-visible:ring-offset-slate-900"
              >
                Explore Station Map
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
