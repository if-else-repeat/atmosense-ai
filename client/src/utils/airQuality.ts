import type {
  AirQualityStation,
  AqiCategoryKey,
  PollutantKey,
  PollutantMetrics,
} from '../types/airQuality';

export interface AqiTone {
  textClass: string;
  accentHex: string;
  surfaceClass: string;
  glyph: string;
}

export function getAqiTone(key: AqiCategoryKey): AqiTone {
  switch (key) {
    case 'good':
      return {
        textClass: 'text-emerald-700 dark:text-emerald-400',
        accentHex: '#059669',
        surfaceClass: 'bg-emerald-50 dark:bg-emerald-950/40',
        glyph: '●',
      };
    case 'moderate':
      return {
        textClass: 'text-amber-700 dark:text-amber-400',
        accentHex: '#d97706',
        surfaceClass: 'bg-amber-50 dark:bg-amber-950/40',
        glyph: '▲',
      };
    case 'sensitive':
      return {
        textClass: 'text-orange-700 dark:text-orange-400',
        accentHex: '#ea580c',
        surfaceClass: 'bg-orange-50 dark:bg-orange-950/40',
        glyph: '▲',
      };
    case 'unhealthy':
      return {
        textClass: 'text-rose-700 dark:text-rose-400',
        accentHex: '#dc2626',
        surfaceClass: 'bg-rose-50 dark:bg-rose-950/40',
        glyph: '◆',
      };
    case 'very_unhealthy':
      return {
        textClass: 'text-purple-700 dark:text-purple-400',
        accentHex: '#9333ea',
        surfaceClass: 'bg-purple-50 dark:bg-purple-950/40',
        glyph: '◆',
      };
    case 'hazardous':
      return {
        textClass: 'text-red-900 dark:text-red-300',
        accentHex: '#991b1b',
        surfaceClass: 'bg-red-100 dark:bg-red-950/60',
        glyph: '✖',
      };
  }
}

export interface RadarAxisPoint {
  key: keyof PollutantMetrics;
  label: string;
  rawValue: number;
  unit: string;
  referenceLimit: number;
  normalized: number; // 0 to 1
}

/**
 * Normalizes 6 urban air pollutants against WHO/EPA reference thresholds
 * for the native SVG spider/radar calibration chart.
 */
export function buildRadarProfile(metrics: PollutantMetrics): RadarAxisPoint[] {
  const axes: Array<{
    key: keyof PollutantMetrics;
    label: string;
    unit: string;
    limit: number;
  }> = [
    { key: 'pm25', label: 'PM2.5', unit: 'µg/m³', limit: 35 },
    { key: 'pm10', label: 'PM10', unit: 'µg/m³', limit: 75 },
    { key: 'no2', label: 'NO₂', unit: 'µg/m³', limit: 80 },
    { key: 'o3', label: 'O₃', unit: 'µg/m³', limit: 120 },
    { key: 'so2', label: 'SO₂', unit: 'µg/m³', limit: 40 },
    { key: 'co', label: 'CO', unit: 'µg/m³', limit: 1200 },
  ];

  return axes.map((axis) => {
    const rawValue = Math.max(0, metrics[axis.key]);
    const normalized = Math.min(1, Math.round((rawValue / axis.limit) * 100) / 100);
    return {
      key: axis.key,
      label: axis.label,
      rawValue,
      unit: axis.unit,
      referenceLimit: axis.limit,
      normalized,
    };
  });
}

export function getPollutantMeta(key: PollutantKey): {
  label: string;
  unit: string;
  whoLimit: number;
  whoLabel: string;
} {
  switch (key) {
    case 'pm25':
      return { label: 'PM2.5', unit: 'µg/m³', whoLimit: 15, whoLabel: 'WHO 24h (15 µg/m³)' };
    case 'pm10':
      return { label: 'PM10', unit: 'µg/m³', whoLimit: 45, whoLabel: 'WHO 24h (45 µg/m³)' };
    case 'no2':
      return { label: 'NO₂', unit: 'µg/m³', whoLimit: 25, whoLabel: 'WHO 24h (25 µg/m³)' };
    case 'o3':
      return { label: 'O₃', unit: 'µg/m³', whoLimit: 100, whoLabel: 'WHO 8h (100 µg/m³)' };
    default:
      return { label: 'EPA AQI', unit: 'AQI', whoLimit: 50, whoLabel: 'EPA Good Ceiling (50)' };
  }
}

