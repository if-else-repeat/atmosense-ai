import {
  AlertTriangle,
  ArrowDown,
  CheckCircle2,
  Droplets,
  Info,
  MapPin,
  OctagonAlert,
  RefreshCw,
  ShieldAlert,
  Thermometer,
  WifiOff,
  Wind,
} from 'lucide-react';
import { Suspense, lazy, useCallback, useMemo, useRef, useState, type TouchEvent } from 'react';
import { AUTO_REFRESH_INTERVAL_MS, useAQI } from '../../hooks/useAQI';
import type { PersonaProfile, PollutantId } from '../../types/aqi';
import {
  assessInversionRisk,
  getAQIStatusPresentation,
  getPersonaHealthGuidance,
} from '../../utils/dashboardAqi';
import { HealthRecommendation } from './HealthRecommendation';
import { InversionIndicator } from './InversionIndicator';
import { PollutantCard } from './PollutantCard';

// Lazy-load the native SVG 24-hour ForecastChart for faster initial Time-to-Interactive
const LazyForecastChart = lazy(() => import('./ForecastChart'));

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

const PULL_TRIGGER_PX = 68;

function AQIStatusIcon({
  iconKey,
}: {
  iconKey: ReturnType<typeof getAQIStatusPresentation>['iconKey'];
}) {
  switch (iconKey) {
    case 'check':
      return <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />;
    case 'info':
      return <Info className="h-5 w-5 shrink-0" aria-hidden="true" />;
    case 'alert-triangle':
      return <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />;
    case 'shield-alert':
      return <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden="true" />;
    case 'octagon-alert':
      return <OctagonAlert className="h-5 w-5 shrink-0" aria-hidden="true" />;
  }
}

function DashboardLoadingSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading live air quality telemetry"
      className="space-y-6"
      data-testid="aqi-dashboard-skeleton"
    >
      {/* Hero Skeleton */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-3">
            <div className="h-4 w-44 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="flex items-baseline gap-4">
              <div className="h-16 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-6 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="h-3.5 w-64 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map((idx) => (
              <div
                key={idx}
                className="h-14 w-24 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800/80"
              />
            ))}
          </div>
        </div>
      </div>

      {/* 5 Pollutant Cards Skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((idx) => (
          <div
            key={idx}
            className="h-40 animate-pulse rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="mt-5 h-8 w-20 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="mt-6 h-2 w-full rounded bg-slate-100 dark:bg-slate-800" />
          </div>
        ))}
      </div>

      {/* Forecast Chart Skeleton */}
      <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="h-4 w-48 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="mt-4 h-52 rounded-lg bg-slate-100 dark:bg-slate-800/70" />
      </div>

      {/* Bottom 2-column Skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900" />
        <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900" />
      </div>
    </div>
  );
}

function ForecastChartSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading 24-hour forecast chart"
      className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="h-4 w-44 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-4 h-52 rounded-lg bg-slate-100 dark:bg-slate-800/70" />
    </div>
  );
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
    if (delta > 0) {
      setPullDistance(Math.min(104, Math.round(delta * 0.55)));
    } else {
      setPullDistance(0);
    }
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

  const whoPm25Ratio = useMemo(() => {
    if (!data) return '0.0';
    return (data.pm25 / 15).toFixed(1);
  }, [data]);

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
      {/* Pull-to-refresh mobile indicator */}
      {pullDistance > 12 && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50/80 py-2 text-xs font-medium text-cyan-800 dark:border-cyan-800/70 dark:bg-cyan-950/40 dark:text-cyan-300"
        >
          <ArrowDown
            className={`h-3.5 w-3.5 transition-transform duration-150 ${
              pullDistance >= PULL_TRIGGER_PX ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
          <span>
            {pullDistance >= PULL_TRIGGER_PX
              ? 'Release to refresh air quality data'
              : 'Pull down to refresh'}
          </span>
        </div>
      )}

      {/* Service Worker Offline Indicator */}
      {(isOffline || isFromCache) && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/45 dark:text-amber-200"
        >
          <div className="flex items-center gap-2.5">
            <WifiOff
              className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400"
              aria-hidden="true"
            />
            <span>
              <strong>Offline mode</strong>
              {serviceWorkerActive
                ? ' — Service Worker is serving cached air quality readings.'
                : ' — displaying last cached air quality readings.'}
            </span>
          </div>
          {!isOffline && (
            <button
              type="button"
              onClick={() => void refresh()}
              className="whitespace-nowrap font-medium underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
            >
              Sync live data
            </button>
          )}
        </div>
      )}

      {/* Initial Loading Skeleton */}
      {loading && !data && <DashboardLoadingSkeleton />}

      {/* Blocking Error State with Retry Button */}
      {!loading && error && !data && (
        <section
          role="alert"
          className="rounded-xl border border-red-200 bg-white p-6 dark:border-red-900/70 dark:bg-slate-900"
        >
          <div className="flex items-start gap-3">
            <ShieldAlert
              className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                Unable to load live air quality data
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{error}</p>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => void refresh()}
                  className="inline-flex items-center gap-2 rounded-lg bg-cyan-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 dark:bg-cyan-600 dark:hover:bg-cyan-500 dark:focus-visible:ring-offset-slate-900"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  Retry
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Non-blocking Refresh Error Banner (when stale data is still visible) */}
      {error && data && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Refresh failed: {error}</span>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-800 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 dark:border-red-800 dark:bg-slate-900 dark:text-red-200"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            Retry
          </button>
        </div>
      )}

      {/* Populated Dashboard View */}
      {data && statusPresentation && inversionAssessment && personaGuidance && (
        <>
          {/* 1. Primary Real-Time AQI Display Hero Panel */}
          <section
            aria-labelledby="realtime-aqi-heading"
            className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
              {/* Left: Location + Large Accessible AQI Number + Status (Color + Icon + Text) */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <MapPin
                    className="h-3.5 w-3.5 shrink-0 text-cyan-700 dark:text-cyan-400"
                    aria-hidden="true"
                  />
                  <h1
                    id="realtime-aqi-heading"
                    className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100"
                  >
                    {data.location.name}
                  </h1>
                  {data.location.district && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{data.location.district}</span>
                    </>
                  )}
                </div>

                {/* Large, accessible real-time AQI value with aria-live="polite" */}
                <div className="flex flex-wrap items-baseline gap-4">
                  <div
                    aria-live="polite"
                    aria-atomic="true"
                    className="flex items-baseline gap-2"
                    data-testid="realtime-aqi-value"
                  >
                    <span className="font-mono text-6xl font-bold tracking-tight tabular-nums text-slate-950 sm:text-7xl dark:text-white">
                      {data.aqi}
                    </span>
                    <span className="font-mono text-sm font-medium text-slate-500 dark:text-slate-400">
                      US AQI
                    </span>
                  </div>

                  {/* Status strictly conveys Color + Icon + Text (never color alone) */}
                  <div
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold ${statusPresentation.borderClass} ${statusPresentation.surfaceClass} ${statusPresentation.textClass}`}
                  >
                    <AQIStatusIcon iconKey={statusPresentation.iconKey} />
                    <span>{statusPresentation.category}</span>
                  </div>
                </div>

                {/* Data Source Attribution + Auto-Refresh Metadata (clean unboxed text) */}
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <span data-testid="aqi-source-attribution">
                    Source: {data.source}, updated {lastUpdatedText}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Dominant pollutant: {data.dominantPollutant}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {whoPm25Ratio}× WHO 24h PM2.5 guideline
                  </span>
                </div>
              </div>

              {/* Right: Meteorological drivers + Direct Actions */}
              <div className="flex flex-col items-start gap-4 sm:items-end">
                <dl className="grid grid-cols-3 gap-5 border-t border-slate-100 pt-3 sm:border-t-0 sm:pt-0 dark:border-slate-800">
                  <div>
                    <dt className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <Thermometer className="h-3 w-3" aria-hidden="true" />
                      Temp
                    </dt>
                    <dd className="mt-0.5 font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {data.temperatureC.toFixed(1)}°C
                    </dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <Droplets className="h-3 w-3" aria-hidden="true" />
                      Humidity
                    </dt>
                    <dd className="mt-0.5 font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {data.humidityPct.toFixed(0)}%
                    </dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <Wind className="h-3 w-3" aria-hidden="true" />
                      Wind
                    </dt>
                    <dd className="mt-0.5 font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {data.windKph.toFixed(0)} km/h
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => void refresh()}
                    disabled={refreshing}
                    aria-label="Refresh live air quality readings"
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
                    {refreshing ? 'Updating…' : 'Refresh now'}
                  </button>

                  {onNavigateMap && (
                    <button
                      type="button"
                      onClick={onNavigateMap}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-cyan-700 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 dark:bg-cyan-600 dark:hover:bg-cyan-500 dark:focus-visible:ring-offset-slate-900"
                    >
                      Explore Station Map
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* 2. Pollutant Breakdown Grid: PM2.5, PM10, NO2, CO, O3 (React.memo cards) */}
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

          {/* 3. Lazy-Loaded Native SVG 24-Hour Forecast Chart */}
          <Suspense fallback={<ForecastChartSkeleton />}>
            <LazyForecastChart forecast={data.forecast} locationName={data.location.name} />
          </Suspense>

          {/* 4 & 5. Lower Split: Inversion Risk Indicator + Persona Health Recommendation */}
          <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
            <InversionIndicator assessment={inversionAssessment} />
            <HealthRecommendation
              guidance={personaGuidance}
              persona={persona}
              onChangePersona={handlePersonaChange}
              onOpenAssistant={onNavigateAssistant}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default AQIDashboard;
