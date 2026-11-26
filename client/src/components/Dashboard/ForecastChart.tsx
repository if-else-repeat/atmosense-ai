import { AlertTriangle, CheckCircle2, Info, OctagonAlert, ShieldAlert } from 'lucide-react';
import { useCallback, useId, useMemo, useState, type KeyboardEvent } from 'react';
import type { ForecastHourlyPoint } from '../../types/aqi';
import { buildForecastSrDescription, getAQIStatusPresentation } from '../../utils/dashboardAqi';
import { buildForecastGeometry, computeForecastSummaryStats } from './forecastGeometry';
import { ForecastSvgPlot } from './ForecastSvgPlot';

export interface ForecastChartProps {
  forecast: ForecastHourlyPoint[];
  locationName: string;
}

function StatusIcon({
  iconKey,
}: {
  iconKey: ReturnType<typeof getAQIStatusPresentation>['iconKey'];
}) {
  switch (iconKey) {
    case 'check':
      return <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
    case 'info':
      return <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
    case 'alert-triangle':
      return <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
    case 'shield-alert':
      return <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
    case 'octagon-alert':
      return <OctagonAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
  }
}

/**
 * Native SVG 24-hour AQI forecast chart (zero external chart libraries).
 * Lazy-loaded by AQIDashboard with keyboard scrubbing (Left/Right/Home/End),
 * EPA threshold guidelines, convective dispersion window highlighting, and `.sr-only` narration.
 */
export function ForecastChart({ forecast, locationName }: ForecastChartProps) {
  const gradientId = useId();
  const [activeIndex, setActiveIndex] = useState<number>(0);

  const safePoints = useMemo(() => forecast.slice(0, 24), [forecast]);
  const boundedIndex = Math.min(activeIndex, Math.max(0, safePoints.length - 1));
  const activePoint = safePoints[boundedIndex];

  const srDescription = useMemo(
    () => buildForecastSrDescription(safePoints, locationName),
    [safePoints, locationName],
  );
  const geometry = useMemo(() => buildForecastGeometry(safePoints), [safePoints]);
  const summaryStats = useMemo(() => computeForecastSummaryStats(safePoints), [safePoints]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (safePoints.length === 0) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setActiveIndex((prev) => Math.min(safePoints.length - 1, prev + 1));
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setActiveIndex((prev) => Math.max(0, prev - 1));
      } else if (event.key === 'Home') {
        event.preventDefault();
        setActiveIndex(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        setActiveIndex(safePoints.length - 1);
      }
    },
    [safePoints.length],
  );

  const activeStatus = activePoint ? getAQIStatusPresentation(activePoint.aqi) : null;

  return (
    <section
      aria-labelledby="forecast-chart-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
        <div>
          <h2
            id="forecast-chart-heading"
            className="font-display text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            24-Hour Air Quality Forecast
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Hourly US EPA AQI trajectory · Shaded band marks 11:00–16:00 solar convection mixing
          </p>
        </div>

        {activePoint && activeStatus && (
          <div
            aria-live="polite"
            className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300"
          >
            <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {activePoint.hourLabel}
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
              ·
            </span>
            <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-slate-50">
              AQI {activePoint.aqi}
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
              ·
            </span>
            <span
              className={`inline-flex items-center gap-1 font-medium ${activeStatus.textClass}`}
            >
              <StatusIcon iconKey={activeStatus.iconKey} />
              <span>{activeStatus.shortLabel}</span>
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
              ·
            </span>
            <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
              PM2.5 {activePoint.pm25.toFixed(1)} µg/m³
            </span>
          </div>
        )}
      </div>

      <p className="sr-only" id="forecast-chart-sr-summary">
        {srDescription}
      </p>

      <div
        role="region"
        tabIndex={0}
        aria-label="Interactive 24-hour AQI forecast chart. Press Left and Right arrow keys to step through hours."
        aria-describedby="forecast-chart-sr-summary"
        onKeyDown={handleKeyDown}
        className="mt-4 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
      >
        {safePoints.length === 0 ? (
          <div className="flex h-56 items-center justify-center text-sm text-slate-500 dark:text-slate-400">
            Forecast trajectory unavailable for this location.
          </div>
        ) : (
          <ForecastSvgPlot
            geometry={geometry}
            gradientId={gradientId}
            locationName={locationName}
            boundedIndex={boundedIndex}
            onSelectIndex={setActiveIndex}
          />
        )}
      </div>

      {summaryStats && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums">
            <span>
              Low:{' '}
              <strong className="font-semibold text-emerald-700 dark:text-emerald-400">
                AQI {summaryStats.minPt.aqi}
              </strong>{' '}
              ({summaryStats.minPt.hourLabel})
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Peak:{' '}
              <strong className="font-semibold text-orange-700 dark:text-orange-400">
                AQI {summaryStats.maxPt.aqi}
              </strong>{' '}
              ({summaryStats.maxPt.hourLabel})
            </span>
          </div>
          <span>Use Left / Right arrows to inspect hourly points</span>
        </div>
      )}
    </section>
  );
}

export default ForecastChart;
