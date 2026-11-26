import { useState, type FormEvent } from 'react';
import { useWorkspace } from '../context/AuthContext';
import type {
  AirQualityStation,
  ChatTurn,
  HealthAdvisoryResult,
  SensitivityProfile,
} from '../types/airQuality';
import { AssistantChatCard } from './Assistant/AssistantChatCard';
import { HealthBriefCard } from './Assistant/HealthBriefCard';
import { RoutineOptimizer } from './Routine/RoutineOptimizer';
import { VoiceInterface } from './Voice/VoiceInterface';

interface HealthAssistantPanelProps {
  station: AirQualityStation;
  sensitivityProfile: SensitivityProfile;
  onChangeSensitivity: (profile: SensitivityProfile) => void;
}

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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <HealthBriefCard
          station={station}
          sensitivityProfile={sensitivityProfile}
          onChangeSensitivity={onChangeSensitivity}
          activityGoal={activityGoal}
          onChangeActivityGoal={setActivityGoal}
          advisory={advisory}
          advisoryLoading={advisoryLoading}
          advisoryError={advisoryError}
          advisorySaved={advisorySaved}
          onGenerateAdvisory={(e) => void handleGenerateAdvisory(e)}
          onSaveAdvisory={() => void handleSaveAdvisory()}
        />

        <AssistantChatCard
          station={station}
          chatHistory={chatHistory}
          question={question}
          onChangeQuestion={setQuestion}
          chatLoading={chatLoading}
          chatError={chatError}
          onSubmitQuestion={(prompt) => void submitQuestion(prompt)}
          onFormSubmit={handleChatSubmit}
        />
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
