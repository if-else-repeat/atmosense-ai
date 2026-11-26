/**
 * @module airQualityGeolocation
 * Reverse geocoding (BigDataCloud -> Nominatim) and IP geolocation fallback (ipwho.is -> geojs.io).
 */

export interface ReverseGeocodedPlace {
  city: string;
  country: string;
  district: string;
}

export async function fetchJsonWithTimeout<T>(
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

/** Resolves human-readable city, country, and locality/district name from coordinates. */
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
    return { city, country: bdc.countryName || 'Local', district };
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
    return { city, country: addr.country || 'Local', district };
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

/** Fallback IP geolocation when browser GPS permission is blocked or unavailable. */
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
