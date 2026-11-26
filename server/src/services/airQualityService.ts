import { aqiService } from './aqiService.ts';
import type { AirQualityStation, HourlyPoint, PollutantMetrics } from '../types/airQuality.ts';
import {
  classifyAqi,
  computeCompositeAqi,
  computeWhoRatio,
  findBestOutdoorWindow,
} from '../utils/aqi.ts';

interface StationSeed {
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

const URBAN_STATIONS: readonly StationSeed[] = [
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

interface CachedStations {
  stations: AirQualityStation[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let stationCache: CachedStations | null = null;
const dynamicStationCache = new Map<string, { station: AirQualityStation; fetchedAt: number }>();

function buildHourlySeries(seed: StationSeed, liveMetrics?: PollutantMetrics): HourlyPoint[] {
  const base = liveMetrics ?? seed.baseMetrics;
  const now = new Date();
  const points: HourlyPoint[] = [];

  for (let offset = 23; offset >= 0; offset--) {
    const dt = new Date(now.getTime() - offset * 60 * 60 * 1000);
    const hour = dt.getUTCHours();
    // Diurnal modulation: morning rush (7-9), evening inversion (18-21), afternoon ozone (13-16)
    const rushFactor =
      Math.exp(-Math.pow((hour - 8) / 2.6, 2)) * 0.24 +
      Math.exp(-Math.pow((hour - 19) / 3.0, 2)) * 0.31;
    const ozoneWave = Math.max(0.65, 0.78 + Math.sin(((hour - 9) / 24) * Math.PI * 2) * 0.34);
    const pmFactor = 0.84 + rushFactor;

    const pm25 = Math.round(base.pm25 * pmFactor * 10) / 10;
    const pm10 = Math.round(base.pm10 * (0.86 + rushFactor * 0.9) * 10) / 10;
    const no2 = Math.round(base.no2 * (0.76 + rushFactor * 1.35) * 10) / 10;
    const o3 = Math.round(base.o3 * ozoneWave * 10) / 10;

    const composite = computeCompositeAqi({
      pm25,
      pm10,
      no2,
      o3,
      so2: base.so2,
      co: base.co,
    });

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

interface OpenMeteoCurrent {
  pm2_5?: number;
  pm10?: number;
  nitrogen_dioxide?: number;
  ozone?: number;
  sulphur_dioxide?: number;
  carbon_monoxide?: number;
}

interface OpenMeteoHourly {
  time?: string[];
  pm2_5?: Array<number | null>;
  pm10?: Array<number | null>;
  nitrogen_dioxide?: Array<number | null>;
  ozone?: Array<number | null>;
}

interface OpenMeteoResponse {
  current?: OpenMeteoCurrent;
  hourly?: OpenMeteoHourly;
}

interface OpenMeteoWeatherResponse {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
  };
}

export interface ReverseGeocodedPlace {
  city: string;
  country: string;
  district: string;
}

async function fetchJsonWithTimeout<T>(
  url: string,
  timeoutMs = 3000,
  headers: Record<string, string> = { Accept: 'application/json' },
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchLiveMetricsWithForecast(
  latitude: number,
  longitude: number,
  fallbackMetrics: PollutantMetrics,
): Promise<{ metrics: PollutantMetrics; hourly: HourlyPoint[] } | null> {
  const endpoint =
    process.env.OPEN_METEO_AQ_URL ?? 'https://air-quality-api.open-meteo.com/v1/air-quality';
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    current: 'pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide',
    hourly: 'pm2_5,pm10,nitrogen_dioxide,ozone',
    forecast_hours: '24',
    timezone: 'auto',
  });

  const payload = await fetchJsonWithTimeout<OpenMeteoResponse>(
    `${endpoint}?${params.toString()}`,
    3200,
  );
  const cur = payload?.current;
  if (!cur || typeof cur.pm2_5 !== 'number' || typeof cur.pm10 !== 'number') {
    return null;
  }

  const metrics: PollutantMetrics = {
    pm25: Math.round(Math.max(0, cur.pm2_5) * 10) / 10,
    pm10: Math.round(Math.max(0, cur.pm10) * 10) / 10,
    no2: Math.round(Math.max(0, cur.nitrogen_dioxide ?? fallbackMetrics.no2) * 10) / 10,
    o3: Math.round(Math.max(0, cur.ozone ?? fallbackMetrics.o3) * 10) / 10,
    so2: Math.round(Math.max(0, cur.sulphur_dioxide ?? fallbackMetrics.so2) * 10) / 10,
    co: Math.round(Math.max(0, cur.carbon_monoxide ?? fallbackMetrics.co)),
  };

  const hourly: HourlyPoint[] = [];
  const h = payload?.hourly;
  if (h?.time && Array.isArray(h.time) && h.time.length >= 12) {
    const count = Math.min(24, h.time.length);
    for (let i = 0; i < count; i += 1) {
      const isoTime = h.time[i] ?? new Date(Date.now() + i * 3_600_000).toISOString();
      const pm25 = Math.round(Math.max(0, h.pm2_5?.[i] ?? metrics.pm25) * 10) / 10;
      const pm10 = Math.round(Math.max(0, h.pm10?.[i] ?? metrics.pm10) * 10) / 10;
      const no2 = Math.round(Math.max(0, h.nitrogen_dioxide?.[i] ?? metrics.no2) * 10) / 10;
      const o3 = Math.round(Math.max(0, h.ozone?.[i] ?? metrics.o3) * 10) / 10;
      const composite = computeCompositeAqi({
        pm25,
        pm10,
        no2,
        o3,
        so2: metrics.so2,
        co: metrics.co,
      });
      const hhMatch = /T(\d{2}:\d{2})/.exec(isoTime);
      const hourLabel = hhMatch ? hhMatch[1]! : `${String(i).padStart(2, '0')}:00`;
      hourly.push({
        hourLabel,
        isoTime,
        aqi: composite.aqi,
        pm25,
        pm10,
        no2,
        o3,
      });
    }
  }

  return { metrics, hourly };
}

async function fetchLiveWeather(
  latitude: number,
  longitude: number,
): Promise<{ temperatureC: number; humidityPct: number; windKph: number } | null> {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    current: 'temperature_2m,relative_humidity_2m,wind_speed_10m',
    timezone: 'auto',
  });
  const payload = await fetchJsonWithTimeout<OpenMeteoWeatherResponse>(
    `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
    2800,
  );
  const cur = payload?.current;
  if (!cur || typeof cur.temperature_2m !== 'number') return null;
  return {
    temperatureC: Math.round(cur.temperature_2m * 10) / 10,
    humidityPct: Math.round(cur.relative_humidity_2m ?? 55),
    windKph: Math.round((cur.wind_speed_10m ?? 10) * 10) / 10,
  };
}

/**
 * Resolves human-readable city, country, and locality/district name from coordinates
 * using free reverse geocoding APIs (BigDataCloud -> OpenStreetMap Nominatim).
 */
export async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodedPlace> {
  const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}&localityLanguage=en`;
  const bdc = await fetchJsonWithTimeout<{
    city?: string;
    locality?: string;
    principalSubdivision?: string;
    countryName?: string;
  }>(bdcUrl, 2600);

  if (bdc && (bdc.city || bdc.locality || bdc.principalSubdivision)) {
    const city = bdc.city || bdc.locality || bdc.principalSubdivision || 'Current Location';
    const district =
      bdc.locality && bdc.locality !== city
        ? bdc.locality
        : bdc.principalSubdivision || 'Local Area';
    const country = bdc.countryName || 'Local';
    return { city, country, district };
  }

  const nomUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude.toFixed(4)}&lon=${longitude.toFixed(4)}`;
  const nom = await fetchJsonWithTimeout<{
    address?: {
      city?: string;
      town?: string;
      village?: string;
      suburb?: string;
      neighbourhood?: string;
      county?: string;
      state?: string;
      country?: string;
    };
  }>(nomUrl, 2600, {
    Accept: 'application/json',
    'User-Agent': 'AtmoSenseAI/1.0 (urban-air-quality-assistant)',
  });

  if (nom?.address) {
    const addr = nom.address;
    const city =
      addr.city || addr.town || addr.village || addr.county || addr.state || 'My Location';
    const district =
      addr.suburb || addr.neighbourhood || addr.county || addr.state || 'Local Sensor';
    const country = addr.country || 'Local';
    return { city, country, district };
  }

  return {
    city: 'Current Location',
    country: `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`,
    district: 'Live GPS Coordinates',
  };
}

function isPrivateOrLoopbackIp(ip: string): boolean {
  const cleaned = ip.replace(/^::ffff:/, '').trim();
  if (!cleaned || cleaned === '::1' || cleaned === 'localhost') return true;
  if (cleaned.startsWith('127.') || cleaned.startsWith('10.') || cleaned.startsWith('192.168.')) {
    return true;
  }
  const match172 = /^172\.(\d+)\./.exec(cleaned);
  if (match172) {
    const second = Number(match172[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return cleaned.startsWith('fc') || cleaned.startsWith('fd') || cleaned.startsWith('fe80');
}

/**
 * Fallback IP geolocation when browser GPS permission is blocked or unavailable.
 */
export async function detectLocationByIp(rawIp?: string): Promise<{
  latitude: number;
  longitude: number;
  city: string;
  country: string;
  district: string;
} | null> {
  const candidateIp =
    rawIp
      ?.split(',')[0]
      ?.trim()
      .replace(/^::ffff:/, '') ?? '';
  const queryIp = candidateIp && !isPrivateOrLoopbackIp(candidateIp) ? candidateIp : '';

  // Primary: ipwho.is (free HTTPS, no API key required)
  const ipWhoUrl = queryIp
    ? `https://ipwho.is/${encodeURIComponent(queryIp)}`
    : 'https://ipwho.is/';
  const ipWho = await fetchJsonWithTimeout<{
    success?: boolean;
    latitude?: number;
    longitude?: number;
    city?: string;
    region?: string;
    country?: string;
  }>(ipWhoUrl, 3000);

  if (ipWho?.success && typeof ipWho.latitude === 'number' && typeof ipWho.longitude === 'number') {
    return {
      latitude: ipWho.latitude,
      longitude: ipWho.longitude,
      city: ipWho.city || ipWho.region || 'Detected Location',
      country: ipWho.country || 'Local',
      district: ipWho.region || 'IP-Detected Area',
    };
  }

  // Secondary: geojs.io (free HTTPS, no API key required)
  const geoJsUrl = queryIp
    ? `https://get.geojs.io/v1/ip/geo/${encodeURIComponent(queryIp)}.json`
    : 'https://get.geojs.io/v1/ip/geo.json';
  const geoJs = await fetchJsonWithTimeout<{
    latitude?: string;
    longitude?: string;
    city?: string;
    region?: string;
    country?: string;
  }>(geoJsUrl, 3000);

  if (geoJs?.latitude && geoJs?.longitude) {
    const lat = Number(geoJs.latitude);
    const lng = Number(geoJs.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return {
        latitude: lat,
        longitude: lng,
        city: geoJs.city || geoJs.region || 'Detected Location',
        country: geoJs.country || 'Local',
        district: geoJs.region || 'IP-Detected Area',
      };
    }
  }

  return null;
}

/**
 * Fetches live air quality, 24-hour hourly forecast, weather, and reverse-geocoded place name
 * for ANY latitude/longitude coordinates on Earth.
 */
export async function getStationByCoordinates(
  latitude: number,
  longitude: number,
  options: {
    id?: string;
    placeHint?: Partial<ReverseGeocodedPlace>;
    forceRefresh?: boolean;
  } = {},
): Promise<AirQualityStation> {
  const id = options.id ?? 'current-location';
  const cacheKey = `${id}:${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  const cached = dynamicStationCache.get(cacheKey);
  if (!options.forceRefresh && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    dynamicStationCache.set(id, cached);
    return cached.station;
  }

  const fallbackMetrics: PollutantMetrics = {
    pm25: 14.5,
    pm10: 29.0,
    no2: 24.0,
    o3: 58.0,
    so2: 4.5,
    co: 320,
  };

  const [multiSource, aqResult, weatherResult, geocoded] = await Promise.all([
    aqiService.getCurrentAQI(latitude, longitude).catch(() => null),
    fetchLiveMetricsWithForecast(latitude, longitude, fallbackMetrics),
    fetchLiveWeather(latitude, longitude),
    options.placeHint?.city && options.placeHint?.country
      ? Promise.resolve({
          city: options.placeHint.city,
          country: options.placeHint.country,
          district: options.placeHint.district || 'Current Location',
        })
      : reverseGeocodeCoordinates(latitude, longitude),
  ]);

  // Prefer live multi-source fused AQI (WAQI/OpenAQ/OpenWeather) when available so
  // dropdown, Map markers, Family/Community tabs, and Dashboard match 1-to-1.
  const metrics: PollutantMetrics = multiSource
    ? {
        pm25: Math.round(Math.max(0, multiSource.pm25) * 10) / 10,
        pm10: Math.round(Math.max(0, multiSource.pm10) * 10) / 10,
        no2: Math.round(Math.max(0, multiSource.no2 * 1.88) * 10) / 10,
        o3: Math.round(Math.max(0, multiSource.o3 * 1960) * 10) / 10,
        so2: Math.round(Math.max(0, multiSource.so2 * 2.62) * 10) / 10,
        co: Math.round(Math.max(0, multiSource.co * 1000)),
      }
    : (aqResult?.metrics ?? fallbackMetrics);

  const seed: StationSeed = {
    id,
    city: geocoded.city,
    country: geocoded.country,
    district: geocoded.district,
    latitude: Math.round(latitude * 10000) / 10000,
    longitude: Math.round(longitude * 10000) / 10000,
    baseMetrics: metrics,
    temperatureC: weatherResult?.temperatureC ?? 22.0,
    humidityPct: weatherResult?.humidityPct ?? 55,
    windKph: weatherResult?.windKph ?? 10.5,
  };

  const composite = computeCompositeAqi(metrics);
  const aqi =
    multiSource && Number.isFinite(multiSource.aqi) && multiSource.aqi >= 0
      ? Math.round(multiSource.aqi)
      : composite.aqi;
  const dominantPollutant = composite.dominantPollutant;
  const hourly =
    aqResult?.hourly && aqResult.hourly.length >= 12
      ? aqResult.hourly
      : buildHourlySeries(seed, metrics);

  const station: AirQualityStation = {
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
    source: multiSource || aqResult ? 'live-open-meteo' : 'calibrated-baseline',
    updatedAt: new Date().toISOString(),
  };

  const entry = { station, fetchedAt: Date.now() };
  dynamicStationCache.set(cacheKey, entry);
  dynamicStationCache.set(id, entry);
  return station;
}

async function fetchLiveMetrics(seed: StationSeed): Promise<PollutantMetrics | null> {
  const endpoint =
    process.env.OPEN_METEO_AQ_URL ?? 'https://air-quality-api.open-meteo.com/v1/air-quality';
  const params = new URLSearchParams({
    latitude: String(seed.latitude),
    longitude: String(seed.longitude),
    current: 'pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide',
  });

  const payload = await fetchJsonWithTimeout<OpenMeteoResponse>(
    `${endpoint}?${params.toString()}`,
    2200,
  );
  const cur = payload?.current;
  if (!cur || typeof cur.pm2_5 !== 'number' || typeof cur.pm10 !== 'number') {
    return null;
  }
  return {
    pm25: Math.round(Math.max(0, cur.pm2_5) * 10) / 10,
    pm10: Math.round(Math.max(0, cur.pm10) * 10) / 10,
    no2: Math.round(Math.max(0, cur.nitrogen_dioxide ?? seed.baseMetrics.no2) * 10) / 10,
    o3: Math.round(Math.max(0, cur.ozone ?? seed.baseMetrics.o3) * 10) / 10,
    so2: Math.round(Math.max(0, cur.sulphur_dioxide ?? seed.baseMetrics.so2) * 10) / 10,
    co: Math.round(Math.max(0, cur.carbon_monoxide ?? seed.baseMetrics.co)),
  };
}

function hydrateStation(
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

export async function getAllStations(forceRefresh = false): Promise<AirQualityStation[]> {
  if (!forceRefresh && stationCache && Date.now() - stationCache.fetchedAt < CACHE_TTL_MS) {
    return stationCache.stations;
  }

  const results = await Promise.all(
    URBAN_STATIONS.map(async (seed) => {
      const live = await fetchLiveMetrics(seed);
      if (live) {
        return hydrateStation(seed, live, 'live-open-meteo');
      }
      return hydrateStation(seed, seed.baseMetrics, 'calibrated-baseline');
    }),
  );

  stationCache = { stations: results, fetchedAt: Date.now() };
  return results;
}

export async function getStationById(
  stationId: string,
  forceRefresh = false,
): Promise<AirQualityStation | null> {
  const dynamic = dynamicStationCache.get(stationId);
  if (dynamic) {
    if (!forceRefresh && Date.now() - dynamic.fetchedAt < CACHE_TTL_MS) {
      return dynamic.station;
    }
    return getStationByCoordinates(dynamic.station.latitude, dynamic.station.longitude, {
      id: stationId,
      forceRefresh,
    });
  }

  const stations = await getAllStations(forceRefresh);
  return stations.find((station) => station.id === stationId) ?? null;
}
