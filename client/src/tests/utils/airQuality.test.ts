import { describe, expect, it } from 'vitest';
import {
  buildRadarProfile,
  filterAndSortStations,
  getAqiTone,
  getPollutantMeta,
  OFFLINE_FALLBACK_STATIONS,
} from '../../utils/airQuality';

describe('Client airQuality utilities', () => {
  it('normalizes all 6 urban pollutants to 0..1 range in radar profile', () => {
    const radar = buildRadarProfile({
      pm25: 17.5,
      pm10: 75,
      no2: 40,
      o3: 240,
      so2: 10,
      co: 600,
    });

    expect(radar).toHaveLength(6);
    expect(radar[0]?.normalized).toBe(0.5);
    expect(radar[1]?.normalized).toBe(1.0);
    expect(radar[3]?.normalized).toBe(1.0);
  });

  it('filters stations by city and category and sorts by AQI cleanly', () => {
    const onlyTokyo = filterAndSortStations(OFFLINE_FALLBACK_STATIONS, 'tokyo', 'all', 'aqi-desc');
    expect(onlyTokyo).toHaveLength(1);
    expect(onlyTokyo[0]?.id).toBe('tokyo-shibuya');

    const ascending = filterAndSortStations(OFFLINE_FALLBACK_STATIONS, '', 'all', 'aqi-asc');
    expect(ascending[0]?.id).toBe('sf-embarcadero');

    const goodOnly = filterAndSortStations(OFFLINE_FALLBACK_STATIONS, '', 'good', 'aqi-desc');
    expect(goodOnly).toHaveLength(1);
    expect(goodOnly[0]?.id).toBe('sf-embarcadero');
  });

  it('always pairs AQI color with an explicit accessible glyph', () => {
    const good = getAqiTone('good');
    const hazardous = getAqiTone('hazardous');
    expect(good.glyph.length).toBeGreaterThan(0);
    expect(hazardous.glyph.length).toBeGreaterThan(0);
    expect(good.glyph).not.toBe(hazardous.glyph);
  });

  it('supplies WHO guidelines for every tracked series', () => {
    expect(getPollutantMeta('pm25').whoLimit).toBe(15);
    expect(getPollutantMeta('pm10').whoLimit).toBe(45);
    expect(getPollutantMeta('no2').whoLimit).toBe(25);
    expect(getPollutantMeta('o3').whoLimit).toBe(100);
    expect(getPollutantMeta('aqi').whoLimit).toBe(50);
  });
});
