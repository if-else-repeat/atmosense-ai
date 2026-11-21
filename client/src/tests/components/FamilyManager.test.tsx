import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FamilyManager } from '../../components/Family/FamilyManager';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('FamilyManager Component', () => {
  it('renders household profiles with explicit Vulnerable Person badges for high-sensitivity members', () => {
    render(<FamilyManager currentAqi={142} locationName="New Delhi, India" />);
    expect(screen.getByText('Maya Patel')).toBeInTheDocument();
    expect(screen.getByText('Arjun Patel')).toBeInTheDocument();
    expect(screen.getAllByText('Vulnerable Person').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/AES-256-GCM Encrypted/i)).toBeInTheDocument();
  });

  it('adds a new family member with health conditions, sensitivity level, and activity patterns', async () => {
    render(<FamilyManager currentAqi={88} locationName="London, UK" />);
    fireEvent.click(screen.getByRole('button', { name: /Add Family Member/i }));

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Elena Gomez' } });
    fireEvent.change(screen.getByLabelText(/Age/i), { target: { value: '67' } });
    fireEvent.change(screen.getByLabelText(/Relationship/i), { target: { value: 'Grandparent' } });
    fireEvent.click(screen.getByLabelText(/COPD/i));
    fireEvent.click(screen.getByRole('button', { name: /^high$/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save Member Profile/i }));

    expect(await screen.findByText('Elena Gomez')).toBeInTheDocument();
    expect(screen.getByText(/Grandparent · Age 67/i)).toBeInTheDocument();
  });

  it('switches active family member and logs daily symptoms linked to current live AQI', async () => {
    render(<FamilyManager currentAqi={154} locationName="New Delhi, India" />);

    fireEvent.click(screen.getByText('Arjun Patel'));
    expect(screen.getByText(/Daily Symptom Tracker — Arjun Patel/i)).toBeInTheDocument();

    const coughingGroup = screen.getByRole('radiogroup', { name: 'Coughing' });
    const moderateRadio = coughingGroup.querySelector('button:nth-child(3)');
    if (moderateRadio) fireEvent.click(moderateRadio);

    fireEvent.change(screen.getByLabelText(/Optional clinical notes/i), {
      target: { value: 'Brief outdoor walk at 8 AM' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Log Daily Symptoms/i }));

    expect(await screen.findByText(/Symptom log recorded/i)).toBeInTheDocument();
    expect(screen.getByText(/Brief outdoor walk at 8 AM/i)).toBeInTheDocument();
    expect(screen.getAllByText('154').length).toBeGreaterThanOrEqual(2);
  });

  it('requires explicit AI consent checkbox before enabling server-side AI correlation analysis', () => {
    render(<FamilyManager currentAqi={138} locationName="New Delhi, India" />);
    const runAiBtn = screen.getByRole('button', { name: /Run AI Correlation/i });
    expect(runAiBtn).toBeDisabled();

    const consentCheckbox = screen.getByRole('checkbox', {
      name: /Explicit AI Analysis Consent/i,
    });
    fireEvent.click(consentCheckbox);
    expect(runAiBtn).not.toBeDisabled();
  });

  it('displays local symptom-to-AQI correlation strength badges and supports doctor PDF export', () => {
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:mock-pdf');
    URL.revokeObjectURL = vi.fn();

    render(<FamilyManager currentAqi={138} locationName="New Delhi, India" />);
    expect(screen.getAllByText(/correlation/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /Export Doctor Visit PDF/i }));
    expect(screen.getByText(/Doctor visit PDF exported for Maya Patel/i)).toBeInTheDocument();

    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
  });

  it('permanently erases all family health data when GDPR deletion is confirmed', async () => {
    render(<FamilyManager currentAqi={120} locationName="New Delhi, India" />);
    fireEvent.click(screen.getByRole('button', { name: /Delete All Health Data \(GDPR\)/i }));
    fireEvent.click(screen.getByRole('button', { name: /Confirm Erase/i }));

    await waitFor(() => {
      expect(screen.getByText(/No family profiles yet/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/GDPR Article 17/i)).toBeInTheDocument();
  });
});
