import { AlertTriangle, CheckCircle2, Info, OctagonAlert, ShieldAlert } from 'lucide-react';
import { useCallback, useId, useMemo, useState, type KeyboardEvent } from 'react';
import type { ForecastHourlyPoint } from '../../types/aqi';
import { buildForecastSrDescription, getAQIStatusPresentation } from '../../utils/dashboardAqi';

export interface ForecastChartProps {
  forecast: ForecastHourlyPoint[];
  locationName: string;
}

const CHART_WIDTH = 760;
const CHART_HEIGHT = 248;
const PAD = { top: 20, right: 20, bottom: 34, left: 46 };

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

  const geometry = useMemo(() => {
    const plotW = CHART_WIDTH - PAD.left - PAD.right;
    const plotH = CHART_HEIGHT - PAD.top - PAD.bottom;

    if (safePoints.length === 0) {
      return {
        maxY: 200,
        yTicks: [0, 50, 100, 150, 200],
        coords: [] as Array<{
          x: number;
          y: number;
          point: ForecastHourlyPoint;
          isSafeWindow: boolean;
        }>,
        linePath: '',
        areaPath: '',
      };
    }

    const rawMax = Math.max(...safePoints.map((p) => p.aqi), 100);
    const maxY = Math.min(500, Math.max(150, Math.ceil((rawMax + 25) / 50) * 50));
    const step = maxY <= 200 ? 50 : 100;
    const yTicks: number[] = [];
    for (let v = 0; v <= maxY; v += step) {
      yTicks.push(v);
    }

    const coords = safePoints.map((point, idx) => {
      const ratio = safePoints.length > 1 ? idx / (safePoints.length - 1) : 0;
      const x = PAD.left + ratio * plotW;
      const y = PAD.top + plotH - (Math.min(point.aqi, maxY) / maxY) * plotH;
      const hourNum = Number.parseInt(point.hourLabel.split(':')[0] ?? '0', 10);
      const isSafeWindow = hourNum >= 11 && hourNum <= 16;
      return { x, y, point, isSafeWindow };
    });

    const linePath = coords
      .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(' ');

    const baselineY = PAD.top + plotH;
    const first = coords[0]!;
    const last = coords[coords.length - 1]!;
    const areaPath = `${linePath} L ${last.x.toFixed(1)} ${baselineY.toFixed(1)} L ${first.x.toFixed(1)} ${baselineY.toFixed(1)} Z`;

    return { maxY, yTicks, coords, linePath, areaPath };
  }, [safePoints]);

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

  const activeCoord = geometry.coords[boundedIndex];
  const activeStatus = activePoint ? getAQIStatusPresentation(activePoint.aqi) : null;

  const summaryStats = useMemo(() => {
    if (safePoints.length === 0) return null;
    let minPt = safePoints[0]!;
    let maxPt = safePoints[0]!;
    for (const pt of safePoints) {
      if (pt.aqi < minPt.aqi) minPt = pt;
      if (pt.aqi > maxPt.aqi) maxPt = pt;
    }
    return { minPt, maxPt };
  }, [safePoints]);

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

      {/* Screen-reader narrative description for the SVG visualization */}
      <p className="sr-only" id="forecast-chart-sr-summary">
        {srDescription}
      </p>

      {/* Keyboard-navigable SVG viewport */}
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
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            role="img"
            aria-label={`24-hour AQI forecast curve for ${locationName}`}
            className="h-auto w-full select-none"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0891B2" stopOpacity="0.24" />
                <stop offset="100%" stopColor="#0891B2" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Highlight convective mixing safe hours (11:00-16:00) */}
            {geometry.coords.map((coord, idx) => {
              if (!coord.isSafeWindow) return null;
              const stepW =
                geometry.coords.length > 1
                  ? (CHART_WIDTH - PAD.left - PAD.right) / (geometry.coords.length - 1)
                  : 24;
              return (
                <rect
                  key={`conv-${idx}`}
                  x={Math.max(PAD.left, coord.x - stepW / 2)}
                  y={PAD.top}
                  width={stepW}
                  height={CHART_HEIGHT - PAD.top - PAD.bottom}
                  className="fill-emerald-500/8 dark:fill-emerald-400/10"
                />
              );
            })}

            {/* Horizontal grid lines & Y-axis labels */}
            {geometry.yTicks.map((tick) => {
              const plotH = CHART_HEIGHT - PAD.top - PAD.bottom;
              const y = PAD.top + plotH - (tick / geometry.maxY) * plotH;
              return (
                <g key={tick}>
                  <line
                    x1={PAD.left}
                    y1={y}
                    x2={CHART_WIDTH - PAD.right}
                    y2={y}
                    className="stroke-slate-200 dark:stroke-slate-800"
                    strokeWidth="1"
                    strokeDasharray={tick === 0 ? undefined : '3 3'}
                  />
                  <text
                    x={PAD.left - 10}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-slate-500 font-mono text-[11px] dark:fill-slate-400"
                  >
                    {tick}
                  </text>
                </g>
              );
            })}

            {/* EPA Moderate/Sensitive 100 AQI reference line */}
            {geometry.maxY >= 100 && (
              <line
                x1={PAD.left}
                y1={PAD.top + (CHART_HEIGHT - PAD.top - PAD.bottom) * (1 - 100 / geometry.maxY)}
                x2={CHART_WIDTH - PAD.right}
                y2={PAD.top + (CHART_HEIGHT - PAD.top - PAD.bottom) * (1 - 100 / geometry.maxY)}
                stroke="#D97706"
                strokeOpacity="0.45"
                strokeWidth="1"
                strokeDasharray="5 4"
              />
            )}

            {/* Area fill & primary curve */}
            <path d={geometry.areaPath} fill={`url(#${gradientId})`} />
            <path
              d={geometry.linePath}
              fill="none"
              stroke="#0891B2"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Active vertical crosshair */}
            {activeCoord && (
              <line
                x1={activeCoord.x}
                y1={PAD.top}
                x2={activeCoord.x}
                y2={CHART_HEIGHT - PAD.bottom}
                className="stroke-cyan-700/40 dark:stroke-cyan-400/50"
                strokeWidth="1.25"
                strokeDasharray="3 3"
              />
            )}

            {/* Interactive data points & X-axis labels */}
            {geometry.coords.map((coord, idx) => {
              const isSelected = idx === boundedIndex;
              const status = getAQIStatusPresentation(coord.point.aqi);
              const showLabel = idx % 3 === 0 || idx === geometry.coords.length - 1;
              return (
                <g key={`${coord.point.hourLabel}-${idx}`}>
                  {/* Wide transparent hit zone for pointer scrubbing */}
                  <rect
                    x={coord.x - 14}
                    y={PAD.top}
                    width={28}
                    height={CHART_HEIGHT - PAD.top - PAD.bottom}
                    fill="transparent"
                    className="cursor-crosshair"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => setActiveIndex(idx)}
                  />
                  <circle
                    cx={coord.x}
                    cy={coord.y}
                    r={isSelected ? 5.5 : 2.8}
                    fill={isSelected ? status.hexColor : '#0891B2'}
                    className="stroke-white dark:stroke-slate-900"
                    strokeWidth={isSelected ? 2 : 1}
                  />
                  {showLabel && (
                    <text
                      x={coord.x}
                      y={CHART_HEIGHT - 10}
                      textAnchor="middle"
                      className="fill-slate-500 font-mono text-[11px] dark:fill-slate-400"
                    >
                      {coord.point.hourLabel}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Footer summary row (clean unboxed metadata) */}
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
