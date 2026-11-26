import { getAQIStatusPresentation } from '../../utils/dashboardAqi';
import { CHART_HEIGHT, CHART_PAD, CHART_WIDTH, type ForecastGeometry } from './forecastGeometry';

export interface ForecastSvgPlotProps {
  geometry: ForecastGeometry;
  gradientId: string;
  locationName: string;
  boundedIndex: number;
  onSelectIndex: (index: number) => void;
}

export function ForecastSvgPlot({
  geometry,
  gradientId,
  locationName,
  boundedIndex,
  onSelectIndex,
}: ForecastSvgPlotProps) {
  const plotH = CHART_HEIGHT - CHART_PAD.top - CHART_PAD.bottom;
  const plotW = CHART_WIDTH - CHART_PAD.left - CHART_PAD.right;
  const activeCoord = geometry.coords[boundedIndex];

  return (
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

      {geometry.coords.map((coord, idx) => {
        if (!coord.isSafeWindow) return null;
        const stepW = geometry.coords.length > 1 ? plotW / (geometry.coords.length - 1) : 24;
        return (
          <rect
            key={`conv-${idx}`}
            x={Math.max(CHART_PAD.left, coord.x - stepW / 2)}
            y={CHART_PAD.top}
            width={stepW}
            height={plotH}
            className="fill-emerald-500/8 dark:fill-emerald-400/10"
          />
        );
      })}

      {geometry.yTicks.map((tick) => {
        const y = CHART_PAD.top + plotH - (tick / geometry.maxY) * plotH;
        return (
          <g key={tick}>
            <line
              x1={CHART_PAD.left}
              y1={y}
              x2={CHART_WIDTH - CHART_PAD.right}
              y2={y}
              className="stroke-slate-200 dark:stroke-slate-800"
              strokeWidth="1"
              strokeDasharray={tick === 0 ? undefined : '3 3'}
            />
            <text
              x={CHART_PAD.left - 10}
              y={y + 4}
              textAnchor="end"
              className="fill-slate-500 font-mono text-[11px] dark:fill-slate-400"
            >
              {tick}
            </text>
          </g>
        );
      })}

      {geometry.maxY >= 100 && (
        <line
          x1={CHART_PAD.left}
          y1={CHART_PAD.top + plotH * (1 - 100 / geometry.maxY)}
          x2={CHART_WIDTH - CHART_PAD.right}
          y2={CHART_PAD.top + plotH * (1 - 100 / geometry.maxY)}
          stroke="#D97706"
          strokeOpacity="0.45"
          strokeWidth="1"
          strokeDasharray="5 4"
        />
      )}

      <path d={geometry.areaPath} fill={`url(#${gradientId})`} />
      <path
        d={geometry.linePath}
        fill="none"
        stroke="#0891B2"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {activeCoord && (
        <line
          x1={activeCoord.x}
          y1={CHART_PAD.top}
          x2={activeCoord.x}
          y2={CHART_HEIGHT - CHART_PAD.bottom}
          className="stroke-cyan-700/40 dark:stroke-cyan-400/50"
          strokeWidth="1.25"
          strokeDasharray="3 3"
        />
      )}

      {geometry.coords.map((coord, idx) => {
        const isSelected = idx === boundedIndex;
        const status = getAQIStatusPresentation(coord.point.aqi);
        const showLabel = idx % 3 === 0 || idx === geometry.coords.length - 1;
        return (
          <g key={`${coord.point.hourLabel}-${idx}`}>
            <rect
              x={coord.x - 14}
              y={CHART_PAD.top}
              width={28}
              height={plotH}
              fill="transparent"
              className="cursor-crosshair"
              onMouseEnter={() => onSelectIndex(idx)}
              onClick={() => onSelectIndex(idx)}
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
  );
}
