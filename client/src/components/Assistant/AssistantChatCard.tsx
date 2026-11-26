import { Send } from 'lucide-react';
import type { FormEvent } from 'react';
import type { AirQualityStation, ChatTurn } from '../../types/airQuality';

const QUICK_PROMPTS = [
  'Is it safe for a 45-minute outdoor run right now?',
  'Should I keep windows closed and run a HEPA purifier?',
  'Which pollutant is driving today’s AQI reading?',
];

export interface AssistantChatCardProps {
  station: AirQualityStation;
  chatHistory: ChatTurn[];
  question: string;
  onChangeQuestion: (value: string) => void;
  chatLoading: boolean;
  chatError: string | null;
  onSubmitQuestion: (promptText: string) => void;
  onFormSubmit: (e: FormEvent) => void;
}

export function AssistantChatCard({
  station,
  chatHistory,
  question,
  onChangeQuestion,
  chatLoading,
  chatError,
  onSubmitQuestion,
  onFormSubmit,
}: AssistantChatCardProps) {
  return (
    <section className="flex min-w-0 flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 lg:col-span-7">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Ask AtmoSense AI
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Context-aware guidance for {station.city} ({station.district}) · PM2.5{' '}
          <span className="font-mono tabular-nums">{station.metrics.pm25} µg/m³</span> · NO₂{' '}
          <span className="font-mono tabular-nums">{station.metrics.no2} µg/m³</span>
        </p>
      </div>

      <div
        role="log"
        aria-live="polite"
        aria-label="AtmoSense AI conversation"
        className="my-5 flex max-h-[460px] min-h-[340px] flex-col gap-4 overflow-y-auto border-y border-slate-100 py-5 dark:border-slate-800"
      >
        {chatHistory.length === 0 ? (
          <div className="my-auto space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Ask a specific question about outdoor workouts, indoor ventilation, filtration, or
              pollutant dispersion in {station.city}.
            </p>
            <div className="flex flex-col gap-2">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onSubmitQuestion(prompt)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-left text-xs font-medium text-slate-700 transition-colors hover:border-cyan-700/40 hover:bg-cyan-50/40 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-cyan-500/40"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          chatHistory.map((turn, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${turn.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <span className="mb-1 text-[11px] text-slate-400">
                {turn.role === 'user' ? 'You' : 'AtmoSense AI'} · {turn.timestamp}
              </span>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  turn.role === 'user'
                    ? 'bg-slate-900 text-white dark:bg-cyan-700'
                    : 'border border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200'
                }`}
              >
                {turn.content}
              </div>
            </div>
          ))
        )}

        {chatLoading && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Analyzing current pollutant telemetry...
          </p>
        )}
      </div>

      {chatError && (
        <div
          role="alert"
          className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200"
        >
          {chatError}
        </div>
      )}

      <form onSubmit={onFormSubmit} className="flex gap-2">
        <label htmlFor="ai-chat-input" className="sr-only">
          Ask AtmoSense AI about air quality in {station.city}
        </label>
        <input
          id="ai-chat-input"
          type="text"
          maxLength={600}
          value={question}
          onChange={(e) => onChangeQuestion(e.target.value)}
          placeholder={`Ask about ${station.city} air quality, masks, or timing...`}
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        <button
          type="submit"
          disabled={chatLoading || question.trim().length < 2}
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-cyan-700 dark:hover:bg-cyan-600"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          Send
        </button>
      </form>
    </section>
  );
}
