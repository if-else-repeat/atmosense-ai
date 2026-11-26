import type { AirQualityStation, SensitivityProfile } from '../types/airQuality';
import type { PersonaProfile } from '../types/aqi';

export const THEME_STORAGE_KEY = 'atmosense-theme-v1';
export const CURRENT_LOCATION_STORAGE_KEY = 'atmosense-current-location-v1';
export const STATIONS_CACHE_KEY = 'atmosense-stations-cache-v1';

export interface CachedCurrentLocation {
  station: AirQualityStation;
  method: 'gps' | 'ip';
  savedAt: string;
}

/** Maps a workspace sensitivity profile to a dashboard persona. */
export function sensitivityToPersona(profile: SensitivityProfile): PersonaProfile {
  if (profile === 'respiratory') return 'asthmatics';
  if (profile === 'vulnerable') return 'elderly';
  return 'general';
}

/** Maps a dashboard persona back to a workspace sensitivity profile. */
export function personaToSensitivity(persona: PersonaProfile): SensitivityProfile {
  if (persona === 'asthmatics') return 'respiratory';
  if (persona === 'elderly' || persona === 'children') return 'vulnerable';
  return 'general';
}

/** Reads the user's saved current location snapshot from browser localStorage. */
export function readCachedCurrentLocation(): CachedCurrentLocation | null {
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

/** Persists the user's current location snapshot to browser localStorage. */
export function writeCachedCurrentLocation(entry: CachedCurrentLocation): void {
  try {
    window.localStorage.setItem(CURRENT_LOCATION_STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // Ignore storage quota restrictions
  }
}

/** Reads previously fetched station telemetry from browser localStorage. */
export function readCachedStations(): AirQualityStation[] | null {
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

/** Persists station telemetry list to browser localStorage for instant offline reload. */
export function writeCachedStations(stations: AirQualityStation[]): void {
  try {
    window.localStorage.setItem(STATIONS_CACHE_KEY, JSON.stringify(stations));
  } catch {
    // Ignore storage quota restrictions
  }
}

/** Reads persisted dark/light theme preference from browser localStorage. */
export function readInitialTheme(): boolean {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark';
  } catch {
    return false;
  }
}

/** Pins the user's current-location station at index 0 without duplicating entries. */
export function mergeStationsWithCurrent(
  baseStations: AirQualityStation[],
  current: AirQualityStation | null,
): AirQualityStation[] {
  const withoutCurrent = baseStations.filter((st) => st.id !== 'current-location');
  return current ? [{ ...current, id: 'current-location' }, ...withoutCurrent] : withoutCurrent;
}

/** Wraps browser Geolocation API in a promise with a configurable timeout. */
export function getBrowserCoordinates(
  timeoutMs = 7000,
): Promise<{ latitude: number; longitude: number }> {
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
