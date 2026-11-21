import { BookmarkCheck, Send, ShieldAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useWorkspace } from '../context/AuthContext';
import type {
  AirQualityStation,
  ChatTurn,
  HealthAdvisoryResult,
  SensitivityProfile,
} from '../types/airQuality';
import { getAqiTone } from '../utils/airQuality';
import { RoutineOptimizer } from './Routine/RoutineOptimizer';
import { VoiceInterface } from './Voice/VoiceInterface';

interface HealthAssistantPanelProps {
  station: AirQualityStation;
  sensitivityProfile: SensitivityProfile;
  onChangeSensitivity: (profile: SensitivityProfile) => void;
}

const PROFILES: ReadonlyArray<{ id: SensitivityProfile; label: string; detail: string }> = [
  { id: 'general', label: 'General Public', detail: 'Standard EPA exposure guidance' },
  { id: 'respiratory', label: 'Asthma / Respiratory', detail: 'Tighter PM2.5 & NO₂ precaution' },
  { id: 'athlete', label: 'Outdoor Runner', detail: 'High-ventilation exertion timing' },
  { id: 'vulnerable', label: 'Children & Seniors', detail: 'Conservative exposure ceilings' },
];

const QUICK_PROMPTS = [
  'Is it safe for a 45-minute outdoor run right now?',
  'Should I keep windows closed and run a HEPA purifier?',
  'Which pollutant is driving today’s AQI reading?',
];

