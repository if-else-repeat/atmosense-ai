/**
 * @module stationFetchers
 * Network fetch helpers for station coordinates, IP geolocation lookup, and global station feeds.
 */

import type { AirQualityStation } from '../types/airQuality';

export async function fetchStationByCoords(
  lat: number,
  lng: number,
  forceRefresh: boolean,
): Promise<AirQualityStation | null> {
  const refreshQuery = forceRefresh ? '&refresh=1' : '';
  const res = await fetch(
    `/api/air-quality/by-coords?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&stationId=current-location${refreshQuery}`,
  );
  if (!res.ok) return null;
  const payload = (await res.json()) as { station?: AirQualityStation };
  return payload.station ?? null;
}

export async function fetchIpDetectedStation(
  forceRefresh: boolean,
): Promise<AirQualityStation | null> {
  const res = await fetch(`/api/air-quality/detect-location${forceRefresh ? '?refresh=1' : ''}`);
  if (!res.ok) return null;
  const payload = (await res.json()) as {
    detected?: boolean;
    station?: AirQualityStation | null;
  };
  return payload.detected && payload.station ? payload.station : null;
}

export async function fetchAllStations(forceRefresh: boolean): Promise<AirQualityStation[]> {
  const response = await fetch(`/api/air-quality${forceRefresh ? '?refresh=1' : ''}`);
  if (!response.ok) throw new Error(`Telemetry API returned ${response.status}`);
  const data = (await response.json()) as { stations?: AirQualityStation[] };
  return Array.isArray(data.stations) ? data.stations : [];
}
