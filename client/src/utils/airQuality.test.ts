import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRadarProfile,
  filterAndSortStations,
  getAqiTone,
  getPollutantMeta,
  OFFLINE_FALLBACK_STATIONS,
} from './airQuality';

test('buildRadarProfile normalizes all 6 urban pollutants to 0..1 range', () => {
  const radar = buildRadarProfile({
    pm25: 17.5,
    pm10: 75,
    no2: 40,
    o3: 240,
    so2: 10,
    co: 600,
  });

  assert.equal(radar.length, 6);
  assert.equal(radar[0]?.normalized, 0.5); // pm25 17.5 / 35
  assert.equal(radar[1]?.normalized, 1.0); // pm10 75 / 75
  assert.equal(radar[3]?.normalized, 1.0); // o3 capped at 1.0
});

test('filterAndSortStations searches by city and sorts by AQI cleanly', () => {
  const onlyTokyo = filterAndSortStations(OFFLINE_FALLBACK_STATIONS, 'tokyo', 'all', 'aqi-desc');
  assert.equal(onlyTokyo.length, 1);
  assert.equal(onlyTokyo[0]?.id, 'tokyo-shibuya');

  const ascending = filterAndSortStations(OFFLINE_FALLBACK_STATIONS, '', 'all', 'aqi-asc');
  assert.equal(ascending[0]?.id, 'sf-embarcadero');

  const goodOnly = filterAndSortStations(OFFLINE_FALLBACK_STATIONS, '', 'good', 'aqi-desc');
  assert.equal(goodOnly.length, 1);
  assert.equal(goodOnly[0]?.id, 'sf-embarcadero');
});

test('getAqiTone always pairs color with an explicit accessible glyph', () => {
  const good = getAqiTone('good');
  const hazardous = getAqiTone('hazardous');
  assert.ok(good.glyph.length > 0);
  assert.ok(hazardous.glyph.length > 0);
  assert.notEqual(good.glyph, hazardous.glyph);
});

test('getPollutantMeta supplies WHO guidelines for every tracked series', () => {
  assert.equal(getPollutantMeta('pm25').whoLimit, 15);
  assert.equal(getPollutantMeta('pm10').whoLimit, 45);
  assert.equal(getPollutantMeta('no2').whoLimit, 25);
  assert.equal(getPollutantMeta('o3').whoLimit, 100);
  assert.equal(getPollutantMeta('aqi').whoLimit, 50);
});
