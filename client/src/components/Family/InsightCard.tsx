import { TrendingUp } from 'lucide-react';
import type { FamilyHealthInsight } from '../../types/family';
import { correlationBadgeMeta } from './insightFormatters';

interface InsightCardProps {
  insight: FamilyHealthInsight;
}

export function InsightCard({ insight }: InsightCardProps) {
  const meta = correlationBadgeMeta(insight.correlationStrength);
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          {insight.affectedSymptom} · Avg AQI{' '}
          <span className="font-mono tabular-nums">{insight.averageAqiWhenReported}</span>
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${meta.classes}`}
        >
          <TrendingUp className="h-3 w-3" aria-hidden="true" />
          {meta.label}
        </span>
      </div>
      <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
        {insight.pattern}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
        <strong className="font-semibold text-slate-800 dark:text-slate-200">
          Recommendation:
        </strong>{' '}
        {insight.recommendation}
      </p>
    </article>
  );
}
