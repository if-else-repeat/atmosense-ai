/**
 * @module aqiParserTypes
 * Upstream response payload interfaces for WAQI, OpenAQ, and OpenWeather air-quality feeds.
 */

export type WAQIDailySeries = Array<{ avg?: number; day?: string; max?: number; min?: number }>;

export interface WAQIResponse {
  status?: string;
  data?: {
    aqi?: number | string;
    city?: { geo?: [number, number]; name?: string };
    time?: { v?: number; iso?: string };
    iaqi?: Record<string, { v?: number }>;
    forecast?: {
      daily?: { pm25?: WAQIDailySeries; pm10?: WAQIDailySeries; o3?: WAQIDailySeries };
    };
  };
}

export interface OpenAQResponse {
  results?: Array<{
    location?: string;
    city?: string;
    coordinates?: { latitude?: number; longitude?: number };
    measurements?: Array<{
      parameter?: string;
      value?: number;
      unit?: string;
      lastUpdated?: string;
    }>;
  }>;
}

export interface OpenWeatherResponse {
  coord?: { lat?: number; lon?: number };
  list?: Array<{
    dt?: number;
    main?: { aqi?: number };
    components?: {
      co?: number;
      no2?: number;
      o3?: number;
      so2?: number;
      pm2_5?: number;
      pm10?: number;
    };
  }>;
}
