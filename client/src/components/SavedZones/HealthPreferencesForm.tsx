import { HardDrive } from 'lucide-react';
import type { FormEvent } from 'react';
import type { SensitivityProfile } from '../../types/airQuality';

export interface HealthPreferencesFormProps {
  displayName: string;
  sensitivity: SensitivityProfile;
  threshold: number;
  preferredUnit: 'aqi' | 'pm25';
  busy: boolean;
  statusMessage: string | null;
  onChangeDisplayName: (value: string) => void;
  onChangeSensitivity: (value: SensitivityProfile) => void;
  onChangeThreshold: (value: number) => void;
  onChangePreferredUnit: (value: 'aqi' | 'pm25') => void;
  onSubmit: (e: FormEvent) => void;
}

export function HealthPreferencesForm({
  displayName,
  sensitivity,
  threshold,
  preferredUnit,
  busy,
  statusMessage,
  onChangeDisplayName,
  onChangeSensitivity,
  onChangeThreshold,
  onChangePreferredUnit,
  onSubmit,
}: HealthPreferencesFormProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 lg:col-span-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Health Profile &amp; Thresholds
          </h1>
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <HardDrive
              className="h-3.5 w-3.5 text-cyan-700 dark:text-cyan-400"
              aria-hidden="true"
            />
            Stored locally on this device · No account required
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div>
          <label
            htmlFor="profile-display-name"
            className="block text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            Profile Name
          </label>
          <input
            id="profile-display-name"
            type="text"
            required
            maxLength={80}
            value={displayName}
            onChange={(e) => onChangeDisplayName(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        <div>
          <label
            htmlFor="profile-sensitivity"
            className="block text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            Default Sensitivity Tier
          </label>
          <select
            id="profile-sensitivity"
            value={sensitivity}
            onChange={(e) => onChangeSensitivity(e.target.value as SensitivityProfile)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="general">General Public</option>
            <option value="respiratory">Asthma / Respiratory Sensitive</option>
            <option value="athlete">Outdoor Runner / Endurance Athlete</option>
            <option value="vulnerable">Children &amp; Older Adults</option>
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label
              htmlFor="profile-threshold"
              className="text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              AQI Alert Threshold
            </label>
            <span className="font-mono text-xs font-semibold tabular-nums text-cyan-700 dark:text-cyan-400">
              {threshold} AQI
            </span>
          </div>
          <input
            id="profile-threshold"
            type="range"
            min={25}
            max={300}
            step={5}
            value={threshold}
            onChange={(e) => onChangeThreshold(Number(e.target.value))}
            className="mt-2 w-full accent-cyan-700"
          />
        </div>

        <div>
          <span className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            Primary Metric Display
          </span>
          <div className="mt-1.5 inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {(['aqi', 'pm25'] as const).map((unit) => (
              <button
                key={unit}
                type="button"
                onClick={() => onChangePreferredUnit(unit)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  preferredUnit === unit
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {unit === 'aqi' ? 'US EPA AQI' : 'PM2.5 (µg/m³)'}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-cyan-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-800 disabled:opacity-60"
        >
          Save Preferences
        </button>

        {statusMessage && (
          <p role="status" className="text-xs text-emerald-700 dark:text-emerald-300">
            {statusMessage}
          </p>
        )}
      </form>
    </section>
  );
}
