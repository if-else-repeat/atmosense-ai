import { LocateFixed, MapPin, WifiOff } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AQIDashboard } from './components/Dashboard/AQIDashboard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineIndicator } from './components/OfflineIndicator';
import { TopBar } from './components/TopBar';
import { WorkspaceProvider, useWorkspace } from './context/AuthContext';
import type { PersonaProfile } from './types/aqi';
import type { ActiveTab, AirQualityStation, SensitivityProfile } from './types/airQuality';
import { OFFLINE_FALLBACK_STATIONS } from './utils/airQuality';

const THEME_STORAGE_KEY = 'atmosense-theme-v1';
const CURRENT_LOCATION_STORAGE_KEY = 'atmosense-current-location-v1';
const STATIONS_CACHE_KEY = 'atmosense-stations-cache-v1';

interface CachedCurrentLocation {
  station: AirQualityStation;
  method: 'gps' | 'ip';
  savedAt: string;
}

const AirQualityMap = lazy(() =>
  import('./components/AirQualityMap').then((mod) => ({ default: mod.AirQualityMap })),
);
const CommunityHub = lazy(() =>
  import('./components/Community/CommunityHub').then((mod) => ({ default: mod.CommunityHub })),
);
const FamilyManager = lazy(() =>
  import('./components/Family/FamilyManager').then((mod) => ({ default: mod.FamilyManager })),
);
const HealthAssistantPanel = lazy(() =>
  import('./components/HealthAssistantPanel').then((mod) => ({
    default: mod.HealthAssistantPanel,
  })),
);
const SavedZonesPanel = lazy(() =>
  import('./components/SavedZonesPanel').then((mod) => ({ default: mod.SavedZonesPanel })),
);

function TabLoadingFallback() {
  return (
    <div
      role="status"
      aria-label="Loading workspace view"
      className="flex min-h-[280px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
    >
      Loading view…
    </div>
  );
}

function sensitivityToPersona(profile: SensitivityProfile): PersonaProfile {
  if (profile === 'respiratory') return 'asthmatics';
  if (profile === 'vulnerable') return 'elderly';
  return 'general';
}

function personaToSensitivity(persona: PersonaProfile): SensitivityProfile {
  if (persona === 'asthmatics') return 'respiratory';
  if (persona === 'elderly' || persona === 'children') return 'vulnerable';
  return 'general';
}

