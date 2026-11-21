/**
 * @module useAQI
 * React hook managing live air quality data fetching, 10-minute auto-refresh,
 * multi-endpoint fallback (/api/aqi/current + /api/aqi/forecast -> /api/air-quality),
 * Service Worker / navigator offline detection, localStorage caching, and relative timestamps.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AQIDashboardData,
  ForecastHourlyPoint,
  UseAQIOptions,
  UseAQIResult,
} from '../types/aqi';
import type { AirQualityStation } from '../types/airQuality';
import {
  buildPollutantMetricCards,
  formatUpdatedAgo,
  getAQIStatusPresentation,
} from '../utils/dashboardAqi';

/** Default automatic refresh cadence: 10 minutes (600,000 ms). */
export const AUTO_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const CACHE_STORAGE_PREFIX = 'atmosense:aqi-dashboard:v1:';

interface MultiSourceCurrentResponse {
  data?: {
    aqi: number;
    pm25: number;
    pm10: number;
    no2: number;
    co: number;
    o3: number;
    so2: number;
    source: string;
    timestamp: number;
    location: { lat: number; lng: number; name: string };
    confidence: number;
  };
}

interface MultiSourceForecastResponse {
  forecast?: Array<{
    timestamp: number;
    date: string;
    aqi: number;
    pm25: number;
    pm10: number;
    no2: number;
    co: number;
    o3: number;
  }>;
}

interface StationsApiResponse {
  stations?: AirQualityStation[];
}

function getCacheKey(lat: number, lng: number): string {
  return `${CACHE_STORAGE_PREFIX}${lat.toFixed(2)},${lng.toFixed(2)}`;
}

function readLocalSnapshot(key: string): AQIDashboardData | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AQIDashboardData;
    if (parsed && typeof parsed.aqi === 'number' && Array.isArray(parsed.pollutants)) {
      return parsed;
    }
  } catch {
    // Ignore storage read errors in restricted iframe/private contexts
  }
  return null;
}

function writeLocalSnapshot(key: string, value: AQIDashboardData): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota or storage restriction errors
  }
}

function synthesize24hForecast(
  baseAqi: number,
  basePm25: number,
  basePm10: number,
  baseNo2: number,
  baseO3: number,
  baseCo: number,
): ForecastHourlyPoint[] {
  const now = new Date();
  const points: ForecastHourlyPoint[] = [];

  for (let offset = 0; offset < 24; offset++) {
    const dt = new Date(now.getTime() + offset * 60 * 60 * 1000);
    const hour = dt.getHours();
    // Diurnal boundary-layer curve: morning inversion peak (6-9), midday convective dip (11-16), evening peak (17-20)
    const multiplier =
      hour >= 6 && hour <= 9
        ? 1.16
        : hour >= 11 && hour <= 16
          ? 0.82
          : hour >= 17 && hour <= 20
            ? 1.2
            : 0.96;

    const aqi = Math.max(5, Math.min(500, Math.round(baseAqi * multiplier)));
    const pm25 = Number(Math.max(1, basePm25 * multiplier).toFixed(1));
    const pm10 = Number(Math.max(2, basePm10 * multiplier).toFixed(1));
    const no2 = Number(Math.max(1, baseNo2 * multiplier).toFixed(1));
    const o3 = Number(
      Math.max(0.005, baseO3 * (hour >= 12 && hour <= 16 ? 1.18 : 0.92)).toFixed(3),
    );
    const co = Number(Math.max(0.1, baseCo * multiplier).toFixed(2));

    points.push({
      hourLabel: `${String(hour).padStart(2, '0')}:00`,
      isoTime: dt.toISOString(),
      aqi,
      pm25,
      pm10,
      no2,
      o3,
      co,
    });
  }

  return points;
}

