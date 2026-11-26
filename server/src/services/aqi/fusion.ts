/**
 * @module aqiFusion
 * Multi-source weighted consensus fusion with >50% outlier detection/dampening and provenance trail.
 */

import {
  AQIServiceError,
  type AQILogger,
  type AQISourceName,
  type AirQualityData,
  type SourceProvenance,
} from './types.ts';
import { computeMedian, roundTo } from './utils.ts';

export interface FusionConfig {
  outlierThreshold: number;
  outlierWeightFactor: number;
  logger: AQILogger;
}

/**
 * Fuses one or more validated upstream readings using reliability weights
 * and >50% outlier detection/down-weighting, preserving complete data provenance.
 */
export function fuseAirQualityReadings(
  readings: AirQualityData[],
  config: FusionConfig,
): AirQualityData {
  if (readings.length === 0) {
    throw new AQIServiceError('Cannot fuse an empty list of air quality readings.', 500);
  }

  const ordered = [...readings].sort((a, b) => b.confidence - a.confidence);
  const primary = ordered[0];
  if (!primary) {
    throw new AQIServiceError('Primary air quality reading missing during fusion.', 500);
  }

  if (ordered.length === 1) {
    const singleProvenance: SourceProvenance = {
      source: (primary.source as AQISourceName) || 'WAQI',
      aqi: primary.aqi,
      pm25: primary.pm25,
      pm10: primary.pm10,
      timestamp: primary.timestamp,
      reliability: primary.confidence,
      appliedWeight: 1,
      isOutlier: false,
      deviationPercent: 0,
    };
    return { ...primary, provenance: [singleProvenance] };
  }

  const baselineAqi = ordered.length >= 3 ? computeMedian(ordered.map((r) => r.aqi)) : primary.aqi;

  const rawWeights = ordered.map((reading) => {
    const denominator = Math.max(baselineAqi, 1);
    const deviationRatio = Math.abs(reading.aqi - baselineAqi) / denominator;
    const isOutlier = deviationRatio > config.outlierThreshold;
    const baseWeight = Math.max(0.1, Math.min(1, reading.confidence));
    const adjustedWeight = isOutlier ? baseWeight * config.outlierWeightFactor : baseWeight;

    if (isOutlier) {
      config.logger.warn('Outlier air quality reading detected and down-weighted', {
        source: reading.source,
        readingAqi: reading.aqi,
        baselineAqi,
        deviationPercent: roundTo(deviationRatio * 100, 1),
      });
    }

    return {
      reading,
      weight: adjustedWeight,
      isOutlier,
      deviationPercent: roundTo(deviationRatio * 100, 1),
    };
  });

  const totalWeight = rawWeights.reduce((sum, item) => sum + item.weight, 0);
  let aqi = 0;
  let pm25 = 0;
  let pm10 = 0;
  let no2 = 0;
  let co = 0;
  let o3 = 0;
  let so2 = 0;
  let weightedReliability = 0;
  let outlierCount = 0;

  const provenance: SourceProvenance[] = rawWeights.map((item) => {
    const normalizedWeight = totalWeight > 0 ? item.weight / totalWeight : 1 / rawWeights.length;
    aqi += item.reading.aqi * normalizedWeight;
    pm25 += item.reading.pm25 * normalizedWeight;
    pm10 += item.reading.pm10 * normalizedWeight;
    no2 += item.reading.no2 * normalizedWeight;
    co += item.reading.co * normalizedWeight;
    o3 += item.reading.o3 * normalizedWeight;
    so2 += item.reading.so2 * normalizedWeight;
    weightedReliability += item.reading.confidence * normalizedWeight;
    if (item.isOutlier) outlierCount += 1;

    return {
      source: item.reading.source as AQISourceName,
      aqi: item.reading.aqi,
      pm25: item.reading.pm25,
      pm10: item.reading.pm10,
      timestamp: item.reading.timestamp,
      reliability: item.reading.confidence,
      appliedWeight: roundTo(normalizedWeight, 4),
      isOutlier: item.isOutlier,
      deviationPercent: item.deviationPercent,
    };
  });

  const agreementBonus = outlierCount === 0 ? Math.min(0.06, (ordered.length - 1) * 0.03) : 0;
  const outlierPenalty = outlierCount * 0.05;
  const finalConfidence = roundTo(
    Math.max(0.1, Math.min(0.99, weightedReliability + agreementBonus - outlierPenalty)),
    3,
  );

  return {
    aqi: Math.min(500, Math.max(0, Math.round(aqi))),
    pm25: roundTo(pm25, 2),
    pm10: roundTo(pm10, 2),
    no2: roundTo(no2, 2),
    co: roundTo(co, 3),
    o3: roundTo(o3, 4),
    so2: roundTo(so2, 2),
    source: ordered.map((r) => r.source).join('+'),
    timestamp: Math.max(...ordered.map((r) => r.timestamp)),
    location: { ...primary.location },
    confidence: finalConfidence,
    provenance,
  };
}
