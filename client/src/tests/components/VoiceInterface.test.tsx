import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VoiceInterface } from '../../components/Voice/VoiceInterface';

afterEach(() => {
  cleanup();
  delete (window as unknown as Record<string, unknown>).SpeechRecognition;
  delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
});

describe('VoiceInterface Component', () => {
  it('renders voice query and audio briefing buttons with aria-live status region', () => {
    render(<VoiceInterface aqi={92} locationName="Tokyo, Japan" />);
    expect(screen.getByRole('button', { name: /Start Voice Query/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Read Briefing Aloud/i })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('displays graceful fallback notice when SpeechRecognition is unavailable', () => {
    render(<VoiceInterface aqi={65} locationName="London, UK" />);
    fireEvent.click(screen.getByRole('button', { name: /Start Voice Query/i }));
    expect(screen.getByRole('status')).toHaveTextContent(/not supported in this browser/i);
  });

  it('starts speech recognition, captures transcript, and invokes onTranscriptCommand', () => {
    let instanceRef: {
      onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
      start: () => void;
      stop: () => void;
    } | null = null;

    class MockSpeechRecognition {
      lang = '';
      interimResults = false;
      continuous = false;
      onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null =
        null;
      onerror: ((e: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start = vi.fn();
      stop = vi.fn();
      constructor() {
        instanceRef = this;
      }
    }

    (window as unknown as Record<string, unknown>).SpeechRecognition = MockSpeechRecognition;
    const onTranscript = vi.fn();

    render(
      <VoiceInterface
        aqi={134}
        locationName="New Delhi, India"
        onTranscriptCommand={onTranscript}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Start Voice Query/i }));
    expect(screen.getByRole('button', { name: /Stop Listening/i })).toBeInTheDocument();

    act(() => {
      instanceRef?.onresult?.({
        results: [[{ transcript: 'Is it safe for children outdoors?' }]],
      });
    });

    expect(onTranscript).toHaveBeenCalledWith('Is it safe for children outdoors?');
    expect(screen.getAllByText(/Is it safe for children outdoors\?/i).length).toBeGreaterThan(0);
  });

  it('stops active voice capture when Stop Listening is clicked', () => {
    const stopSpy = vi.fn();
    class MockSpeechRecognition {
      lang = '';
      interimResults = false;
      continuous = false;
      onresult = null;
      onerror = null;
      onend = null;
      start = vi.fn();
      stop = stopSpy;
    }
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = MockSpeechRecognition;

    render(<VoiceInterface aqi={55} locationName="Seattle, USA" />);
    fireEvent.click(screen.getByRole('button', { name: /Start Voice Query/i }));
    fireEvent.click(screen.getByRole('button', { name: /Stop Listening/i }));

    expect(stopSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent(/Voice capture stopped/i);
  });

  it('speaks live AQI briefing using window.speechSynthesis and allows stopping audio', () => {
    const speakMock = vi.fn();
    const cancelMock = vi.fn();
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { speak: speakMock, cancel: cancelMock },
    });

    render(<VoiceInterface aqi={162} locationName="Mumbai, India" />);
    fireEvent.click(screen.getByRole('button', { name: /Read Briefing Aloud/i }));

    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Stop Audio/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Stop Audio/i }));
    expect(cancelMock).toHaveBeenCalled();
  });
});
