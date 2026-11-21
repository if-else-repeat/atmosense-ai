import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getAQICategoryLabel } from '../../utils/formatters';

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export interface VoiceInterfaceProps {
  aqi: number;
  locationName: string;
  onTranscriptCommand?: (transcript: string) => void;
}

export function VoiceInterface({ aqi, locationName, onTranscriptCommand }: VoiceInterfaceProps) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [statusMessage, setStatusMessage] = useState<string>(
    'Tap Start Voice Query or Read Briefing Aloud for hands-free updates.',
  );
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const getRecognitionCtor = (): SpeechRecognitionConstructor | null => {
    if (typeof window === 'undefined') return null;
    const win = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
  };

  const speechSupported = Boolean(getRecognitionCtor());

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleToggleListening = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      setStatusMessage('Voice capture stopped.');
      return;
    }

    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setStatusMessage(
        'Voice recognition is not supported in this browser. Type your question in the assistant below.',
      );
      return;
    }

    const recognition = new Ctor();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const heard = event.results[0]?.[0]?.transcript?.trim() ?? '';
      if (heard) {
        setTranscript(heard);
        setStatusMessage(`Heard: "${heard}"`);
        onTranscriptCommand?.(heard);
      }
    };

    recognition.onerror = (event) => {
      setListening(false);
      setStatusMessage(`Microphone error: ${event.error}. Please check microphone permissions.`);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    setListening(true);
    setStatusMessage('Listening for your air quality question…');
    recognition.start();
  };

  const handleReadBriefing = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setStatusMessage('Speech synthesis is unavailable in this browser.');
      return;
    }

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      setStatusMessage('Audio briefing stopped.');
      return;
    }

    const category = getAQICategoryLabel(aqi);
    const summary = `Current air quality in ${locationName} is ${Math.round(aqi)}, categorized as ${category}. ${
      aqi > 100
        ? 'Sensitive groups should reduce prolonged outdoor exertion and consider a fitted N95 mask.'
        : 'Outdoor air quality is acceptable for normal activity.'
    }`;

    const utterance =
      typeof SpeechSynthesisUtterance !== 'undefined'
        ? new SpeechSynthesisUtterance(summary)
        : ({ text: summary, onend: null, onerror: null } as unknown as SpeechSynthesisUtterance);

    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
    setStatusMessage('Reading live air quality briefing aloud.');
  };

  return (
    <section
      aria-labelledby="voice-interface-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3
            id="voice-interface-heading"
            className="text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            Hands-Free Voice Assistant
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Ask air quality questions aloud or hear an accessible spoken AQI summary for{' '}
            {locationName}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleToggleListening}
            aria-pressed={listening}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              listening
                ? 'border-rose-600 bg-rose-50 text-rose-900 dark:border-rose-500 dark:bg-rose-950/60 dark:text-rose-200'
                : 'border-cyan-700 bg-cyan-700 text-white hover:bg-cyan-800'
            }`}
          >
            {listening ? (
              <>
                <MicOff className="h-3.5 w-3.5" aria-hidden="true" />
                Stop Listening
              </>
            ) : (
              <>
                <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                Start Voice Query
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleReadBriefing}
            aria-pressed={speaking}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            {speaking ? (
              <>
                <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />
                Stop Audio
              </>
            ) : (
              <>
                <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                Read Briefing Aloud
              </>
            )}
          </button>
        </div>
      </div>

      <div
        role="status"
        aria-live="polite"
        className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
      >
        <p>{statusMessage}</p>
        {transcript && (
          <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">
            Transcript: {transcript}
          </p>
        )}
        {!speechSupported && (
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Browser note: Web Speech Recognition API unavailable in this environment.
          </p>
        )}
      </div>
    </section>
  );
}
