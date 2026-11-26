import { LocateFixed, MapPin, WifiOff } from 'lucide-react';
import type { AirQualityStation } from '../types/airQuality';

export interface LocationSubBarProps {
  stations: AirQualityStation[];
  selectedStation: AirQualityStation;
  onSelectStation: (stationId: string) => void;
  onDetectLocation: () => void;
  locating: boolean;
  isOnline: boolean;
  locationStatus: string | null;
}

export function LocationSubBar({
  stations,
  selectedStation,
  onSelectStation,
  onDetectLocation,
  locating,
  isOnline,
  locationStatus,
}: LocationSubBarProps) {
  return (
    <div className="border-b border-slate-200/80 bg-white/75 dark:border-slate-800/80 dark:bg-slate-900/60">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2.5 px-4 py-2 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-500 dark:text-slate-400">
            <MapPin className="h-3.5 w-3.5 text-cyan-700 dark:text-cyan-400" aria-hidden="true" />
            <label htmlFor="global-station-select">Location</label>
          </span>

          <select
            id="global-station-select"
            value={selectedStation.id}
            onChange={(e) => onSelectStation(e.target.value)}
            className="min-w-0 max-w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 focus:border-cyan-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {stations.map((st) => (
              <option key={st.id} value={st.id}>
                {st.id === 'current-location'
                  ? `My Location — ${st.city}, ${st.country} (AQI ${st.aqi})`
                  : `${st.city} — ${st.district} (AQI ${st.aqi})`}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={locating || !isOnline}
            onClick={onDetectLocation}
            aria-label="Update my current location"
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-cyan-700/35 bg-cyan-50 px-2.5 py-1.5 text-xs font-medium text-cyan-900 transition-colors hover:bg-cyan-100 disabled:opacity-50 dark:border-cyan-500/35 dark:bg-cyan-950/60 dark:text-cyan-200 dark:hover:bg-cyan-900/60"
          >
            <LocateFixed
              className={`h-3.5 w-3.5 ${locating ? 'animate-pulse' : ''}`}
              aria-hidden="true"
            />
            {locating ? 'Locating...' : 'My Location'}
          </button>
        </div>

        <div
          className="hidden shrink-0 items-center gap-2 text-xs text-slate-500 md:flex dark:text-slate-400"
          aria-live="polite"
        >
          {!isOnline ? (
            <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
              <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
              Offline · Browser cached
            </span>
          ) : (
            <span>
              {locationStatus ??
                (selectedStation.source === 'live-open-meteo'
                  ? 'Open-Meteo live feed'
                  : 'Calibrated urban baseline')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
