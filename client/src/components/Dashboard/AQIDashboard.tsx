import { Suspense, lazy, useCallback, useMemo, useRef, useState, type TouchEvent } from 'react';
import { AUTO_REFRESH_INTERVAL_MS, useAQI } from '../../hooks/useAQI';
import type { PersonaProfile, PollutantId } from '../../types/aqi';
import {
  assessInversionRisk,
  getAQIStatusPresentation,
  getPersonaHealthGuidance,
} from '../../utils/dashboardAqi';
import { AQIHeroPanel } from './AQIHeroPanel';
import { DashboardBanners, PULL_TRIGGER_PX } from './DashboardBanners';
import {
  ActionHubSkeleton,
  DashboardLoadingSkeleton,
  ForecastChartSkeleton,
} from './DashboardSkeletons';
import { HealthRecommendation } from './HealthRecommendation';
import { InversionIndicator } from './InversionIndicator';
import { PollutantCard } from './PollutantCard';

// Lazy-load secondary dashboard sections for faster initial Time-to-Interactive
const LazyForecastChart = lazy(() => import('./ForecastChart'));
const LazyWinterSmogActionHub = lazy(() => import('../ActionHub/WinterSmogActionHub'));

export interface AQIDashboardProps {
  lat: number;
  lng: number;
  locationName?: string;
  district?: string;
  stationId?: string;
  initialPersona?: PersonaProfile;
  onChangePersona?: (persona: PersonaProfile) => void;
  onNavigateMap?: () => void;
  onNavigateAssistant?: () => void;
  /** Override 10-minute auto-refresh interval (primarily for deterministic tests). */
  refreshIntervalMs?: number;
  /** Optional live local weather telemetry from the active station. */
  weather?: {
    temperatureC: number;
    humidityPct: number;
    windKph: number;
  };
}

/**
 * Main production Dashboard component for AtmoSense AI.
 * Displays real-time AQI, 5 memoized pollutant trend cards, lazy-loaded native SVG
 * 24-hour forecast, thermal inversion indicator, persona health recommendation,
 * 10-minute auto-refresh, mobile pull-to-refresh, offline Service Worker indicator,
 * loading skeleton, error recovery, and full light/dark mode support.
 */
export function AQIDashboard({
  lat,
  lng,
  locationName,
  district,
  stationId,
  initialPersona = 'general',
  onChangePersona,
  onNavigateMap,
  onNavigateAssistant,
  refreshIntervalMs = AUTO_REFRESH_INTERVAL_MS,
  weather,
}: AQIDashboardProps) {
  const [persona, setPersona] = useState<PersonaProfile>(initialPersona);
  const [selectedPollutant, setSelectedPollutant] = useState<PollutantId>('pm25');
  const [pullDistance, setPullDistance] = useState<number>(0);
  const touchStartYRef = useRef<number | null>(null);

  const {
    data,
    loading,
    refreshing,
    error,
    isOffline,
    isFromCache,
    serviceWorkerActive,
    lastUpdatedText,
    refresh,
  } = useAQI({
    lat,
    lng,
    locationName,
    district,
    stationId,
    persona,
    refreshIntervalMs,
    weather,
  });

  const handlePersonaChange = useCallback(
    (nextPersona: PersonaProfile) => {
      setPersona(nextPersona);
      onChangePersona?.(nextPersona);
    },
    [onChangePersona],
  );

  // Mobile Pull-to-Refresh touch handlers (active when scrolled to top)
  const handleTouchStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
    const scrollTop = typeof window !== 'undefined' ? window.scrollY : 0;
    if (scrollTop <= 2 && event.touches.length === 1) {
      touchStartYRef.current = event.touches[0]?.clientY ?? null;
    } else {
      touchStartYRef.current = null;
    }
  }, []);

  const handleTouchMove = useCallback((event: TouchEvent<HTMLDivElement>) => {
    if (touchStartYRef.current === null) return;
    const currentY = event.touches[0]?.clientY ?? touchStartYRef.current;
    const delta = currentY - touchStartYRef.current;
    setPullDistance(delta > 0 ? Math.min(104, Math.round(delta * 0.55)) : 0);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (pullDistance >= PULL_TRIGGER_PX && !refreshing) {
      void refresh();
    }
    touchStartYRef.current = null;
    setPullDistance(0);
  }, [pullDistance, refresh, refreshing]);

  const statusPresentation = useMemo(
    () => (data ? getAQIStatusPresentation(data.aqi) : null),
    [data],
  );

  const inversionAssessment = useMemo(() => {
    if (!data) return null;
    return assessInversionRisk({
      localHour: new Date(data.updatedAt).getHours(),
      windKph: data.windKph,
      humidityPct: data.humidityPct,
      temperatureC: data.temperatureC,
      pm25: data.pm25,
    });
  }, [data]);

  const personaGuidance = useMemo(
    () => (data ? getPersonaHealthGuidance(data.aqi, persona) : null),
    [data, persona],
  );

  const whoPm25Ratio = useMemo(() => (data ? (data.pm25 / 15).toFixed(1) : '0.0'), [data]);

  const selectedPollutantMetric = useMemo(
    () => data?.pollutants.find((item) => item.id === selectedPollutant) ?? data?.pollutants[0],
    [data, selectedPollutant],
  );

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="space-y-6"
      data-testid="aqi-dashboard"
    >
      <DashboardBanners
        pullDistance={pullDistance}
        isOffline={isOffline}
        isFromCache={isFromCache}
        serviceWorkerActive={serviceWorkerActive}
        loading={loading}
        error={error}
        hasData={Boolean(data)}
        onRefresh={() => void refresh()}
      />

      {loading && !data && <DashboardLoadingSkeleton />}

      {data && statusPresentation && inversionAssessment && personaGuidance && (
        <>
          <AQIHeroPanel
            data={data}
            statusPresentation={statusPresentation}
            lastUpdatedText={lastUpdatedText}
            whoPm25Ratio={whoPm25Ratio}
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            onNavigateMap={onNavigateMap}
          />

          <section aria-labelledby="pollutants-grid-heading" className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2
                id="pollutants-grid-heading"
                className="font-display text-base font-semibold text-slate-900 dark:text-slate-100"
              >
                Pollutant Concentrations &amp; Short-Term Trends
              </h2>
              {selectedPollutantMetric && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Inspecting {selectedPollutantMetric.formula} ({selectedPollutantMetric.label}) ·{' '}
                  {selectedPollutantMetric.guidelineLabel}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {data.pollutants.map((metric) => (
                <PollutantCard
                  key={metric.id}
                  metric={metric}
                  selected={selectedPollutant === metric.id}
                  onSelect={setSelectedPollutant}
                />
              ))}
            </div>
          </section>

          <Suspense fallback={<ForecastChartSkeleton />}>
            <LazyForecastChart forecast={data.forecast} locationName={data.location.name} />
          </Suspense>

          <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
            <InversionIndicator assessment={inversionAssessment} />
            <HealthRecommendation
              guidance={personaGuidance}
              persona={persona}
              onChangePersona={handlePersonaChange}
              onOpenAssistant={onNavigateAssistant}
            />
          </div>

          <Suspense fallback={<ActionHubSkeleton />}>
            <LazyWinterSmogActionHub
              locationName={data.location.name}
              aqi={data.aqi}
              pm25={data.pm25}
              persona={persona}
            />
          </Suspense>
        </>
      )}
    </div>
  );
}

export default AQIDashboard;
