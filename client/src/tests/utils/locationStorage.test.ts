import { afterEach, describe, expect, it, vi } from 'vitest';
import { OFFLINE_FALLBACK_STATIONS } from '../../utils/airQuality';
import {
  CURRENT_LOCATION_STORAGE_KEY,
  STATIONS_CACHE_KEY,
  THEME_STORAGE_KEY,
  mergeStationsWithCurrent,
  personaToSensitivity,
  readCachedCurrentLocation,
  readCachedStations,
  readInitialTheme,
  sensitivityToPersona,
  writeCachedCurrentLocation,
  writeCachedStations,
} from '../../utils/locationStorage';

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('locationStorage — Station Caching, Geolocation Pinning & Malformed Recovery', () => {
  it('maps sensitivity profiles and personas bidirectionally', () => {
    expect(sensitivityToPersona('respiratory')).toBe('asthmatics');
    expect(sensitivityToPersona('vulnerable')).toBe('elderly');
    expect(sensitivityToPersona('general')).toBe('general');

    expect(personaToSensitivity('asthmatics')).toBe('respiratory');
    expect(personaToSensitivity('children')).toBe('vulnerable');
    expect(personaToSensitivity('elderly')).toBe('vulnerable');
    expect(personaToSensitivity('general')).toBe('general');
  });

  it('persists and reloads current location and station lists cleanly', () => {
    const sample = OFFLINE_FALLBACK_STATIONS[0]!;
    writeCachedCurrentLocation({
      station: sample,
      method: 'gps',
      savedAt: '2026-11-26T08:00:00.000Z',
    });
    const loadedLoc = readCachedCurrentLocation();
    expect(loadedLoc?.station.id).toBe('current-location');
    expect(loadedLoc?.station.city).toBe(sample.city);
    expect(loadedLoc?.method).toBe('gps');

    writeCachedStations(OFFLINE_FALLBACK_STATIONS);
    const loadedStations = readCachedStations();
    expect(loadedStations).toHaveLength(OFFLINE_FALLBACK_STATIONS.length);
  });

  it('pins current location at index 0 without creating duplicates', () => {
    const first = OFFLINE_FALLBACK_STATIONS[0]!;
    const second = OFFLINE_FALLBACK_STATIONS[1] ?? { ...first, id: 'station-b', city: 'London' };
    const third = { ...first, id: 'station-c', city: 'Bengaluru' };
    const base = [first, second, third];

    const pinned = mergeStationsWithCurrent(base, second);
    expect(pinned[0]?.id).toBe('current-location');
    expect(pinned.filter((s) => s.id === 'current-location')).toHaveLength(1);

    const rePinned = mergeStationsWithCurrent(pinned, third);
    expect(rePinned[0]?.city).toBe(third.city);
    expect(rePinned.filter((s) => s.id === 'current-location')).toHaveLength(1);
  });

  it('recovers gracefully from malformed JSON and storage access exceptions', () => {
    window.localStorage.setItem(CURRENT_LOCATION_STORAGE_KEY, '{not-valid-json');
    window.localStorage.setItem(STATIONS_CACHE_KEY, 'corrupt-array');
    expect(readCachedCurrentLocation()).toBeNull();
    expect(readCachedStations()).toBeNull();

    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(readInitialTheme()).toBe(true);

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(readCachedCurrentLocation()).toBeNull();
    expect(readCachedStations()).toBeNull();
    expect(readInitialTheme()).toBe(false);
  });
});
