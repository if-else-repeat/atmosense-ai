import { AlertTriangle, MapPin, Scale } from 'lucide-react';
import { useState } from 'react';
import { getAQICategoryLabel } from '../../utils/formatters';

interface NeighborhoodZone {
  id: string;
  zoneCode: string;
  name: string;
  averageAqi: number;
  pm25: number;
  greenCanopyPct: number;
  industrialProximity: 'Low' | 'Moderate' | 'High';
  gridX: number;
  gridY: number;
}

const NEIGHBORHOOD_ZONES: NeighborhoodZone[] = [
  {
    id: 'zone-a',
    zoneCode: 'Zone A',
    name: 'North Parklands',
    averageAqi: 45,
    pm25: 10.8,
    greenCanopyPct: 42,
    industrialProximity: 'Low',
    gridX: 0,
    gridY: 0,
  },
  {
    id: 'zone-c',
    zoneCode: 'Zone C',
    name: 'West Riverfront',
    averageAqi: 78,
    pm25: 24.6,
    greenCanopyPct: 26,
    industrialProximity: 'Low',
    gridX: 1,
    gridY: 0,
  },
  {
    id: 'zone-d',
    zoneCode: 'Zone D',
    name: 'Central Transit Hub',
    averageAqi: 124,
    pm25: 44.8,
    greenCanopyPct: 14,
    industrialProximity: 'Moderate',
    gridX: 0,
    gridY: 1,
  },
  {
    id: 'zone-b',
    zoneCode: 'Zone B',
    name: 'East Freight & Industrial Belt',
    averageAqi: 180,
    pm25: 112.5,
    greenCanopyPct: 7,
    industrialProximity: 'High',
    gridX: 1,
    gridY: 1,
  },
];

function zoneFillColor(aqi: number): string {
  if (aqi <= 50) return '#059669';
  if (aqi <= 100) return '#D97706';
  if (aqi <= 150) return '#EA580C';
  return '#DC2626';
}

export function EnvironmentalJustice() {
  const [selectedZoneId, setSelectedZoneId] = useState<string>('zone-b');
  const selectedZone =
    NEIGHBORHOOD_ZONES.find((z) => z.id === selectedZoneId) ?? NEIGHBORHOOD_ZONES[0]!;

  const cleanest = NEIGHBORHOOD_ZONES.reduce((min, z) => (z.averageAqi < min.averageAqi ? z : min));
  const highest = NEIGHBORHOOD_ZONES.reduce((max, z) => (z.averageAqi > max.averageAqi ? z : max));
  const disparityRatio = (highest.averageAqi / Math.max(1, cleanest.averageAqi)).toFixed(1);

  return (
    <section
      aria-labelledby="ej-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
        <div>
          <h3
            id="ej-heading"
            className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            <Scale className="h-4 w-4 text-cyan-700 dark:text-cyan-400" aria-hidden="true" />
            Environmental Justice &amp; Neighborhood Disparity Heatmap
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Compares 30-day mean AQI exposure across adjacent urban micro-zones to surface air
            quality inequities.
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-200">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            {cleanest.zoneCode} averages {cleanest.averageAqi} AQI, {highest.zoneCode} averages{' '}
            {highest.averageAqi} AQI ({disparityRatio}× burden)
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-12">
        {/* Native SVG Neighborhood Comparison Heatmap */}
        <div className="lg:col-span-6">
          <svg
            viewBox="0 0 360 220"
            role="img"
            aria-label="Neighborhood AQI disparity heatmap comparing Zone A at 45 AQI, Zone C at 78 AQI, Zone D at 124 AQI, and Zone B at 180 AQI"
            className="h-auto w-full rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950"
          >
            {NEIGHBORHOOD_ZONES.map((zone) => {
              const x = 14 + zone.gridX * 170;
              const y = 14 + zone.gridY * 98;
              const isSelected = zone.id === selectedZone.id;
              return (
                <g
                  key={zone.id}
                  onClick={() => setSelectedZoneId(zone.id)}
                  className="cursor-pointer"
                >
                  <rect
                    x={x}
                    y={y}
                    width={160}
                    height={88}
                    rx={10}
                    fill={zoneFillColor(zone.averageAqi)}
                    fillOpacity={isSelected ? 0.92 : 0.72}
                    stroke={isSelected ? '#0F172A' : '#FFFFFF'}
                    strokeWidth={isSelected ? 3 : 1.5}
                  />
                  <text x={x + 14} y={y + 24} fill="#FFFFFF" fontSize="12" fontWeight="700">
                    {zone.zoneCode}
                  </text>
                  <text x={x + 14} y={y + 42} fill="#F8FAFC" fontSize="10">
                    {zone.name.slice(0, 22)}
                  </text>
                  <text x={x + 14} y={y + 72} fill="#FFFFFF" fontSize="20" fontWeight="700">
                    {zone.averageAqi} AQI
                  </text>
                </g>
              );
            })}
          </svg>
          <p className="sr-only">
            Disparity summary: Zone A (North Parklands) averages 45 AQI (Good), while Zone B (East
            Freight &amp; Industrial Belt) averages 180 AQI (Unhealthy), a {disparityRatio} times
            higher particulate exposure burden.
          </p>
        </div>

        {/* Interactive Zone Selector & Disparity Breakdown */}
        <div className="space-y-3 lg:col-span-6">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Select neighborhood zone">
            {NEIGHBORHOOD_ZONES.map((zone) => {
              const active = zone.id === selectedZone.id;
              return (
                <button
                  key={zone.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedZoneId(zone.id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? 'border-cyan-700 bg-cyan-50 text-cyan-900 dark:border-cyan-500 dark:bg-cyan-950/60 dark:text-cyan-200'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {zone.zoneCode} ({zone.averageAqi})
                </button>
              );
            })}
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <MapPin className="h-4 w-4 text-cyan-700 dark:text-cyan-400" aria-hidden="true" />
                {selectedZone.zoneCode} — {selectedZone.name}
              </p>
              <span className="font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {selectedZone.averageAqi} AQI ({getAQICategoryLabel(selectedZone.averageAqi)})
              </span>
            </div>

            <dl className="mt-3 grid grid-cols-3 gap-3 text-xs">
              <div className="rounded-md border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">
                <dt className="text-slate-500 dark:text-slate-400">Mean PM2.5</dt>
                <dd className="mt-1 font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {selectedZone.pm25} µg/m³
                </dd>
              </div>
              <div className="rounded-md border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">
                <dt className="text-slate-500 dark:text-slate-400">Tree Canopy</dt>
                <dd className="mt-1 font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {selectedZone.greenCanopyPct}%
                </dd>
              </div>
              <div className="rounded-md border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">
                <dt className="text-slate-500 dark:text-slate-400">Freight Corridor</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {selectedZone.industrialProximity}
                </dd>
              </div>
            </dl>

            <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Advocacy priority: Share verified micro-zone averages with municipal air boards to
              prioritize urban tree corridors, diesel retrofits, and school HEPA filtration in
              higher-burden districts.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
