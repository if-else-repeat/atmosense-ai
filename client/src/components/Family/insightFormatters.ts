import {
  SEVERITY_SCORE,
  SYMPTOM_FIELD_LABELS,
  type CorrelationStrength,
  type FamilyHealthInsight,
  type FamilyMember,
  type SymptomFieldKey,
  type SymptomLogEntry,
} from '../../types/family';

export const INSIGHT_SYMPTOM_KEYS: readonly SymptomFieldKey[] = [
  'coughing',
  'wheezing',
  'eyeIrritation',
  'shortnessOfBreath',
  'headache',
];

export interface RawAiInsightItem {
  pattern?: string;
  recommendation?: string;
  confidence?: number;
  triggerPollutant?: string;
}

export function correlationBadgeMeta(strength: CorrelationStrength): {
  label: string;
  classes: string;
} {
  switch (strength) {
    case 'strong':
      return {
        label: 'Strong correlation',
        classes:
          'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-200',
      };
    case 'moderate':
      return {
        label: 'Moderate correlation',
        classes:
          'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-200',
      };
    default:
      return {
        label: 'Weak correlation',
        classes:
          'border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
      };
  }
}

/** Builds a strictly de-identified payload (never includes member names or PII). */
export function buildDeidentifiedPayload(memberLogs: readonly SymptomLogEntry[]) {
  const symptomLogs = memberLogs.map((entry) => {
    const activeSymptoms = INSIGHT_SYMPTOM_KEYS.filter((k) => entry[k] !== 'none').map(
      (k) => SYMPTOM_FIELD_LABELS[k],
    );
    const maxScore = Math.max(1, ...INSIGHT_SYMPTOM_KEYS.map((k) => SEVERITY_SCORE[entry[k]]));
    const mappedSeverity = Math.min(5, Math.max(1, maxScore + 1)) as 1 | 2 | 3 | 4 | 5;
    return {
      timestamp: entry.timestamp,
      symptoms: activeSymptoms.length > 0 ? activeSymptoms : ['No active symptoms'],
      severity: mappedSeverity,
    };
  });

  const aqiHistory = memberLogs.map((entry) => ({
    timestamp: entry.timestamp,
    aqi: entry.aqiAtLog,
  }));

  return { symptomLogs, aqiHistory };
}

export function mapAiInsightsResponse(
  items: readonly RawAiInsightItem[],
  member: FamilyMember,
  memberLogs: readonly SymptomLogEntry[],
): FamilyHealthInsight[] {
  const avgAqi =
    memberLogs.reduce((acc, log) => acc + log.aqiAtLog, 0) / Math.max(1, memberLogs.length);

  return items.map((item, idx) => {
    const conf = typeof item.confidence === 'number' ? item.confidence : 0.6;
    const strength: CorrelationStrength =
      conf >= 0.75 ? 'strong' : conf >= 0.45 ? 'moderate' : 'weak';

    return {
      id: `ai-${member.id}-${idx}`,
      pattern:
        item.pattern ||
        `Elevated AQI periods align with respiratory symptoms for your ${member.relationship.toLowerCase()}.`,
      recommendation:
        item.recommendation ||
        'Limit high-exertion outdoor exposure when AQI exceeds 100 and monitor symptoms.',
      correlationStrength: strength,
      affectedSymptom: item.triggerPollutant || 'Ambient Particulate Exposure',
      averageAqiWhenReported: Math.round(avgAqi),
      source: 'ai',
    };
  });
}
