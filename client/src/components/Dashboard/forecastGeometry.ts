import type { ForecastHourlyPoint } from '../../types/aqi';

export const CHART_WIDTH = 760;
export const CHART_HEIGHT = 248;
export const CHART_PAD = { top: 20, right: 20, bottom: 34, left: 46 } as const;

export interface ForecastCoord {
  x: number;
  y: number;
  point: ForecastHourlyPoint;
  isSafeWindow: boolean;
}

export interface ForecastGeometry {
  maxY: number;
  yTicks: number[];
  coords: ForecastCoord[];
  linePath: string;
  areaPath: string;
}

export interface ForecastSummaryStats {
  minPt: ForecastHourlyPoint;
  maxPt: ForecastHourlyPoint;
}

/**
 * Computes SVG coordinates, axis ticks, and path strings for the 24-hour forecast chart.
 */
export function buildForecastGeometry(points: ForecastHourlyPoint[]): ForecastGeometry {
  const plotW = CHART_WIDTH - CHART_PAD.left - CHART_PAD.right;
  const plotH = CHART_HEIGHT - CHART_PAD.top - CHART_PAD.bottom;

  if (points.length === 0) {
    return {
      maxY: 200,
      yTicks: [0, 50, 100, 150, 200],
      coords: [],
      linePath: '',
      areaPath: '',
    };
  }

  const rawMax = Math.max(...points.map((p) => p.aqi), 100);
  const maxY = Math.min(500, Math.max(150, Math.ceil((rawMax + 25) / 50) * 50));
  const step = maxY <= 200 ? 50 : 100;
  const yTicks: number[] = [];
  for (let v = 0; v <= maxY; v += step) {
    yTicks.push(v);
  }

  const coords: ForecastCoord[] = points.map((point, idx) => {
    const ratio = points.length > 1 ? idx / (points.length - 1) : 0;
    const x = CHART_PAD.left + ratio * plotW;
    const y = CHART_PAD.top + plotH - (Math.min(point.aqi, maxY) / maxY) * plotH;
    const hourNum = Number.parseInt(point.hourLabel.split(':')[0] ?? '0', 10);
    const isSafeWindow = hourNum >= 11 && hourNum <= 16;
    return { x, y, point, isSafeWindow };
  });

  const linePath = coords
    .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');

  const baselineY = CHART_PAD.top + plotH;
  const first = coords[0]!;
  const last = coords[coords.length - 1]!;
  const areaPath = `${linePath} L ${last.x.toFixed(1)} ${baselineY.toFixed(1)} L ${first.x.toFixed(1)} ${baselineY.toFixed(1)} Z`;

  return { maxY, yTicks, coords, linePath, areaPath };
}

/**
 * Finds the minimum and peak AQI forecast points across the forecast window.
 */
export function computeForecastSummaryStats(
  points: ForecastHourlyPoint[],
): ForecastSummaryStats | null {
  if (points.length === 0) return null;
  let minPt = points[0]!;
  let maxPt = points[0]!;
  for (const pt of points) {
    if (pt.aqi < minPt.aqi) minPt = pt;
    if (pt.aqi > maxPt.aqi) maxPt = pt;
  }
  return { minPt, maxPt };
}