export type StationFilterBand = 'all' | 'good' | 'moderate' | 'elevated';
export type StationSortKey = 'aqi-desc' | 'aqi-asc' | 'pm25-desc' | 'city-asc';

export function filterAndSortStations(
  stations: readonly AirQualityStation[],
  queryText: string,
  band: StationFilterBand,
  sortBy: StationSortKey,
): AirQualityStation[] {
  const normalized = queryText.trim().toLowerCase();

  const filtered = stations.filter((station) => {
    if (normalized) {
      const hay = `${station.city} ${station.district} ${station.country}`.toLowerCase();
      if (!hay.includes(normalized)) return false;
    }

    if (band === 'good') return station.aqi <= 50;
    if (band === 'moderate') return station.aqi > 50 && station.aqi <= 100;
    if (band === 'elevated') return station.aqi > 100;
    return true;
  });

  return [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'aqi-asc':
        return a.aqi - b.aqi;
      case 'pm25-desc':
        return b.metrics.pm25 - a.metrics.pm25;
      case 'city-asc':
        return a.city.localeCompare(b.city);
      case 'aqi-desc':
      default:
        return b.aqi - a.aqi;
    }
  });
}

export const OFFLINE_FALLBACK_STATIONS: AirQualityStation[] = [
  {
    id: 'sf-embarcadero',
    city: 'San Francisco',
    country: 'United States',
    district: 'Embarcadero Basin',
    latitude: 37.7955,
    longitude: -122.3937,
    aqi: 41,
    category: {
      key: 'good',
      label: 'Good',
      shortLabel: 'Good',
      guidance: 'Air quality poses little or no risk for outdoor activity.',
    },
    dominantPollutant: 'PM2.5',
    whoPm25Ratio: 0.5,
    metrics: { pm25: 7.4, pm10: 16.8, no2: 21.5, o3: 68.0, so2: 2.1, co: 245 },
    temperatureC: 16.4,
    humidityPct: 68,
    windKph: 19.2,
    hourly: Array.from({ length: 24 }, (_, idx) => ({
      hourLabel: `${String(idx).padStart(2, '0')}:00`,
      isoTime: new Date(Date.UTC(2026, 10, 19, idx)).toISOString(),
      aqi: 34 + Math.round(Math.sin(idx / 3.5) * 9),
      pm25: Math.round((6.5 + Math.sin(idx / 3.5) * 1.8) * 10) / 10,
      pm10: Math.round((15.2 + Math.sin(idx / 3.5) * 3.1) * 10) / 10,
      no2: Math.round((18.5 + Math.cos(idx / 4) * 5.2) * 10) / 10,
      o3: Math.round((62.0 + Math.sin((idx - 8) / 3.8) * 14) * 10) / 10,
    })),
    bestOutdoorWindow: '03:00 – 05:00',
    source: 'calibrated-baseline',
    updatedAt: '2026-11-19T08:00:00.000Z',
  },
  {
    id: 'tokyo-shibuya',
    city: 'Tokyo',
    country: 'Japan',
    district: 'Shibuya Crossing Corridor',
    latitude: 35.6595,
    longitude: 139.7004,
    aqi: 68,
    category: {
      key: 'moderate',
      label: 'Moderate',
      shortLabel: 'Moderate',
      guidance: 'Acceptable overall; unusually sensitive individuals should monitor symptoms.',
    },
    dominantPollutant: 'PM2.5',
    whoPm25Ratio: 1.2,
    metrics: { pm25: 18.4, pm10: 34.2, no2: 49.5, o3: 76.0, so2: 5.2, co: 420 },
    temperatureC: 15.1,
    humidityPct: 61,
    windKph: 11.4,
    hourly: Array.from({ length: 24 }, (_, idx) => ({
      hourLabel: `${String(idx).padStart(2, '0')}:00`,
      isoTime: new Date(Date.UTC(2026, 10, 19, idx)).toISOString(),
      aqi: 62 + Math.round(Math.sin(idx / 3.2) * 14),
      pm25: Math.round((17.0 + Math.sin(idx / 3.2) * 4.2) * 10) / 10,
      pm10: Math.round((31.0 + Math.sin(idx / 3.2) * 7.5) * 10) / 10,
      no2: Math.round((44.0 + Math.cos(idx / 3.5) * 11.0) * 10) / 10,
      o3: Math.round((71.0 + Math.sin((idx - 8) / 3.8) * 18) * 10) / 10,
    })),
    bestOutdoorWindow: '04:00 – 06:00',
    source: 'calibrated-baseline',
    updatedAt: '2026-11-19T08:00:00.000Z',
  },
];
