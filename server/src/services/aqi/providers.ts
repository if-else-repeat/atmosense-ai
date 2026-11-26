/**
 * @module aqiProviders
 * Individual upstream AQI and forecast provider fetch adapters (WAQI, OpenAQ, OpenWeather).
 */

import { parseOpenWeatherForecast, parseWAQIForecast } from './forecastParsers.ts';
import { fetchUpstreamJson, type UpstreamFetchContext } from './httpClient.ts';
import {
  parseOpenAQReading,
  parseOpenWeatherReading,
  parseWAQIReading,
  type OpenAQResponse,
  type OpenWeatherResponse,
  type WAQIResponse,
} from './parsers.ts';
import type { AirQualityData, ForecastData } from './types.ts';
import { isConfiguredSecret } from './utils.ts';

export interface ProviderCredentials {
  waqiToken?: string;
  openAqApiKey?: string;
  openWeatherApiKey?: string;
  hasCustomFetch: boolean;
  now: () => number;
}

export async function fetchReadingFromWAQI(
  ctx: UpstreamFetchContext,
  creds: ProviderCredentials,
  lat: number,
  lng: number,
): Promise<AirQualityData | null> {
  if (!isConfiguredSecret(creds.waqiToken)) {
    ctx.logger.warn('Skipping WAQI source: WAQI_API_TOKEN is not configured');
    return null;
  }
  const url = `https://api.waqi.info/feed/geo:${lat};${lng}/?token=${encodeURIComponent(creds.waqiToken)}`;
  const payload = await fetchUpstreamJson<WAQIResponse>(ctx, 'WAQI', url);
  return parseWAQIReading(payload, lat, lng, creds.now);
}

export async function fetchReadingFromOpenAQ(
  ctx: UpstreamFetchContext,
  creds: ProviderCredentials,
  lat: number,
  lng: number,
): Promise<AirQualityData | null> {
  if (ctx.retiredSources.has('OpenAQ')) return null;
  if (!creds.hasCustomFetch && !isConfiguredSecret(creds.openAqApiKey)) return null;

  const url = `https://api.openaq.org/v2/latest?coordinates=${lat},${lng}&radius=10000`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (isConfiguredSecret(creds.openAqApiKey)) headers['X-API-Key'] = creds.openAqApiKey;

  const payload = await fetchUpstreamJson<OpenAQResponse>(ctx, 'OpenAQ', url, { headers });
  return parseOpenAQReading(payload, lat, lng, creds.now);
}

export async function fetchReadingFromOpenWeather(
  ctx: UpstreamFetchContext,
  creds: ProviderCredentials,
  lat: number,
  lng: number,
): Promise<AirQualityData | null> {
  if (!isConfiguredSecret(creds.openWeatherApiKey)) {
    ctx.logger.warn('Skipping OpenWeather source: OPENWEATHER_API_KEY is not configured');
    return null;
  }
  const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lng}&appid=${encodeURIComponent(creds.openWeatherApiKey)}`;
  const payload = await fetchUpstreamJson<OpenWeatherResponse>(ctx, 'OpenWeather', url);
  return parseOpenWeatherReading(payload, lat, lng, creds.now);
}

export async function fetchForecastFromWAQI(
  ctx: UpstreamFetchContext,
  creds: ProviderCredentials,
  lat: number,
  lng: number,
): Promise<ForecastData[] | null> {
  if (!isConfiguredSecret(creds.waqiToken)) return null;
  const url = `https://api.waqi.info/feed/geo:${lat};${lng}/?token=${encodeURIComponent(creds.waqiToken)}`;
  const payload = await fetchUpstreamJson<WAQIResponse>(ctx, 'WAQI', url);
  return parseWAQIForecast(payload, creds.now);
}

export async function fetchForecastFromOpenWeather(
  ctx: UpstreamFetchContext,
  creds: ProviderCredentials,
  lat: number,
  lng: number,
): Promise<ForecastData[] | null> {
  if (!isConfiguredSecret(creds.openWeatherApiKey)) return null;
  const url = `https://api.openweathermap.org/data/2.5/air_pollution/forecast?lat=${lat}&lon=${lng}&appid=${encodeURIComponent(creds.openWeatherApiKey)}`;
  const payload = await fetchUpstreamJson<OpenWeatherResponse>(ctx, 'OpenWeather', url);
  return parseOpenWeatherForecast(payload);
}
