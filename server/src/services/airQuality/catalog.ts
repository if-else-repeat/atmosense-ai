/**
 * @module airQualityCatalog
 * Curated global urban monitoring station seeds and deterministic diurnal hourly series builder.
 */

import type { AirQualityStation, HourlyPoint, PollutantMetrics } from '../../types/airQuality.ts';
import {
  classifyAqi,
  computeCompositeAqi,
  computeWhoRatio,
  findBestOutdoorWindow,
} from '../../utils/aqi.ts';

export interface StationSeed {
  id: string;
  city: string;
  country: string;
  district: string;
  latitude: number;
  longitude: number;
  baseMetrics: PollutantMetrics;
  temperatureC: number;
  humidityPct: number;
  windKph: number;
}

export const URBAN_STATIONS: readonly StationSeed[] = [
  {
    id: 'sf-embarcadero',
    city: 'San Francisco',
    country: 'United States',
    district: 'Embarcadero Basin',
    latitude: 37.7955,
    longitude: -122.3937,
    baseMetrics: { pm25: 7.4, pm10: 16.8, no2: 21.5, o3: 68.0, so2: 2.1, co: 245 },
    temperatureC: 16.4,
    humidityPct: 68,
    windKph: 19.2,
  },
  {
    id: 'nyc-midtown',
    city: 'New York',
    country: 'United States',
    district: 'Midtown Manhattan',
    latitude: 40.7549,
    longitude: -73.984,
    baseMetrics: { pm25: 14.8, pm10: 27.4, no2: 46.2, o3: 59.5, so2: 4.8, co: 390 },
    temperatureC: 11.2,
    humidityPct: 56,
    windKph: 14.5,
  },
  {
    id: 'london-westminster',
    city: 'London',
    country: 'United Kingdom',
    district: 'Westminster Marylebone',
    latitude: 51.5225,
    longitude: -0.1546,
    baseMetrics: { pm25: 11.2, pm10: 22.6, no2: 41.8, o3: 54.0, so2: 3.4, co: 315 },
    temperatureC: 9.8,
    humidityPct: 74,
    windKph: 16.1,
  },
  {
    id: 'berlin-mitte',
    city: 'Berlin',
    country: 'Germany',
    district: 'Mitte Alexanderplatz',
    latitude: 52.5219,
    longitude: 13.4132,
    baseMetrics: { pm25: 13.6, pm10: 25.1, no2: 34.4, o3: 62.0, so2: 3.9, co: 295 },
    temperatureC: 7.5,
    humidityPct: 71,
    windKph: 12.8,
  },
  {
    id: 'tokyo-shibuya',
    city: 'Tokyo',
    country: 'Japan',
    district: 'Shibuya Crossing Corridor',
    latitude: 35.6595,
    longitude: 139.7004,
    baseMetrics: { pm25: 18.4, pm10: 34.2, no2: 49.5, o3: 76.0, so2: 5.2, co: 420 },
    temperatureC: 15.1,
    humidityPct: 61,
    windKph: 11.4,
  },
  {
    id: 'seoul-gangnam',
    city: 'Seoul',
    country: 'South Korea',
    district: 'Gangnam Teheran-ro',
    latitude: 37.5013,
    longitude: 127.0397,
    baseMetrics: { pm25: 38.6, pm10: 68.5, no2: 58.2, o3: 72.0, so2: 7.8, co: 530 },
    temperatureC: 10.6,
    humidityPct: 52,
    windKph: 8.7,
  },
  {
    id: 'singapore-marina',
    city: 'Singapore',
    country: 'Singapore',
    district: 'Marina Bay South',
    latitude: 1.2834,
    longitude: 103.8607,
    baseMetrics: { pm25: 22.1, pm10: 41.0, no2: 37.6, o3: 81.0, so2: 9.4, co: 465 },
    temperatureC: 29.4,
    humidityPct: 79,
    windKph: 10.2,
  },
  {
    id: 'delhi-connaught',
    city: 'New Delhi',
    country: 'India',
    district: 'Connaught Place Central',
    latitude: 28.6315,
    longitude: 77.2167,
    baseMetrics: { pm25: 94.5, pm10: 178.0, no2: 76.4, o3: 64.0, so2: 18.2, co: 1120 },
    temperatureC: 23.8,
    humidityPct: 48,
    windKph: 5.9,
  },
];

export function buildHourlySeries(
  seed: StationSeed,
  liveMetrics?: PollutantMetrics,
): HourlyPoint[] {
  const base = liveMetrics ?? seed.baseMetrics;
  const now = new Date();
  const points: HourlyPoint[] = [];

  for (let offset = 23; offset >= 0; offset--) {
    const dt = new Date(now.getTime() - offset * 60 * 60 * 1000);
    const hour = dt.getUTCHours();
    const rushFactor =
      Math.exp(-Math.pow((hour - 8) / 2.6, 2)) * 0.24 +
      Math.exp(-Math.pow((hour - 19) / 3.0, 2)) * 0.31;
    const ozoneWave = Math.max(0.65, 0.78 + Math.sin(((hour - 9) / 24) * Math.PI * 2) * 0.34);
    const pmFactor = 0.84 + rushFactor;

    const pm25 = Math.round(base.pm25 * pmFactor * 10) / 10;
    const pm10 = Math.round(base.pm10 * (0.86 + rushFactor * 0.9) * 10) / 10;
    const no2 = Math.round(base.no2 * (0.76 + rushFactor * 1.35) * 10) / 10;
    const o3 = Math.round(base.o3 * ozoneWave * 10) / 10;

    const composite = computeCompositeAqi({ pm25, pm10, no2, o3, so2: base.so2, co: base.co });
    const hh = String(hour).padStart(2, '0');
    points.push({
      hourLabel: `${hh}:00`,
      isoTime: dt.toISOString(),
      aqi: composite.aqi,
      pm25,
      pm10,
      no2,
      o3,
    });
  }

  return points;
}

export function hydrateStation(
  seed: StationSeed,
  metrics: PollutantMetrics,
  source: 'live-open-meteo' | 'calibrated-baseline',
): AirQualityStation {
  const { aqi, dominantPollutant } = computeCompositeAqi(metrics);
  const hourly = buildHourlySeries(seed, metrics);
  return {
    id: seed.id,
    city: seed.city,
    country: seed.country,
    district: seed.district,
    latitude: seed.latitude,
    longitude: seed.longitude,
    aqi,
    category: classifyAqi(aqi),
    dominantPollutant,
    whoPm25Ratio: computeWhoRatio(metrics.pm25),
    metrics,
    temperatureC: seed.temperatureC,
    humidityPct: seed.humidityPct,
    windKph: seed.windKph,
    hourly,
    bestOutdoorWindow: findBestOutdoorWindow(hourly),
    source,
    updatedAt: new Date().toISOString(),
  };
}
