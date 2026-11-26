import { Compass, Layers, Navigation } from 'lucide-react';
import type { AirQualityStation } from '../../types/airQuality';
import { getAqiTone } from '../../utils/airQuality';

interface MapControlsProps {
  stations: readonly AirQualityStation[];
  selectedStation: AirQualityStation;
  showRadius: boolean;
  locating: boolean;
  geoMessage: string | null;
  onToggleRadius: () => void;
  onLocateCurrent: () => void;
  onSelectStation: (stationId: string) => void;
  onOpenAssistant: () => void;
}

export function MapControls({
  stations,
  selectedStation,
  showRadius,
  locating,
  geoMessage,
  onToggleRadius,
  onLocateCurrent,
  onSelectStation,
  onOpenAssistant,
}: MapControlsProps) {
  const tone = getAqiTone(selectedStation.category.key);

  return (
    <aside className="flex flex-col gap-4 lg:col-span-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            OpenStreetMap Station Network
          </h1>
          <button
            type="button"
            onClick={onToggleRadius}
            aria-pressed={showRadius}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            {showRadius ? 'Hide Radius' : 'Show Radius'}
          </button>
        </div>

        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          Zero-API-key Leaflet map tiles with live AQI dispersion overlays.
        </p>

        <button
          type="button"
          disabled={locating}
          onClick={onLocateCurrent}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-700/40 bg-cyan-50 px-3 py-2 text-xs font-medium text-cyan-900 transition-colors hover:bg-cyan-100 disabled:opacity-60 dark:border-cyan-500/40 dark:bg-cyan-950/50 dark:text-cyan-200 dark:hover:bg-cyan-900/60"
        >
          <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
          {locating ? 'Detecting Current Location...' : 'Use My Current Location'}
        </button>

        {geoMessage && (
          <p role="status" className="mt-2 text-xs text-slate-600 dark:text-slate-300">
            {geoMessage}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {selectedStation.id === 'current-location'
                ? `${selectedStation.city} (My Location)`
                : selectedStation.city}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {selectedStation.district} <span aria-hidden="true">·</span> {selectedStation.country}
            </p>
          </div>
          <div className="text-right">
            <span className="font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {selectedStation.aqi}
            </span>
            <p className={`text-xs font-medium ${tone.textClass}`}>
              {tone.glyph} {selectedStation.category.shortLabel}
            </p>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-xs dark:border-slate-800">
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Coordinates</dt>
            <dd className="mt-0.5 font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {selectedStation.latitude.toFixed(3)}, {selectedStation.longitude.toFixed(3)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Dominant</dt>
            <dd className="mt-0.5 font-mono text-slate-900 dark:text-slate-100">
              {selectedStation.dominantPollutant}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">PM2.5 / PM10</dt>
            <dd className="mt-0.5 font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {selectedStation.metrics.pm25} / {selectedStation.metrics.pm10} µg/m³
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Wind &amp; Temp</dt>
            <dd className="mt-0.5 font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {selectedStation.windKph} km/h · {selectedStation.temperatureC}°C
            </dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={onOpenAssistant}
          className="mt-4 w-full rounded-lg bg-cyan-700 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-cyan-800"
        >
          Generate Health Brief for {selectedStation.city}
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <p className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
          <Compass className="h-3.5 w-3.5" aria-hidden="true" />
          Jump to Station
        </p>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {stations.map((st) => {
            const stTone = getAqiTone(st.category.key);
            const active = st.id === selectedStation.id;
            return (
              <li key={st.id}>
                <button
                  type="button"
                  onClick={() => onSelectStation(st.id)}
                  className={`flex w-full items-center justify-between py-2 text-left text-xs transition-colors ${
                    active
                      ? 'font-semibold text-cyan-800 dark:text-cyan-300'
                      : 'text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  <span className="truncate pr-2">
                    {st.id === 'current-location' ? `My Location · ${st.city}` : st.city} ·{' '}
                    <span className="text-slate-500 dark:text-slate-400">{st.district}</span>
                  </span>
                  <span className={`shrink-0 font-mono tabular-nums ${stTone.textClass}`}>
                    {st.aqi}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
