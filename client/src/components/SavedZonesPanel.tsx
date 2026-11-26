import { BookmarkPlus, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useWorkspace } from '../context/AuthContext';
import type { AirQualityStation, SensitivityProfile } from '../types/airQuality';
import { getAqiTone } from '../utils/airQuality';
import { HealthPreferencesForm } from './SavedZones/HealthPreferencesForm';
import { SavedBriefsSection } from './SavedZones/SavedBriefsSection';

interface SavedZonesPanelProps {
  stations: readonly AirQualityStation[];
  selectedStation: AirQualityStation;
  onSelectStation: (stationId: string) => void;
  onSyncSensitivity: (profile: SensitivityProfile) => void;
}

export function SavedZonesPanel({
  stations,
  selectedStation,
  onSelectStation,
  onSyncSensitivity,
}: SavedZonesPanelProps) {
  const {
    profile,
    savedLocations,
    savedAdvisories,
    updatePreferences,
    saveStation,
    removeSavedStation,
    removeAdvisory,
  } = useWorkspace();

  const [displayName, setDisplayName] = useState(profile.displayName);
  const [sensitivity, setSensitivity] = useState<SensitivityProfile>(profile.sensitivityProfile);
  const [threshold, setThreshold] = useState<number>(profile.aqiAlertThreshold);
  const [preferredUnit, setPreferredUnit] = useState<'aqi' | 'pm25'>(profile.preferredUnit);
  const [customLabel, setCustomLabel] = useState('Daily Commute');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDisplayName(profile.displayName);
    setSensitivity(profile.sensitivityProfile);
    setThreshold(profile.aqiAlertThreshold);
    setPreferredUnit(profile.preferredUnit);
  }, [profile]);

  const handleSavePreferences = async (e: FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setStatusMessage('Profile label cannot be empty.');
      return;
    }
    setBusy(true);
    setStatusMessage(null);
    try {
      await updatePreferences({
        displayName: displayName.trim(),
        sensitivityProfile: sensitivity,
        aqiAlertThreshold: threshold,
        preferredUnit,
      });
      onSyncSensitivity(sensitivity);
      setStatusMessage('Preferences saved in this browser.');
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Unable to save preferences.');
    } finally {
      setBusy(false);
    }
  };

  const handleBookmarkSelected = async () => {
    setBusy(true);
    setStatusMessage(null);
    try {
      await saveStation(selectedStation, customLabel.trim(), threshold);
      setStatusMessage(
        `Saved ${selectedStation.city} (${selectedStation.district}) locally in this browser.`,
      );
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Unable to save monitoring zone.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <HealthPreferencesForm
        displayName={displayName}
        sensitivity={sensitivity}
        threshold={threshold}
        preferredUnit={preferredUnit}
        busy={busy}
        statusMessage={statusMessage}
        onChangeDisplayName={setDisplayName}
        onChangeSensitivity={setSensitivity}
        onChangeThreshold={setThreshold}
        onChangePreferredUnit={setPreferredUnit}
        onSubmit={(e) => void handleSavePreferences(e)}
      />

      <div className="space-y-6 lg:col-span-7">
        <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Saved Urban Monitoring Zones
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Active station: {selectedStation.city} ({selectedStation.district})
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <label htmlFor="custom-zone-label" className="sr-only">
              Custom label for saved station
            </label>
            <input
              id="custom-zone-label"
              type="text"
              maxLength={60}
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="Label (e.g., Home, Running Route)"
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleBookmarkSelected()}
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 dark:bg-cyan-700 dark:hover:bg-cyan-600"
            >
              <BookmarkPlus className="h-3.5 w-3.5" aria-hidden="true" />
              Save {selectedStation.city}
            </button>
          </div>

          {savedLocations.length === 0 ? (
            <p className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              No saved zones yet. Save your active station above to monitor threshold alerts here.
            </p>
          ) : (
            <ul className="mt-5 divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800">
              {savedLocations.map((loc) => {
                const live = stations.find((s) => s.id === loc.stationId);
                const liveAqi = live?.aqi ?? 0;
                const exceeds = live ? liveAqi >= loc.alertThreshold : false;
                const tone = live ? getAqiTone(live.category.key) : null;
                return (
                  <li key={loc.id} className="flex items-center justify-between gap-4 py-3.5">
                    <button
                      type="button"
                      onClick={() => onSelectStation(loc.stationId)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="text-sm font-medium text-slate-900 hover:text-cyan-700 dark:text-slate-100 dark:hover:text-cyan-300">
                        {loc.cityName}
                        {loc.customLabel ? (
                          <span className="font-normal text-slate-500 dark:text-slate-400">
                            {' '}
                            · {loc.customLabel}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {loc.district} · Threshold{' '}
                        <span className="font-mono tabular-nums">{loc.alertThreshold}</span> AQI
                        {exceeds ? (
                          <span className="ml-2 font-medium text-rose-600 dark:text-rose-400">
                            · Threshold exceeded
                          </span>
                        ) : null}
                      </div>
                    </button>

                    <div className="flex shrink-0 items-center gap-3">
                      {live && tone && (
                        <span
                          className={`font-mono text-sm font-semibold tabular-nums ${tone.textClass}`}
                        >
                          {live.aqi} AQI
                        </span>
                      )}
                      <button
                        type="button"
                        aria-label={`Remove ${loc.cityName} from saved zones`}
                        onClick={() => void removeSavedStation(loc.id)}
                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <SavedBriefsSection
          savedAdvisories={savedAdvisories}
          onRemoveAdvisory={(id) => void removeAdvisory(id)}
        />
      </div>
    </div>
  );
}
