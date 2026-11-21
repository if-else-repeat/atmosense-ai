import type { PollutantMetrics } from '../types/airQuality';
import { buildRadarProfile } from '../utils/airQuality';

interface PollutantRadarSvgProps {
  metrics: PollutantMetrics;
  city: string;
}

export function PollutantRadarSvg({ metrics, city }: PollutantRadarSvgProps) {
  const axes = buildRadarProfile(metrics);
  const size = 250;
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = 82;
  const levels = [0.25, 0.5, 0.75, 1];

  const pointFor = (index: number, factor: number): { x: number; y: number } => {
    const angle = (Math.PI * 2 * index) / axes.length - Math.PI / 2;
    return {
      x: cx + Math.cos(angle) * maxRadius * factor,
      y: cy + Math.sin(angle) * maxRadius * factor,
    };
  };

  const dataPolygon = axes
    .map((axis, idx) => {
      const pt = pointFor(idx, Math.max(0.08, axis.normalized));
      return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <section
      aria-label={`${city} multi-pollutant radar calibration profile`}
      className="flex h-full flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Pollutant Burden Profile
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Normalized against EPA/WHO reference limits
        </p>
      </div>

      <div className="my-3 flex justify-center">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`Six-axis pollutant radar chart for ${city}`}
          className="h-56 w-56"
        >
          {/* Concentric Reference Polygons */}
          {levels.map((lvl) => {
            const pts = axes
              .map((_, idx) => {
                const pt = pointFor(idx, lvl);
                return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
              })
              .join(' ');
            return (
              <polygon
                key={lvl}
                points={pts}
                fill="none"
                className="stroke-slate-200 dark:stroke-slate-800"
                strokeWidth="1"
              />
            );
          })}

          {/* Radial Spokes & Vertex Labels */}
          {axes.map((axis, idx) => {
            const edge = pointFor(idx, 1);
            const labelPos = pointFor(idx, 1.24);
            return (
              <g key={axis.key}>
                <line
                  x1={cx}
                  y1={cy}
                  x2={edge.x}
                  y2={edge.y}
                  className="stroke-slate-200 dark:stroke-slate-800"
                  strokeWidth="1"
                />
                <text
                  x={labelPos.x}
                  y={labelPos.y + 3}
                  textAnchor="middle"
                  className="fill-slate-600 font-mono text-[10px] font-medium dark:fill-slate-300"
                >
                  {axis.label}
                </text>
              </g>
            );
          })}

          {/* Active Data Polygon */}
          <polygon
            points={dataPolygon}
            fill="#0891b2"
            fillOpacity="0.18"
            stroke="#0891b2"
            strokeWidth="2"
          />

          {/* Data Vertices */}
          {axes.map((axis, idx) => {
            const pt = pointFor(idx, Math.max(0.08, axis.normalized));
            return (
              <circle
                key={`dot-${axis.key}`}
                cx={pt.x}
                cy={pt.y}
                r="3.2"
                fill="#0e7490"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
            );
          })}
        </svg>
      </div>

      <dl className="grid grid-cols-3 gap-x-4 gap-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        {axes.map((axis) => (
          <div key={axis.key} className="flex flex-col">
            <dt className="text-[11px] text-slate-500 dark:text-slate-400">{axis.label}</dt>
            <dd className="font-mono text-xs font-medium tabular-nums text-slate-900 dark:text-slate-100">
              {axis.rawValue} <span className="text-[10px] text-slate-400">{axis.unit}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