export function HealthAssistantPanel({
  station,
  sensitivityProfile,
  onChangeSensitivity,
}: HealthAssistantPanelProps) {
  const { persistAdvisory } = useWorkspace();
  const [activityGoal, setActivityGoal] = useState('Evening 5km outdoor run and commute');
  const [advisory, setAdvisory] = useState<HealthAdvisoryResult | null>(null);
  const [advisoryLoading, setAdvisoryLoading] = useState(false);
  const [advisoryError, setAdvisoryError] = useState<string | null>(null);
  const [advisorySaved, setAdvisorySaved] = useState(false);

  const [chatHistory, setChatHistory] = useState<ChatTurn[]>([]);
  const [question, setQuestion] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const handleGenerateAdvisory = async (e: FormEvent) => {
    e.preventDefault();
    setAdvisoryLoading(true);
    setAdvisoryError(null);
    setAdvisorySaved(false);

    try {
      const response = await fetch('/api/ai/advisory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stationId: station.id,
          latitude: station.latitude,
          longitude: station.longitude,
          sensitivityProfile,
          activityGoal: activityGoal.trim() || undefined,
        }),
      });
      const data = (await response.json()) as {
        advisory?: HealthAdvisoryResult;
        error?: string;
      };
      if (!response.ok || !data.advisory) {
        throw new Error(data.error || `Server returned status ${response.status}.`);
      }
      setAdvisory(data.advisory);
    } catch (err) {
      setAdvisoryError(
        err instanceof Error ? err.message : 'Unable to reach Gemini advisory service.',
      );
    } finally {
      setAdvisoryLoading(false);
    }
  };

  const handleSaveAdvisory = async () => {
    if (!advisory) return;
    try {
      await persistAdvisory(station, sensitivityProfile, advisory);
      setAdvisorySaved(true);
    } catch (err) {
      setAdvisoryError(err instanceof Error ? err.message : 'Could not save brief locally.');
    }
  };

  const submitQuestion = async (promptText: string) => {
    const cleaned = promptText.trim();
    if (!cleaned || chatLoading) return;

    const userTurn: ChatTurn = {
      role: 'user',
      content: cleaned,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextHistory = [...chatHistory, userTurn];
    setChatHistory(nextHistory);
    setQuestion('');
    setChatLoading(true);
    setChatError(null);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stationId: station.id,
          latitude: station.latitude,
          longitude: station.longitude,
          sensitivityProfile,
          message: cleaned,
          history: chatHistory.map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = (await response.json()) as { reply?: string; error?: string };
      if (!response.ok || !data.reply) {
        throw new Error(data.error || `Server returned status ${response.status}.`);
      }
      setChatHistory([
        ...nextHistory,
        {
          role: 'assistant',
          content: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Unable to complete chat request.');
    } finally {
      setChatLoading(false);
    }
  };

  const handleChatSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submitQuestion(question);
  };

  const tone = getAqiTone(station.category.key);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Structured Health Brief Generator */}
        <section className="flex min-w-0 flex-col gap-5 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 lg:col-span-5">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Respiratory Health Brief
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              AtmoSense AI analysis grounded in {station.city} telemetry · AQI{' '}
              <span className={`font-mono font-semibold tabular-nums ${tone.textClass}`}>
                {station.aqi}
              </span>
            </p>
          </div>

          <form onSubmit={handleGenerateAdvisory} className="space-y-4">
            <fieldset>
              <legend className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Sensitivity Profile
              </legend>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PROFILES.map((item) => {
                  const selected = sensitivityProfile === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onChangeSensitivity(item.id)}
                      aria-pressed={selected}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        selected
                          ? 'border-cyan-700 bg-cyan-50/70 text-slate-900 dark:border-cyan-500 dark:bg-cyan-950/40 dark:text-slate-100'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="text-xs font-semibold">{item.label}</div>
                      <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        {item.detail}
                      </div>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div>
              <label
                htmlFor="activity-goal-input"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Planned Outdoor Activity
              </label>
              <input
                id="activity-goal-input"
                type="text"
                maxLength={180}
                value={activityGoal}
                onChange={(e) => setActivityGoal(e.target.value)}
                placeholder="e.g., 40-minute bike commute at 18:00"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <button
              type="submit"
              disabled={advisoryLoading}
              className="w-full rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {advisoryLoading ? 'Analyzing Live Telemetry...' : 'Generate Health Brief'}
            </button>
          </form>

          {advisoryError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200"
            >
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{advisoryError}</span>
            </div>
          )}

          {advisory && (
            <article className="space-y-4 border-t border-slate-200 pt-5 dark:border-slate-800">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Verdict · Risk level:{' '}
                    <span className="font-medium capitalize">{advisory.riskLevel}</span>
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
                    {advisory.outdoorVerdict}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => void handleSaveAdvisory()}
                  disabled={advisorySaved}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                >
                  <BookmarkCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  {advisorySaved ? 'Saved' : 'Save Brief'}
                </button>
              </div>

              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {advisory.summary}
              </p>

              <div className="grid grid-cols-1 gap-3 border-y border-slate-100 py-3 text-xs dark:border-slate-800">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Recommended Window: </span>
                  <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                    {advisory.recommendedWindow}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Pollutant Note: </span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {advisory.pollutantNote}
                  </span>
                </div>
              </div>

              {advisory.protectiveActions.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Recommended Precautions
                  </h3>
                  <ul className="mt-2 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    {advisory.protectiveActions.map((action, idx) => (
                      <li key={idx} className="flex gap-2">
                        <span className="font-mono text-cyan-700 dark:text-cyan-400">
                          0{idx + 1}.
                        </span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          )}
        </section>

        {/* Right: Multi-Turn Air Quality Chat */}
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

          <div className="my-5 flex min-h-[340px] max-h-[460px] flex-col gap-4 overflow-y-auto border-y border-slate-100 py-5 dark:border-slate-800">
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
                      onClick={() => void submitQuestion(prompt)}
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
                    className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
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

          <form onSubmit={handleChatSubmit} className="flex gap-2">
            <label htmlFor="ai-chat-input" className="sr-only">
              Ask AtmoSense AI about air quality in {station.city}
            </label>
            <input
              id="ai-chat-input"
              type="text"
              maxLength={600}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={`Ask about ${station.city} air quality, masks, or timing...`}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={chatLoading || question.trim().length < 2}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-cyan-700 dark:hover:bg-cyan-600 whitespace-nowrap shrink-0"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              Send
            </button>
          </form>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <RoutineOptimizer
            zoneName={`${station.city}, ${station.country}`}
            aqi={station.aqi}
            pm25={station.metrics.pm25}
          />
        </div>
        <div className="lg:col-span-5">
          <VoiceInterface
            aqi={station.aqi}
            locationName={`${station.city}, ${station.country}`}
            onTranscriptCommand={(spoken) => void submitQuestion(spoken)}
          />
        </div>
      </div>
    </div>
  );
}
