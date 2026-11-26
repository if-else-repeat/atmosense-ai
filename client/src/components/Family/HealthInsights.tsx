import { AlertCircle, CheckCircle2, FileDown, Lock, Sparkles, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FamilyHealthInsight, FamilyMember, SymptomLogEntry } from '../../types/family';
import { analyzeSymptomCorrelations, downloadDoctorVisitPdf } from '../../utils/healthCrypto';
import { InsightCard } from './InsightCard';
import {
  buildDeidentifiedPayload,
  mapAiInsightsResponse,
  type RawAiInsightItem,
} from './insightFormatters';

interface HealthInsightsProps {
  member: FamilyMember;
  logs: SymptomLogEntry[];
  aiConsent: boolean;
  onToggleAiConsent: (consented: boolean) => void;
}

export function HealthInsights({
  member,
  logs,
  aiConsent,
  onToggleAiConsent,
}: HealthInsightsProps) {
  const [aiInsights, setAiInsights] = useState<FamilyHealthInsight[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const memberLogs = useMemo(
    () => logs.filter((entry) => entry.memberId === member.id),
    [logs, member.id],
  );

  const localInsights = useMemo(
    () => analyzeSymptomCorrelations(member, memberLogs),
    [member, memberLogs],
  );

  const displayedInsights = aiInsights.length > 0 ? aiInsights : localInsights;

  const handleRunAiAnalysis = async () => {
    if (!aiConsent || memberLogs.length === 0) return;
    setLoadingAi(true);
    setAiError(null);

    try {
      const response = await fetch('/api/ai/health-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildDeidentifiedPayload(memberLogs)),
      });

      if (!response.ok) {
        throw new Error(`AI analysis returned status ${response.status}`);
      }

      const payload = (await response.json()) as { insights?: RawAiInsightItem[] };
      if (Array.isArray(payload.insights) && payload.insights.length > 0) {
        setAiInsights(mapAiInsightsResponse(payload.insights, member, memberLogs));
      } else {
        setAiInsights(localInsights);
      }
    } catch (error) {
      setAiError(
        error instanceof Error
          ? `${error.message}. Showing local statistical correlations instead.`
          : 'AI service unavailable. Showing local statistical correlations instead.',
      );
      setAiInsights(localInsights);
    } finally {
      setLoadingAi(false);
    }
  };

  const handleExportPdf = () => {
    downloadDoctorVisitPdf(member, memberLogs, displayedInsights);
    setExportStatus(`Doctor visit PDF exported for ${member.name}.`);
    setTimeout(() => setExportStatus(null), 3500);
  };

  return (
    <section
      aria-labelledby="health-insights-heading"
      className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
        <div>
          <h3
            id="health-insights-heading"
            className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            <TrendingUp className="h-4 w-4 text-cyan-700 dark:text-cyan-400" aria-hidden="true" />
            Health Insights &amp; AQI Correlation
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Correlates logged symptoms with historical AQI readings and prepares clinician-ready PDF
            summaries.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportPdf}
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
          Export Doctor Visit PDF
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950/70">
        <div className="flex flex-col gap-3">
          <label className="flex cursor-pointer items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={aiConsent}
              onChange={(event) => onToggleAiConsent(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-cyan-700 focus:ring-cyan-700"
            />
            <span className="min-w-0 break-words">
              <strong className="font-semibold text-slate-900 dark:text-slate-100">
                Explicit AI Analysis Consent:
              </strong>{' '}
              Allow AtmoSense AI to analyze de-identified symptom severity and AQI history. Names
              and identifiers are never transmitted or logged in analytics.
            </span>
          </label>

          <button
            type="button"
            disabled={!aiConsent || memberLogs.length === 0 || loadingAi}
            onClick={() => void handleRunAiAnalysis()}
            className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:self-start dark:bg-cyan-700 dark:hover:bg-cyan-600"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {loadingAi ? 'Analyzing…' : 'Run AI Correlation'}
          </button>
        </div>

        {!aiConsent && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            AI analysis is locked until you check the consent box above. Local offline correlations
            remain available.
          </p>
        )}
      </div>

      {exportStatus && (
        <div
          role="status"
          className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          {exportStatus}
        </div>
      )}

      {aiError && (
        <div
          role="status"
          className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {aiError}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {displayedInsights.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
            Record at least one symptom entry for {member.name} to surface AQI correlation patterns
            and personalized protective recommendations.
          </p>
        ) : (
          displayedInsights.map((insight) => <InsightCard key={insight.id} insight={insight} />)
        )}
      </div>
    </section>
  );
}
