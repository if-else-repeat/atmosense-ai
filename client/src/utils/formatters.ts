/**
 * @module formatters
 * Pure, accessible formatting utilities for AQI metrics, timestamps, coordinates, and impact figures.
 */

export function formatAQI(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const clamped = Math.max(0, Math.min(500, Math.round(value)));
  return String(clamped);
}

export function getAQICategoryLabel(aqi: number): string {
  if (!Number.isFinite(aqi) || aqi < 0) return 'Unavailable';
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

export function formatPollutantValue(
  value: number,
  unit: 'µg/m³' | 'ppb' | 'ppm' | 'mg/m³' = 'µg/m³',
  decimals = 1,
): string {
  if (!Number.isFinite(value) || value < 0) return `— ${unit}`;
  return `${value.toFixed(decimals)} ${unit}`;
}

export function formatRelativeTime(timestampMs: number, nowMs: number = Date.now()): string {
  if (!Number.isFinite(timestampMs)) return 'Unknown';
  const diffSeconds = Math.max(0, Math.floor((nowMs - timestampMs) / 1000));
  if (diffSeconds < 60) return 'Just now';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

export function formatCoordinates(lat: number, lng: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 'Invalid coordinates';
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`;
}

export function formatCO2Savings(kg: number): string {
  if (!Number.isFinite(kg) || kg <= 0) return '0 kg CO2';
  if (kg >= 1000) {
    return `${(kg / 1000).toFixed(2)} tonnes CO2`;
  }
  return `${Math.round(kg).toLocaleString('en-US')} kg CO2`;
}

export function formatStreakLabel(days: number): string {
  if (!Number.isFinite(days) || days <= 0) return 'No active streak';
  const rounded = Math.floor(days);
  return `${rounded}-day streak`;
}

export function getMemberInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}
