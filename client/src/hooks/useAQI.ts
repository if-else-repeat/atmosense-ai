/**
 * @module useAQI
 * React hook managing live air quality data fetching, 10-minute auto-refresh,
 * multi-endpoint fallback, Service Worker / navigator offline detection, and relative timestamps.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AQIDashboardData, UseAQIOptions, UseAQIResult } from '../types/aqi';
import { formatUpdatedAgo } from '../utils/dashboardAqi';
import {
  fetchDashboardTelemetry,
  getCacheKey,
  readLocalSnapshot,
  writeLocalSnapshot,
} from './aqiTelemetry';

/** Default automatic refresh cadence: 10 minutes (600,000 ms). */
export const AUTO_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

/** Fetches and auto-refreshes live AQI telemetry, 24-hour forecast, and offline SW status. */
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
        const nextData = await fetchDashboardTelemetry({
          lat,
          lng,
          locationName,
          district,
          persona,
          stationId,
          isManualRefresh,
          weatherTemp,
          weatherHumidity,
          weatherWind,
          signal: controller.signal,
        });
        writeLocalSnapshot(storageKey, nextData);
        setData(nextData);
        hasDataRef.current = true;
        setIsFromCache(false);
        setNextRefreshAt(Date.now() + refreshIntervalMs);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const cached = readLocalSnapshot(storageKey);
        if (cached && isManualRefresh) {
          setData(cached);
          hasDataRef.current = true;
          setIsFromCache(true);
        }
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load live air quality measurements. Please retry.',
        );
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

  useEffect(() => {
    hasDataRef.current = false;
    void fetchLiveData(false);
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchLiveData]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void fetchLiveData(true);
    }, refreshIntervalMs);
    return () => window.clearInterval(intervalId);
  }, [fetchLiveData, refreshIntervalMs]);

  useEffect(() => {
    if (!isOffline && isFromCache) {
      void fetchLiveData(true);
    }
  }, [isOffline, isFromCache, fetchLiveData]);

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
