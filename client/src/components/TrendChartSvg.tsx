import { useId, useState } from 'react';
import type { HourlyPoint, PollutantKey } from '../types/airQuality';
import { getPollutantMeta } from '../utils/airQuality';

interface TrendChartSvgProps {
  hourly: readonly HourlyPoint[];
  city: string;
}

const METRIC_TABS: ReadonlyArray<{ key: PollutantKey; label: string }> = [
  { key: 'aqi', label: 'AQI' },
  { key: 'pm25', label: 'PM2.5' },
  { key: 'pm10', label: 'PM10' },
  { key: 'no2', label: 'NO₂' },
  { key: 'o3', label: 'O₃' },
];

export function TrendChartSvg({ hourly, city }: TrendChartSvgProps) {
  const [selectedMetric, setSelectedMetric] = useState<PollutantKey>('aqi');
  const [activeIndex, setActiveIndex] = useState<number>(() => Math.max(0, hourly.length - 1));
  const gradientId = useId();

  const meta = getPollutantMeta(selectedMetric);
  const values = hourly.map((pt) => pt[selectedMetric]);
  const rawMax = Math.max(...values, meta.whoLimit * 1.15, 10);
  const yMax = Math.ceil(rawMax / 10) * 10;

  const width = 680;
  const height = 248;
  const pad = { top: 20, right: 18, bottom: 32, left: 42 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const xAt = (idx: number): number => {
    if (hourly.length <= 1) return pad.left;
    return pad.left + (idx / (hourly.length - 1)) * plotW;
  };

  const yAt = (val: number): number => {
    const ratio = Math.min(1, Math.max(0, val / yMax));
    return pad.top + plotH - ratio * plotH;
  };

  const linePoints = hourly
    .map((pt, idx) => `${xAt(idx).toFixed(1)},${yAt(pt[selectedMetric]).toFixed(1)}`)
    .join(' ');

  const firstX = xAt(0).toFixed(1);
  const lastX = xAt(Math.max(0, hourly.length - 1)).toFixed(1);
  const baselineY = (pad.top + plotH).toFixed(1);
  const areaPath =
    hourly.length > 0
      ? `M ${firstX},${baselineY} L ${linePoints.replaceAll(' ', ' L ')} L ${lastX},${baselineY} Z`
      : '';

  const safeIdx = Math.min(activeIndex, Math.max(0, hourly.length - 1));
  const activePoint = hourly[safeIdx];
  const activeVal = activePoint ? activePoint[selectedMetric] : 0;
  const activeX = xAt(safeIdx);
  const activeY = yAt(activeVal);

  const whoY = yAt(meta.whoLimit);
  const yTicks = [0, Math.round(yMax * 0.33), Math.round(yMax * 0.66), yMax];

  return (
    <section
      aria-label={`${city} 24-hour pollutant trend chart`}
      className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            24-Hour Dispersion Trend
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {city} <span aria-hidden="true">·</span> {meta.whoLabel}
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Pollutant trend series"
          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800"
        >
          {METRIC_TABS.map((tab) => {
            const isActive = tab.key === selectedMetric;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setSelectedMetric(tab.key)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Live snapped reading readout */}
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
        <div className="flex items-baseline gap-2">
          <span
            data-testid="trend-active-value"
            className="font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100"
          >
            {activeVal}
          </span>
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{meta.unit}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            at {activePoint?.hourLabel ?? '--:--'} UTC
          </span>
        </div>
        <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
          Peak {Math.max(...values)} {meta.unit} / Low {Math.min(...values)} {meta.unit}
        </span>
      </div>

      <div className="mt-4 w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`24-hour ${meta.label} trend line for ${city}`}
          className="h-60 w-full min-w-[460px] select-none"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0891b2" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#0891b2" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Horizontal Gridlines & Y-Axis Labels */}
          {yTicks.map((tick) => {
            const y = yAt(tick);
            return (
              <g key={tick}>
                <line
                  x1={pad.left}
                  y1={y}
                  x2={width - pad.right}
                  y2={y}
                  className="stroke-slate-200 dark:stroke-slate-800"
                  strokeWidth="1"
                />
                <text
                  x={pad.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-400 font-mono text-[10px] dark:fill-slate-500"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* WHO / EPA Reference Ceiling */}
          <line
            x1={pad.left}
            y1={whoY}
            x2={width - pad.right}
            y2={whoY}
            stroke="#d97706"
            strokeWidth="1.25"
            strokeDasharray="4 4"
            opacity="0.85"
          />
          <text
            x={width - pad.right - 2}
            y={Math.max(pad.top + 10, whoY - 5)}
            textAnchor="end"
            className="fill-amber-700 font-mono text-[10px] dark:fill-amber-400"
          >
            Guideline {meta.whoLimit}
          </text>

          {/* Area & Telemetry Curve */}
          {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
          {linePoints && (
            <polyline
              fill="none"
              stroke="#0891b2"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={linePoints}
            />
          )}

          {/* Active Crosshair */}
          {activePoint && (
            <g>
              <line
                x1={activeX}
                y1={pad.top}
                x2={activeX}
                y2={pad.top + plotH}
                stroke="#0891b2"
                strokeWidth="1"
                strokeDasharray="3 3"
                opacity="0.65"
              />
              <circle
                cx={activeX}
                cy={activeY}
                r="5"
                fill="#0891b2"
                stroke="#ffffff"
                strokeWidth="2"
              />
            </g>
          )}

          {/* X-Axis Hour Labels (every 4 hours) */}
          {hourly.map((pt, idx) => {
            if (idx % 4 !== 0 && idx !== hourly.length - 1) return null;
            return (
              <text
                key={pt.isoTime}
                x={xAt(idx)}
                y={height - 8}
                textAnchor="middle"
                className="fill-slate-400 font-mono text-[10px] dark:fill-slate-500"
              >
                {pt.hourLabel}
              </text>
            );
          })}

          {/* Interactive Hit Targets */}
          {hourly.map((pt, idx) => {
            const bandWidth = plotW / Math.max(1, hourly.length - 1);
            return (
              <rect
                key={`hit-${pt.isoTime}`}
                x={Math.max(pad.left, xAt(idx) - bandWidth / 2)}
                y={pad.top}
                width={bandWidth}
                height={plotH}
                fill="transparent"
                className="cursor-crosshair"
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => setActiveIndex(idx)}
              />
            );
          })}
        </svg>
      </div>
    </section>
  );
}
