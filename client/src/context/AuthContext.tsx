import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type {
  AirQualityStation,
  HealthAdvisoryResult,
  SavedAdvisoryRecord,
  SavedLocationRecord,
  SensitivityProfile,
  UserProfileRecord,
} from '../types/airQuality';

const PROFILE_STORAGE_KEY = 'atmosense-local-profile-v1';
const LOCATIONS_STORAGE_KEY = 'atmosense-saved-locations-v1';
const ADVISORIES_STORAGE_KEY = 'atmosense-saved-advisories-v1';

const DEFAULT_PROFILE: UserProfileRecord = {
  uid: 'local-browser',
  displayName: 'Personal Profile',
  email: '',
  sensitivityProfile: 'general',
  aqiAlertThreshold: 100,
  preferredUnit: 'aqi',
};

function readStorageJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStorageJson<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota or private browsing storage restrictions
  }
}

export interface WorkspaceContextValue {
  profile: UserProfileRecord;
  savedLocations: SavedLocationRecord[];
  savedAdvisories: SavedAdvisoryRecord[];
  updatePreferences: (updates: {
    displayName: string;
    sensitivityProfile: SensitivityProfile;
    aqiAlertThreshold: number;
    preferredUnit: 'aqi' | 'pm25';
  }) => Promise<void>;
  saveStation: (
    station: AirQualityStation,
    customLabel?: string,
    alertThreshold?: number,
  ) => Promise<void>;
  removeSavedStation: (stationId: string) => Promise<void>;
  persistAdvisory: (
    station: AirQualityStation,
    sensitivityProfile: SensitivityProfile,
    advisory: HealthAdvisoryResult,
  ) => Promise<void>;
  removeAdvisory: (advisoryId: string) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfileRecord>(() => {
    const stored = readStorageJson<Partial<UserProfileRecord> | null>(PROFILE_STORAGE_KEY, null);
    if (!stored) return DEFAULT_PROFILE;
    return {
      ...DEFAULT_PROFILE,
      displayName:
        typeof stored.displayName === 'string' && stored.displayName.trim()
          ? stored.displayName.trim().slice(0, 80)
          : DEFAULT_PROFILE.displayName,
      sensitivityProfile:
        stored.sensitivityProfile === 'respiratory' ||
        stored.sensitivityProfile === 'athlete' ||
        stored.sensitivityProfile === 'vulnerable' ||
        stored.sensitivityProfile === 'general'
          ? stored.sensitivityProfile
          : DEFAULT_PROFILE.sensitivityProfile,
      aqiAlertThreshold:
        typeof stored.aqiAlertThreshold === 'number' &&
        stored.aqiAlertThreshold >= 25 &&
        stored.aqiAlertThreshold <= 300
          ? stored.aqiAlertThreshold
          : DEFAULT_PROFILE.aqiAlertThreshold,
      preferredUnit: stored.preferredUnit === 'pm25' ? 'pm25' : 'aqi',
    };
  });

  const [savedLocations, setSavedLocations] = useState<SavedLocationRecord[]>(() =>
    readStorageJson<SavedLocationRecord[]>(LOCATIONS_STORAGE_KEY, []),
  );

  const [savedAdvisories, setSavedAdvisories] = useState<SavedAdvisoryRecord[]>(() =>
    readStorageJson<SavedAdvisoryRecord[]>(ADVISORIES_STORAGE_KEY, []),
  );

  const updatePreferences = useCallback(
    async (updates: {
      displayName: string;
      sensitivityProfile: SensitivityProfile;
      aqiAlertThreshold: number;
      preferredUnit: 'aqi' | 'pm25';
    }) => {
      const next: UserProfileRecord = {
        ...profile,
        displayName: updates.displayName.trim().slice(0, 80) || DEFAULT_PROFILE.displayName,
        sensitivityProfile: updates.sensitivityProfile,
        aqiAlertThreshold: Math.min(300, Math.max(25, Math.round(updates.aqiAlertThreshold))),
        preferredUnit: updates.preferredUnit,
      };
      setProfile(next);
      writeStorageJson(PROFILE_STORAGE_KEY, next);
    },
    [profile],
  );

  const saveStation = useCallback(
    async (station: AirQualityStation, customLabel = '', alertThreshold?: number) => {
      const threshold = Math.min(
        300,
        Math.max(25, Math.round(alertThreshold ?? profile.aqiAlertThreshold ?? 100)),
      );
      const record: SavedLocationRecord = {
        id: station.id,
        stationId: station.id,
        cityName: station.city.slice(0, 80),
        district: station.district.slice(0, 100),
        latitude: station.latitude,
        longitude: station.longitude,
        alertThreshold: threshold,
        customLabel: customLabel.trim().slice(0, 60),
      };

      setSavedLocations((prev) => {
        const next = [record, ...prev.filter((item) => item.stationId !== station.id)];
        writeStorageJson(LOCATIONS_STORAGE_KEY, next);
        return next;
      });
    },
    [profile.aqiAlertThreshold],
  );

  const removeSavedStation = useCallback(async (stationId: string) => {
    setSavedLocations((prev) => {
      const next = prev.filter((item) => item.id !== stationId && item.stationId !== stationId);
      writeStorageJson(LOCATIONS_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const persistAdvisory = useCallback(
    async (
      station: AirQualityStation,
      sensitivityProfile: SensitivityProfile,
      advisory: HealthAdvisoryResult,
    ) => {
      const record: SavedAdvisoryRecord = {
        id: `adv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        stationId: station.id,
        cityName: station.city.slice(0, 80),
        aqiAtGeneration: Math.min(500, Math.max(0, Math.round(station.aqi))),
        sensitivityProfile,
        outdoorVerdict: advisory.outdoorVerdict.slice(0, 140),
        summary: advisory.summary.slice(0, 1000),
        recommendedWindow: advisory.recommendedWindow.slice(0, 160),
        createdAtLabel: new Date().toLocaleDateString([], {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      };

      setSavedAdvisories((prev) => {
        const next = [record, ...prev].slice(0, 40);
        writeStorageJson(ADVISORIES_STORAGE_KEY, next);
        return next;
      });
    },
    [],
  );

  const removeAdvisory = useCallback(async (advisoryId: string) => {
    setSavedAdvisories((prev) => {
      const next = prev.filter((item) => item.id !== advisoryId);
      writeStorageJson(ADVISORIES_STORAGE_KEY, next);
      return next;
    });
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        profile,
        savedLocations,
        savedAdvisories,
        updatePreferences,
        saveStation,
        removeSavedStation,
        persistAdvisory,
        removeAdvisory,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used inside WorkspaceProvider');
  }
  return ctx;
}

// Backward-compatible aliases so existing imports stay clean
export const AuthProvider = WorkspaceProvider;
export const useAuth = useWorkspace;
