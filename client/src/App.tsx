import { lazy, Suspense, useEffect, useState } from 'react';
import { AQIDashboard } from './components/Dashboard/AQIDashboard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LocationSubBar } from './components/LocationSubBar';
import { OfflineIndicator } from './components/OfflineIndicator';
import { TopBar } from './components/TopBar';
import { WorkspaceProvider, useWorkspace } from './context/AuthContext';
import { useStationNetwork } from './hooks/useStationNetwork';
import type { ActiveTab, SensitivityProfile } from './types/airQuality';
import {
  THEME_STORAGE_KEY,
  personaToSensitivity,
  readInitialTheme,
  sensitivityToPersona,
} from './utils/locationStorage';

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

function WorkspaceShell() {
  const { profile, savedLocations } = useWorkspace();
  const {
    stations,
    selectedStation,
    setSelectedStationId,
    loadingStations,
    refreshing,
    locating,
    isOnline,
    locationStatus,
    fetchError,
    loadStations,
    detectCurrentLocation,
  } = useStationNetwork();

  const [activeTab, setActiveTab] = useState<ActiveTab>('monitor');
  const [sensitivityProfile, setSensitivityProfile] = useState<SensitivityProfile>(
    () => profile?.sensitivityProfile ?? 'general',
  );
  const [isDark, setIsDark] = useState<boolean>(readInitialTheme);

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

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-cyan-700 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-cyan-400"
      >
        Skip to main content
      </a>

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

      <LocationSubBar
        stations={stations}
        selectedStation={selectedStation}
        onSelectStation={setSelectedStationId}
        onDetectLocation={() =>
          void detectCurrentLocation({ userInitiated: true, forceRefresh: true })
        }
        locating={locating}
        isOnline={isOnline}
        locationStatus={locationStatus}
      />

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-6 focus:outline-none sm:px-6 lg:px-8"
      >
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

      <footer className="border-t border-slate-200 bg-white/80 py-4 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
          <p>
            AtmoSense AI · Grounded in WHO Global Air Quality Guidelines (2021) &amp; US EPA AQI
            Standards.
          </p>
          <p>
            Informational environmental guidance only — not a substitute for clinical medical
            advice.
          </p>
        </div>
      </footer>

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