function readCachedCurrentLocation(): CachedCurrentLocation | null {
  try {
    const raw = window.localStorage.getItem(CURRENT_LOCATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedCurrentLocation>;
    if (
      parsed.station &&
      typeof parsed.station.latitude === 'number' &&
      typeof parsed.station.longitude === 'number' &&
      typeof parsed.station.city === 'string'
    ) {
      return {
        station: { ...parsed.station, id: 'current-location' },
        method: parsed.method === 'gps' ? 'gps' : 'ip',
        savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

function writeCachedCurrentLocation(entry: CachedCurrentLocation): void {
  try {
    window.localStorage.setItem(CURRENT_LOCATION_STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // Ignore storage quota errors
  }
}

function readCachedStations(): AirQualityStation[] | null {
  try {
    const raw = window.localStorage.getItem(STATIONS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AirQualityStation[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.filter((st) => st && typeof st.id === 'string' && typeof st.aqi === 'number');
    }
    return null;
  } catch {
    return null;
  }
}

function writeCachedStations(stations: AirQualityStation[]): void {
  try {
    window.localStorage.setItem(STATIONS_CACHE_KEY, JSON.stringify(stations));
  } catch {
    // Ignore storage quota errors
  }
}

function readInitialTheme(): boolean {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark';
  } catch {
    return false;
  }
}

function mergeStationsWithCurrent(
  baseStations: AirQualityStation[],
  current: AirQualityStation | null,
): AirQualityStation[] {
  const withoutCurrent = baseStations.filter((st) => st.id !== 'current-location');
  return current ? [{ ...current, id: 'current-location' }, ...withoutCurrent] : withoutCurrent;
}

function getBrowserCoordinates(timeoutMs = 7000): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Browser geolocation unavailable'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (err) => reject(err),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 300_000 },
    );
  });
}

function WorkspaceShell() {
  const { profile, savedLocations } = useWorkspace();

  const initialSavedLocRef = useRef<CachedCurrentLocation | null | undefined>(undefined);
  if (initialSavedLocRef.current === undefined) {
    initialSavedLocRef.current = readCachedCurrentLocation();
  }
  const initialSavedLoc = initialSavedLocRef.current;

  const [activeTab, setActiveTab] = useState<ActiveTab>('monitor');
  const [stations, setStations] = useState<AirQualityStation[]>(() => {
    const cachedList = readCachedStations() ?? OFFLINE_FALLBACK_STATIONS;
    return mergeStationsWithCurrent(cachedList, initialSavedLoc?.station ?? null);
  });
  const [selectedStationId, setSelectedStationId] = useState<string>(() =>
    initialSavedLoc ? 'current-location' : OFFLINE_FALLBACK_STATIONS[0]!.id,
  );
  const [loadingStations, setLoadingStations] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [locating, setLocating] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [locationStatus, setLocationStatus] = useState<string | null>(() =>
    initialSavedLoc
      ? `Saved location · ${initialSavedLoc.station.city}, ${initialSavedLoc.station.country}`
      : null,
  );
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [sensitivityProfile, setSensitivityProfile] = useState<SensitivityProfile>(
    () => profile?.sensitivityProfile ?? 'general',
  );
  const [isDark, setIsDark] = useState<boolean>(readInitialTheme);

  const currentLocationRef = useRef<CachedCurrentLocation | null>(initialSavedLoc);

  useEffect(() => {
    if (profile?.sensitivityProfile) {
      setSensitivityProfile(profile.sensitivityProfile);
    }
  }, [profile?.sensitivityProfile]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
    } catch {
      // Ignore storage errors
    }
  }, [isDark]);

  const upsertCurrentLocationStation = useCallback(
    (
      station: AirQualityStation,
      method: 'gps' | 'ip',
      options: { select?: boolean; statusText?: string } = {},
    ) => {
      const { select = true, statusText } = options;
      const normalized: AirQualityStation = { ...station, id: 'current-location' };
      const cachedEntry: CachedCurrentLocation = {
        station: normalized,
        method,
        savedAt: new Date().toISOString(),
      };
      currentLocationRef.current = cachedEntry;
      writeCachedCurrentLocation(cachedEntry);

      setStations((prev) => {
        const merged = mergeStationsWithCurrent(prev, normalized);
        writeCachedStations(merged);
        return merged;
      });
      if (select) {
        setSelectedStationId('current-location');
      }
      if (statusText) {
        setLocationStatus(statusText);
      }
    },
    [],
  );

  const refreshSavedCurrentLocation = useCallback(
    async (forceRefresh = false): Promise<boolean> => {
      const saved = currentLocationRef.current;
      if (!saved || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        return false;
      }

      try {
        const refreshQuery = forceRefresh ? '&refresh=1' : '';
        const res = await fetch(
          `/api/air-quality/by-coords?lat=${encodeURIComponent(saved.station.latitude)}&lng=${encodeURIComponent(saved.station.longitude)}&stationId=current-location${refreshQuery}`,
        );
        if (!res.ok) return false;

        const payload = (await res.json()) as { station?: AirQualityStation };
        if (payload.station) {
          upsertCurrentLocationStation(payload.station, saved.method, {
            select: false,
            statusText: `Saved location · ${payload.station.city}, ${payload.station.country}`,
          });
          return true;
        }
      } catch {
        // Keep browser-cached snapshot intact when offline or unreachable
      }
      return false;
    },
    [upsertCurrentLocationStation],
  );

  const detectCurrentLocation = useCallback(
    async (options: { userInitiated?: boolean; forceRefresh?: boolean } = {}) => {
      const { userInitiated = false, forceRefresh = false } = options;
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (userInitiated) {
          setLocationStatus('Offline · Connect to the internet to update your location');
        }
        return;
      }

      setLocating(true);
      setLocationStatus('Detecting your location...');

      const refreshQuery = forceRefresh ? '&refresh=1' : '';

      // 1. Browser GPS -> live hyperlocal Open-Meteo AQI + weather + reverse geocode
      try {
        const coords = await getBrowserCoordinates(userInitiated ? 9000 : 5500);
        const res = await fetch(
          `/api/air-quality/by-coords?lat=${encodeURIComponent(coords.latitude)}&lng=${encodeURIComponent(coords.longitude)}&stationId=current-location${refreshQuery}`,
        );
        if (res.ok) {
          const payload = (await res.json()) as { station?: AirQualityStation };
          if (payload.station) {
            upsertCurrentLocationStation(payload.station, 'gps', {
              select: true,
              statusText: `Saved GPS · ${payload.station.city}, ${payload.station.country}`,
            });
            setLocating(false);
            return;
          }
        }
      } catch {
        // GPS denied, blocked by iframe permissions, or timed out — try server IP geolocation
      }

      // 2. Fallback: Server-side IP geolocation -> live Open-Meteo AQI + weather
      try {
        const res = await fetch(
          `/api/air-quality/detect-location${forceRefresh ? '?refresh=1' : ''}`,
        );
        if (res.ok) {
          const payload = (await res.json()) as {
            detected?: boolean;
            station?: AirQualityStation | null;
          };
          if (payload.detected && payload.station) {
            upsertCurrentLocationStation(payload.station, 'ip', {
              select: true,
              statusText: `Saved location · ${payload.station.city}, ${payload.station.country}`,
            });
            setLocating(false);
            return;
          }
        }
      } catch {
        // Network error during IP detection
      }

      setLocationStatus(
        userInitiated
          ? 'Could not detect location — allow browser location access or pick a city.'
          : currentLocationRef.current
            ? `Saved location · ${currentLocationRef.current.station.city}, ${currentLocationRef.current.station.country}`
            : null,
      );
      setLocating(false);
    },
    [upsertCurrentLocationStation],
  );

  const loadStations = useCallback(
    async (forceRefresh = false) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setFetchError(null);
        return;
      }

      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoadingStations(true);
      }
      setFetchError(null);

      try {
        const response = await fetch(`/api/air-quality${forceRefresh ? '?refresh=1' : ''}`);
        if (!response.ok) {
          throw new Error(`Telemetry API returned ${response.status}`);
        }
        const data = (await response.json()) as { stations?: AirQualityStation[] };
        if (Array.isArray(data.stations) && data.stations.length > 0) {
          if (currentLocationRef.current) {
            await refreshSavedCurrentLocation(forceRefresh);
          }

          const merged = mergeStationsWithCurrent(
            data.stations,
            currentLocationRef.current?.station ?? null,
          );

          writeCachedStations(merged);
          setStations(merged);
          setSelectedStationId((prev) =>
            merged.some((st) => st.id === prev) ? prev : merged[0]!.id,
          );
        }
      } catch (error) {
        setFetchError(
          error instanceof Error
            ? `${error.message} — showing browser-cached readings.`
            : 'Unable to reach telemetry feed — showing browser-cached readings.',
        );
      } finally {
        setLoadingStations(false);
        setRefreshing(false);
      }
    },
    [refreshSavedCurrentLocation],
  );

  // Initial load: reuse saved browser location without re-detecting; refresh live readings if online
  useEffect(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    void loadStations(false);
    if (!currentLocationRef.current) {
      void detectCurrentLocation({ userInitiated: false });
    }
  }, [loadStations, detectCurrentLocation]);

  // Automatically refresh live AQI data when internet access returns
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setFetchError(null);
      void loadStations(true);
      if (!currentLocationRef.current) {
        void detectCurrentLocation({ userInitiated: false });
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadStations, detectCurrentLocation]);

  const selectedStation =
    stations.find((st) => st.id === selectedStationId) ??
    stations[0] ??
    OFFLINE_FALLBACK_STATIONS[0]!;

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        savedCount={savedLocations.length}
        isDark={isDark}
        onToggleTheme={() => setIsDark((prev) => !prev)}
        refreshing={refreshing}
        loadingStations={loadingStations}
        isOnline={isOnline}
        onRefresh={() => void loadStations(true)}
      />

      {/* Slim Location Control Strip */}
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
              onChange={(e) => setSelectedStationId(e.target.value)}
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
              onClick={() =>
                void detectCurrentLocation({ userInitiated: true, forceRefresh: true })
              }
              aria-label="Update my current location"
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-700/35 bg-cyan-50 px-2.5 py-1.5 text-xs font-medium text-cyan-900 transition-colors hover:bg-cyan-100 disabled:opacity-50 dark:border-cyan-500/35 dark:bg-cyan-950/60 dark:text-cyan-200 dark:hover:bg-cyan-900/60 whitespace-nowrap shrink-0"
            >
              <LocateFixed
                className={`h-3.5 w-3.5 ${locating ? 'animate-pulse' : ''}`}
                aria-hidden="true"
              />
              {locating ? 'Locating...' : 'My Location'}
            </button>
          </div>

          <div
            className="hidden items-center gap-2 text-xs text-slate-500 dark:text-slate-400 md:flex shrink-0"
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

      <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {fetchError && (
          <div
            role="status"
            className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
          >
            {fetchError}
          </div>
        )}

        {activeTab === 'monitor' && (
          <AQIDashboard
            lat={selectedStation.latitude}
            lng={selectedStation.longitude}
            locationName={`${selectedStation.city}, ${selectedStation.country}`}
            district={selectedStation.district}
            stationId={selectedStation.id}
            weather={{
              temperatureC: selectedStation.temperatureC,
              humidityPct: selectedStation.humidityPct,
              windKph: selectedStation.windKph,
            }}
            initialPersona={sensitivityToPersona(sensitivityProfile)}
            onChangePersona={(next) => setSensitivityProfile(personaToSensitivity(next))}
            onNavigateMap={() => setActiveTab('map')}
            onNavigateAssistant={() => setActiveTab('assistant')}
          />
        )}

        {activeTab === 'map' && (
          <Suspense fallback={<TabLoadingFallback />}>
            <AirQualityMap
              stations={stations}
              selectedStation={selectedStation}
              onSelectStation={setSelectedStationId}
              onOpenAssistant={() => setActiveTab('assistant')}
              onDetectLocation={() =>
                void detectCurrentLocation({ userInitiated: true, forceRefresh: true })
              }
              locating={locating}
            />
          </Suspense>
        )}

        {activeTab === 'family' && (
          <Suspense fallback={<TabLoadingFallback />}>
            <FamilyManager
              currentAqi={selectedStation.aqi}
              locationName={`${selectedStation.city}, ${selectedStation.country}`}
            />
          </Suspense>
        )}

        {activeTab === 'community' && (
          <Suspense fallback={<TabLoadingFallback />}>
            <CommunityHub
              currentAqi={selectedStation.aqi}
              locationName={`${selectedStation.city}, ${selectedStation.country}`}
            />
          </Suspense>
        )}

        {activeTab === 'assistant' && (
          <Suspense fallback={<TabLoadingFallback />}>
            <HealthAssistantPanel
              station={selectedStation}
              sensitivityProfile={sensitivityProfile}
              onChangeSensitivity={setSensitivityProfile}
            />
          </Suspense>
        )}

        {activeTab === 'saved' && (
          <Suspense fallback={<TabLoadingFallback />}>
            <SavedZonesPanel
              stations={stations}
              selectedStation={selectedStation}
              onSelectStation={(id) => {
                setSelectedStationId(id);
                setActiveTab('monitor');
              }}
              onSyncSensitivity={setSensitivityProfile}
            />
          </Suspense>
        )}
      </main>

      <OfflineIndicator />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <WorkspaceProvider>
        <WorkspaceShell />
      </WorkspaceProvider>
    </ErrorBoundary>
  );
}
