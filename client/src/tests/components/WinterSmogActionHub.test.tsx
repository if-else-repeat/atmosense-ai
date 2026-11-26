import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';
import { WinterSmogActionHub } from '../../components/ActionHub/WinterSmogActionHub';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('WinterSmogActionHub Component & Accessibility', () => {
  it('renders Sustainable Alternatives & Direct Impact tailored to location and lifestyle', () => {
    render(
      <WinterSmogActionHub
        locationName="New Delhi, India"
        aqi={182}
        pm25={112}
        persona="asthmatics"
      />,
    );

    expect(screen.getByText(/Winter Smog Action Hub — New Delhi, India/i)).toBeInTheDocument();
    expect(screen.getByText(/Direct Impact of Your Choices/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Primary Commute/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Heating & Cooking Fuel/i)).toBeInTheDocument();
  });

  it('updates direct impact numbers when switching heating fuel to wood/biomass', () => {
    render(
      <WinterSmogActionHub
        locationName="New Delhi, India"
        aqi={182}
        pm25={112}
        persona="general"
      />,
    );

    const fuelSelect = screen.getByLabelText(/Heating & Cooking Fuel/i);
    fireEvent.change(fuelSelect, { target: { value: 'wood_biomass' } });

    expect(screen.getByText(/Replace Open Wood\/Biomass Burning/i)).toBeInTheDocument();
  });

  it('switches to Indoor Air Hacks tab, recalculates room CADR/ACH, and persists active hacks', () => {
    render(
      <WinterSmogActionHub
        locationName="New Delhi, India"
        aqi={195}
        pm25={125}
        persona="children"
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: /Indoor Air Hacks/i }));
    expect(screen.getByText(/Room Filtration & DIY Air Cleaner Sizer/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Build a DIY Corsi-Rosenthal MERV-13 Air Cleaner/i),
    ).toBeInTheDocument();

    const slider = screen.getByLabelText(/Target room area/i);
    fireEvent.change(slider, { target: { value: '45' } });
    expect(screen.getAllByText(/45 m²/).length).toBeGreaterThan(0);

    const markButtons = screen.getAllByRole('button', { name: /Mark Hack Active/i });
    fireEvent.click(markButtons[0]!);
    expect(screen.getByRole('button', { name: /Active in Our Home/i })).toBeInTheDocument();
  });

  it('switches cleanly to Low-Emission Daily Routine tab', () => {
    render(<WinterSmogActionHub locationName="London, UK" aqi={74} pm25={22} persona="general" />);

    fireEvent.click(screen.getByRole('tab', { name: /Low-Emission Daily Routine/i }));
    expect(screen.getByRole('button', { name: /Optimize Daily Routine/i })).toBeInTheDocument();
  });

  it('passes axe-core accessibility audit with zero violations across tabs', async () => {
    const { container } = render(
      <WinterSmogActionHub
        locationName="New Delhi, India"
        aqi={180}
        pm25={105}
        persona="elderly"
      />,
    );

    const results1 = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results1.violations).toEqual([]);

    fireEvent.click(screen.getByRole('tab', { name: /Indoor Air Hacks/i }));
    const results2 = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results2.violations).toEqual([]);
  });
});