function mapStationToDashboardData(station: AirQualityStation): AQIDashboardData {
  // Normalize Open-Meteo units to canonical dashboard units (NO2 ppb, CO mg/m³, O3 ppm)
  const pm25 = station.metrics.pm25;
  const pm10 = station.metrics.pm10;
  const no2Ppb = Number((station.metrics.no2 / 1.88).toFixed(1));
  const coMgM3 = Number((station.metrics.co / 1000).toFixed(2));
  const o3Ppm = Number((station.metrics.o3 / 1960).toFixed(3));
  const so2Ppb = Number((station.metrics.so2 / 2.62).toFixed(1));

  const forecast: ForecastHourlyPoint[] =
    station.hourly.length >= 12
      ? station.hourly.slice(0, 24).map((pt) => ({
          hourLabel: pt.hourLabel,
          isoTime: pt.isoTime,
          aqi: pt.aqi,
          pm25: pt.pm25,
          pm10: pt.pm10,
          no2: Number((pt.no2 / 1.88).toFixed(1)),
          o3: Number((pt.o3 / 1960).toFixed(3)),
          co: coMgM3,
        }))
      : synthesize24hForecast(station.aqi, pm25, pm10, no2Ppb, o3Ppm, coMgM3);

  const status = getAQIStatusPresentation(station.aqi);
  const parsedTime = Date.parse(station.updatedAt);
  const updatedAt = Number.isFinite(parsedTime) ? parsedTime : Date.now();
  const sourceLabel = station.source === 'live-open-meteo' ? 'Open-Meteo' : 'AtmoSense Baseline';

  return {
    aqi: station.aqi,
    category: status.category,
    dominantPollutant: station.dominantPollutant,
    pm25,
    pm10,
    no2: no2Ppb,
    co: coMgM3,
    o3: o3Ppm,
    so2: so2Ppb,
    temperatureC: station.temperatureC,
    humidityPct: station.humidityPct,
    windKph: station.windKph,
    location: {
      lat: station.latitude,
      lng: station.longitude,
      name: `${station.city}, ${station.country}`,
      district: station.district,
    },
    source: sourceLabel,
    confidence: station.source === 'live-open-meteo' ? 0.9 : 0.78,
    updatedAt,
    forecast,
    pollutants: buildPollutantMetricCards(
      { pm25, pm10, no2: no2Ppb, co: coMgM3, o3: o3Ppm },
      forecast,
    ),
  };
}

/**
 * Fetches and auto-refreshes live AQI telemetry, 24-hour forecast, and offline Service Worker status.
 */
