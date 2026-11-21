import { describe, expect, it } from 'vitest';
import {
  formatAQI,
  formatCO2Savings,
  formatCoordinates,
  formatPollutantValue,
  formatRelativeTime,
  formatStreakLabel,
  getAQICategoryLabel,
  getMemberInitials,
} from '../../utils/formatters';
import { buildDoctorVisitPdf } from '../../utils/healthCrypto';

describe('Client Formatting Utilities', () => {
  it('formats and clamps AQI numbers safely while handling NaN/Infinity', () => {
    expect(formatAQI(42.6)).toBe('43');
    expect(formatAQI(-12)).toBe('0');
    expect(formatAQI(780)).toBe('500');
    expect(formatAQI(Number.NaN)).toBe('—');
    expect(formatAQI(Number.POSITIVE_INFINITY)).toBe('—');
  });

  it('maps AQI scores across all 6 EPA categories and invalid values', () => {
    expect(getAQICategoryLabel(25)).toBe('Good');
    expect(getAQICategoryLabel(75)).toBe('Moderate');
    expect(getAQICategoryLabel(125)).toBe('Unhealthy for Sensitive Groups');
    expect(getAQICategoryLabel(175)).toBe('Unhealthy');
    expect(getAQICategoryLabel(250)).toBe('Very Unhealthy');
    expect(getAQICategoryLabel(350)).toBe('Hazardous');
    expect(getAQICategoryLabel(-5)).toBe('Unavailable');
  });

  it('formats pollutant concentrations with units and rejects negative/non-finite inputs', () => {
    expect(formatPollutantValue(35.44, 'µg/m³', 1)).toBe('35.4 µg/m³');
    expect(formatPollutantValue(0.064, 'ppm', 3)).toBe('0.064 ppm');
    expect(formatPollutantValue(-3, 'ppb')).toBe('— ppb');
    expect(formatPollutantValue(Number.NaN, 'mg/m³')).toBe('— mg/m³');
  });

  it('formats relative timestamps across seconds, minutes, hours, and days', () => {
    const now = 1_760_000_000_000;
    expect(formatRelativeTime(now - 15_000, now)).toBe('Just now');
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe('5 min ago');
    expect(formatRelativeTime(now - 3 * 3_600_000, now)).toBe('3 hr ago');
    expect(formatRelativeTime(now - 24 * 3_600_000, now)).toBe('1 day ago');
    expect(formatRelativeTime(now - 72 * 3_600_000, now)).toBe('3 days ago');
    expect(formatRelativeTime(Number.NaN, now)).toBe('Unknown');
  });

  it('formats geographic coordinates with cardinal hemisphere labels', () => {
    expect(formatCoordinates(28.6139, 77.209)).toBe('28.6139° N, 77.2090° E');
    expect(formatCoordinates(-33.8688, -151.2093)).toBe('33.8688° S, 151.2093° W');
    expect(formatCoordinates(Number.NaN, 10)).toBe('Invalid coordinates');
  });

  it('formats CO2 savings in kilograms and tonnes gracefully', () => {
    expect(formatCO2Savings(234)).toBe('234 kg CO2');
    expect(formatCO2Savings(1450)).toBe('1.45 tonnes CO2');
    expect(formatCO2Savings(0)).toBe('0 kg CO2');
    expect(formatCO2Savings(-20)).toBe('0 kg CO2');
  });

  it('formats check-in streaks with accessible text labels', () => {
    expect(formatStreakLabel(7)).toBe('7-day streak');
    expect(formatStreakLabel(1)).toBe('1-day streak');
    expect(formatStreakLabel(0)).toBe('No active streak');
    expect(formatStreakLabel(-2)).toBe('No active streak');
  });

  it('computes clean avatar initials for single, multi-word, and empty names', () => {
    expect(getMemberInitials('Maya Patel')).toBe('MP');
    expect(getMemberInitials('Arjun Kumar Singh')).toBe('AS');
    expect(getMemberInitials('Rohan')).toBe('RO');
    expect(getMemberInitials('   ')).toBe('?');
  });

  it('builds a valid PDF 1.4 binary report for clinician visits', () => {
    const bytes = buildDoctorVisitPdf(
      {
        id: 'm1',
        name: 'Maya Patel',
        age: 9,
        relationship: 'Child',
        healthConditions: ['asthma'],
        sensitivityLevel: 'high',
        activityPatterns: ['school'],
        avatarColor: '#0E7490',
        createdAt: Date.now(),
      },
      [],
      [],
    );
    const decoded = new TextDecoder().decode(bytes);
    expect(decoded.startsWith('%PDF-1.4')).toBe(true);
    expect(decoded).toContain('Maya Patel');
    expect(decoded).toContain('%%EOF');
  });
});
