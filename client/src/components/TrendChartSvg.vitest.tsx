import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TrendChartSvg } from './TrendChartSvg';
import { OFFLINE_FALLBACK_STATIONS } from '../utils/airQuality';

describe('TrendChartSvg', () => {
  it('renders native SVG chart and switches pollutant series interactively', () => {
    const station = OFFLINE_FALLBACK_STATIONS[0]!;
    render(<TrendChartSvg hourly={station.hourly} city={station.city} />);

    expect(screen.getByText('24-Hour Dispersion Trend')).toBeInTheDocument();
    const initialVal = screen.getByTestId('trend-active-value').textContent;
    expect(initialVal).toBe(String(station.hourly[station.hourly.length - 1]!.aqi));

    fireEvent.click(screen.getByRole('tab', { name: 'PM2.5' }));
    const pm25Val = screen.getByTestId('trend-active-value').textContent;
    expect(pm25Val).toBe(String(station.hourly[station.hourly.length - 1]!.pm25));
  });
});
