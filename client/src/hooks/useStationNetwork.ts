import { useCallback, useEffect, useRef, useState } from 'react';
import type { AirQualityStation } from '../types/airQuality';
import { OFFLINE_FALLBACK_STATIONS } from '../utils/airQuality';
import {
  getBrowserCoordinates,
  mergeStationsWithCurrent,
  readCachedCurrentLocation,
  readCachedStations,
  writeCachedCurrentLocation,
  writeCachedStations,
  type CachedCurrentLocation,
} from '../utils/locationStorage';
import { fetchAllStations, fetchIpDetectedStation, fetchStationByCoords } from './stationFetchers';

export interface StationNetworkState {
  stations: AirQualityStation[];
  selectedStation: AirQualityStation;
  setSelectedStationId: (id: string) => void;
  loadingStations: boolean;
  refreshing: boolean;
  locating: boolean;
  isOnline: boolean;
  locationStatus: string | null;
  fetchError: string | null;
  loadStations: (forceRefresh?: boolean) => Promise<void>;
  detectCurrentLocation: (options?: {
    userInitiated?: boolean;
    forceRefresh?: boolean;
  }) => Promise<void>;
}

/** Manages the global urban monitoring station list, browser-persisted user location, and offline sync. */
export function useStationNetwork(): StationNetworkState {
  const initialSavedLocRef = useRef<CachedCurrentLocation | null | undefined>(undefined);
  if (initialSavedLocRef.current === undefined) {
    initialSavedLocRef.current = readCachedCurrentLocation();
  }
  const initialSavedLoc = initialSavedLocRef.current;

  const [stations, setStations] = useState<AirQualityStation[]>(() =>
    mergeStationsWithCurrent(
      readCachedStations() ?? OFFLINE_FALLBACK_STATIONS,
      initialSavedLoc?.station ?? null,
    ),
  );
  const [selectedStationId, setSelectedStationId] = useState<string>(() =>
    initialSavedLoc ? 'current-location' : OFFLINE_FALLBACK_STATIONS[0]!.id,
  );
  const [loadingStations, setLoadingStations] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [locating, setLocating] = useState(false);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [locationStatus, setLocationStatus] = useState<string | null>(() =>
    initialSavedLoc
      ? `Saved location · ${initialSavedLoc.station.city}, ${initialSavedLoc.station.country}`
      : null,
  );
  const [fetchError, setFetchError] = useState<string | null>(null);
  const currentLocationRef = useRef<CachedCurrentLocation | null>(initialSavedLoc);

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
      if (select) setSelectedStationId('current-location');
      if (statusText) setLocationStatus(statusText);
    },
    [],
  );

  const refreshSavedCurrentLocation = useCallback(
    async (forceRefresh = false): Promise<boolean> => {
      const saved = currentLocationRef.current;
      if (!saved || (typeof navigator !== 'undefined' && !navigator.onLine)) return false;
      try {
        const station = await fetchStationByCoords(
          saved.station.latitude,
          saved.station.longitude,
          forceRefresh,
        );
        if (station) {
          upsertCurrentLocationStation(station, saved.method, {
            select: false,
            statusText: `Saved location · ${station.city}, ${station.country}`,
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
        if (userInitiated)
          setLocationStatus('Offline · Connect to the internet to update your location');
        return;
      }

      setLocating(true);
      setLocationStatus('Detecting your location...');
      try {
        const coords = await getBrowserCoordinates(userInitiated ? 9000 : 5500);
        const station = await fetchStationByCoords(coords.latitude, coords.longitude, forceRefresh);
        if (station) {
          upsertCurrentLocationStation(station, 'gps', {
            select: true,
            statusText: `Saved GPS · ${station.city}, ${station.country}`,
          });
          setLocating(false);
          return;
        }
      } catch {
        // GPS unavailable or denied — fall back to server-side IP lookup
      }

      try {
        const ipStation = await fetchIpDetectedStation(forceRefresh);
        if (ipStation) {
          upsertCurrentLocationStation(ipStation, 'ip', {
            select: true,
            statusText: `Saved location · ${ipStation.city}, ${ipStation.country}`,
          });
          setLocating(false);
          return;
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
      if (forceRefresh) setRefreshing(true);
      else setLoadingStations(true);
      setFetchError(null);

      try {
        const fetched = await fetchAllStations(forceRefresh);
        if (fetched.length > 0) {
          if (currentLocationRef.current) await refreshSavedCurrentLocation(forceRefresh);
          const merged = mergeStationsWithCurrent(
            fetched,
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

  useEffect(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    void loadStations(false);
    if (!currentLocationRef.current) void detectCurrentLocation({ userInitiated: false });
  }, [loadStations, detectCurrentLocation]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setFetchError(null);
      void loadStations(true);
      if (!currentLocationRef.current) void detectCurrentLocation({ userInitiated: false });
    };
    const handleOffline = () => setIsOnline(false);
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

  return {
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
  };
}