export function useAQI(options: UseAQIOptions): UseAQIResult {
  const {
    lat,
    lng,
    locationName,
    district,
    persona = 'general',
    refreshIntervalMs = AUTO_REFRESH_INTERVAL_MS,
    stationId,
    weather,
  } = options;
  const weatherTemp = weather?.temperatureC;
  const weatherHumidity = weather?.humidityPct;
  const weatherWind = weather?.windKph;

  const [data, setData] = useState<AQIDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  );
  const [serviceWorkerActive, setServiceWorkerActive] = useState<boolean>(() =>
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator
      ? Boolean(navigator.serviceWorker.controller)
      : false,
  );
  const [clockTick, setClockTick] = useState<number>(() => Date.now());
  const [nextRefreshAt, setNextRefreshAt] = useState<number>(() => Date.now() + refreshIntervalMs);

  const abortRef = useRef<AbortController | null>(null);
  const hasDataRef = useRef<boolean>(false);

  // Track browser online/offline transitions + Service Worker controller state
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    const handleSwChange = () => {
      if ('serviceWorker' in navigator) {
        setServiceWorkerActive(Boolean(navigator.serviceWorker.controller));
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', handleSwChange);
      void navigator.serviceWorker.ready
        .then((reg) => {
          if (reg.active) setServiceWorkerActive(true);
        })
        .catch(() => undefined);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', handleSwChange);
      }
    };
  }, []);

  const fetchLiveData = useCallback(
    async (isManualRefresh = false): Promise<void> => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (isManualRefresh && hasDataRef.current) {
        setRefreshing(true);
      } else if (!hasDataRef.current) {
        setLoading(true);
      }
      setError(null);

      const storageKey = getCacheKey(lat, lng);

      // If browser reports offline, serve cached snapshot immediately
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const cached = readLocalSnapshot(storageKey);
        if (cached) {
          setData(cached);
          hasDataRef.current = true;
          setIsFromCache(true);
          setLoading(false);
          setRefreshing(false);
          return;
        }
      }

      try {
        // 1. Primary multi-source endpoint (/api/aqi/current + /api/aqi/forecast)
        const currentUrl = `/api/aqi/current?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&persona=${encodeURIComponent(persona)}`;
        const forecastUrl = `/api/aqi/forecast?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`;

        const currentRes = await fetch(currentUrl, { signal: controller.signal });
        if (currentRes.ok) {
          const currentJson = (await currentRes.json()) as MultiSourceCurrentResponse;
          if (currentJson.data) {
            const d = currentJson.data;
            let forecastPoints: ForecastHourlyPoint[] = [];

            try {
              const forecastRes = await fetch(forecastUrl, { signal: controller.signal });
              if (forecastRes.ok) {
                const forecastJson = (await forecastRes.json()) as MultiSourceForecastResponse;
                if (Array.isArray(forecastJson.forecast) && forecastJson.forecast.length >= 2) {
                  const firstTs = forecastJson.forecast[0]?.timestamp ?? 0;
                  const secondTs = forecastJson.forecast[1]?.timestamp ?? 0;
                  const intervalHours = Math.abs(secondTs - firstTs) / (60 * 60 * 1000);
                  const isHourlySeries =
                    forecastJson.forecast.length >= 12 && intervalHours > 0 && intervalHours <= 3.5;

                  if (isHourlySeries) {
                    forecastPoints = forecastJson.forecast.slice(0, 24).map((pt) => {
                      const dt = new Date(pt.timestamp);
                      return {
                        hourLabel: `${String(dt.getHours()).padStart(2, '0')}:00`,
                        isoTime: pt.date,
                        aqi: pt.aqi,
                        pm25: pt.pm25,
                        pm10: pt.pm10,
                        no2: pt.no2,
                        o3: pt.o3,
                        co: pt.co,
                      };
                    });
                  }
                }
              }
            } catch {
              // Forecast endpoint failure falls back to boundary-layer diurnal synthesis
            }

            if (forecastPoints.length < 12) {
              forecastPoints = synthesize24hForecast(d.aqi, d.pm25, d.pm10, d.no2, d.o3, d.co);
            }

            const status = getAQIStatusPresentation(d.aqi);
            const normalized: AQIDashboardData = {
              aqi: d.aqi,
              category: status.category,
              dominantPollutant: d.pm25 >= d.pm10 * 0.45 ? 'PM2.5' : 'PM10',
              pm25: d.pm25,
              pm10: d.pm10,
              no2: d.no2,
              co: d.co,
              o3: d.o3,
              so2: d.so2,
              temperatureC: weatherTemp ?? 24,
              humidityPct: weatherHumidity ?? 58,
              windKph: weatherWind ?? 9,
              location: {
                lat: d.location.lat,
                lng: d.location.lng,
                name: locationName || d.location.name,
                district,
              },
              source: d.source,
              confidence: d.confidence,
              updatedAt: d.timestamp || Date.now(),
              forecast: forecastPoints,
              pollutants: buildPollutantMetricCards(
                { pm25: d.pm25, pm10: d.pm10, no2: d.no2, co: d.co, o3: d.o3 },
                forecastPoints,
              ),
            };

            writeLocalSnapshot(storageKey, normalized);
            setData(normalized);
            hasDataRef.current = true;
            setIsFromCache(false);
            setNextRefreshAt(Date.now() + refreshIntervalMs);
            setLoading(false);
            setRefreshing(false);
            return;
          }
        }

        // 1b. Coordinate-specific live telemetry (/api/air-quality/by-coords) for dynamic current location
        if (stationId === 'current-location') {
          try {
            const byCoordsParams = new URLSearchParams({
              lat: String(lat),
              lng: String(lng),
              stationId: 'current-location',
            });
            if (isManualRefresh) {
              byCoordsParams.set('refresh', '1');
            }
            const byCoordsRes = await fetch(
              `/api/air-quality/by-coords?${byCoordsParams.toString()}`,
              { signal: controller.signal },
            );
            if (byCoordsRes.ok) {
              const byCoordsJson = (await byCoordsRes.json()) as { station?: AirQualityStation };
              if (byCoordsJson.station && typeof byCoordsJson.station.aqi === 'number') {
                const mapped = mapStationToDashboardData(byCoordsJson.station);
                const merged: AQIDashboardData = {
                  ...mapped,
                  location: {
                    ...mapped.location,
                    name: locationName || mapped.location.name,
                    district: district || mapped.location.district,
                  },
                };
                writeLocalSnapshot(storageKey, merged);
                setData(merged);
                hasDataRef.current = true;
                setIsFromCache(false);
                setNextRefreshAt(Date.now() + refreshIntervalMs);
                setLoading(false);
                setRefreshing(false);
                return;
              }
            }
          } catch (byCoordsErr) {
            if (byCoordsErr instanceof DOMException && byCoordsErr.name === 'AbortError') {
              throw byCoordsErr;
            }
            // Fall through cleanly to the station list endpoint
          }
        }

        // 2. Fallback to AtmoSense Open-Meteo / calibrated station telemetry API (/api/air-quality)
        const stationsRes = await fetch(`/api/air-quality${isManualRefresh ? '?refresh=1' : ''}`, {
          signal: controller.signal,
        });
        if (!stationsRes.ok) {
          throw new Error(`Air quality telemetry returned HTTP ${stationsRes.status}`);
        }
        const stationsJson = (await stationsRes.json()) as StationsApiResponse;
        const stations = stationsJson.stations ?? [];
        if (stations.length === 0) {
          throw new Error('No monitoring stations available in telemetry feed.');
        }

        const matchedStation =
          (stationId ? stations.find((st) => st.id === stationId) : undefined) ??
          stations.reduce((closest, candidate) => {
            const cDist = Math.hypot(candidate.latitude - lat, candidate.longitude - lng);
            const bestDist = Math.hypot(closest.latitude - lat, closest.longitude - lng);
            return cDist < bestDist ? candidate : closest;
          }, stations[0]!);

        const mapped = mapStationToDashboardData(matchedStation);
        writeLocalSnapshot(storageKey, mapped);
        setData(mapped);
        hasDataRef.current = true;
        setIsFromCache(false);
        setNextRefreshAt(Date.now() + refreshIntervalMs);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        const cached = readLocalSnapshot(storageKey);
        if (cached && isManualRefresh) {
          setData(cached);
          hasDataRef.current = true;
          setIsFromCache(true);
        }
        const message =
          err instanceof Error
            ? err.message
            : 'Unable to load live air quality measurements. Please retry.';
        setError(message);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [
      district,
      lat,
      lng,
      locationName,
      persona,
      refreshIntervalMs,
      stationId,
      weatherHumidity,
      weatherTemp,
      weatherWind,
    ],
  );

  // Initial fetch & re-fetch when coordinates/station change
  useEffect(() => {
    hasDataRef.current = false;
    void fetchLiveData(false);
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchLiveData]);

  // Auto-refresh every 10 minutes
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void fetchLiveData(true);
    }, refreshIntervalMs);
    return () => window.clearInterval(intervalId);
  }, [fetchLiveData, refreshIntervalMs]);

  // Re-fetch automatically when network comes back online
  useEffect(() => {
    if (!isOffline && isFromCache) {
      void fetchLiveData(true);
    }
  }, [isOffline, isFromCache, fetchLiveData]);

  // Update relative "updated X min ago" display every 30 seconds
  useEffect(() => {
    const timer = window.setInterval(() => setClockTick(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const lastUpdatedText = data ? formatUpdatedAgo(data.updatedAt, clockTick) : 'just now';
  const nextRefreshSeconds = Math.max(0, Math.round((nextRefreshAt - clockTick) / 1000));

  const refresh = useCallback(async () => {
    await fetchLiveData(true);
  }, [fetchLiveData]);

  return {
    data,
    loading,
    refreshing,
    error,
    isOffline,
    isFromCache,
    serviceWorkerActive,
    lastUpdatedText,
    nextRefreshSeconds,
    refresh,
  };
}
