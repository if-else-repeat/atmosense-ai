import { ClipboardList } from 'lucide-react';
import type { FormEvent } from 'react';
import {
  SYMPTOM_FIELD_LABELS,
  type SymptomFieldKey,
  type SymptomSeverity,
} from '../../types/family';

export const SEVERITY_OPTIONS: readonly SymptomSeverity[] = ['none', 'mild', 'moderate', 'severe'];

export const SYMPTOM_KEYS: readonly SymptomFieldKey[] = [
  'coughing',
  'wheezing',
  'eyeIrritation',
  'shortnessOfBreath',
  'headache',
];

export const INITIAL_SEVERITIES: Record<SymptomFieldKey, SymptomSeverity> = {
  coughing: 'none',
  wheezing: 'none',
  eyeIrritation: 'none',
  shortnessOfBreath: 'none',
  headache: 'none',
};

function severityButtonStyle(option: SymptomSeverity, active: boolean): string {
  if (!active) {
    return 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800';
  }
  switch (option) {
    case 'none':
      return 'border-emerald-600 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-200';
    case 'mild':
      return 'border-amber-600 bg-amber-50 text-amber-900 dark:border-amber-500 dark:bg-amber-950/60 dark:text-amber-200';
    case 'moderate':
      return 'border-orange-600 bg-orange-50 text-orange-900 dark:border-orange-500 dark:bg-orange-950/60 dark:text-orange-200';
    case 'severe':
      return 'border-rose-700 bg-rose-50 text-rose-900 dark:border-rose-500 dark:bg-rose-950/60 dark:text-rose-200';
  }
}

interface SymptomLogFormProps {
  severities: Record<SymptomFieldKey, SymptomSeverity>;
  notes: string;
  locationName: string;
  justLogged: boolean;
  onSeverityChange: (key: SymptomFieldKey, level: SymptomSeverity) => void;
  onNotesChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function SymptomLogForm({
  severities,
  notes,
  locationName,
  justLogged,
  onSeverityChange,
  onNotesChange,
  onSubmit,
}: SymptomLogFormProps) {
  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4">
      <div className="space-y-3">
        {SYMPTOM_KEYS.map((key) => (
          <fieldset
            key={key}
            className="flex min-w-0 flex-col gap-2 rounded-lg border border-slate-100 bg-slate-50/70 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-950/60"
          >
            <legend className="text-sm font-medium text-slate-800 dark:text-slate-200">
              {SYMPTOM_FIELD_LABELS[key]}
            </legend>
            <div
              className="grid grid-cols-2 gap-1.5 sm:grid-cols-4"
              role="radiogroup"
              aria-label={SYMPTOM_FIELD_LABELS[key]}
            >
              {SEVERITY_OPTIONS.map((level) => {
                const selected = severities[key] === level;
                return (
                  <button
                    key={level}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onSeverityChange(key, level)}
                    className={`rounded-md border px-2.5 py-1.5 text-xs font-medium capitalize transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700 ${severityButtonStyle(level, selected)}`}
                  >
                    {level}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <div>
        <label
          htmlFor="symptom-notes-input"
          className="block text-xs font-medium text-slate-700 dark:text-slate-300"
        >
          Optional clinical notes (e.g., outdoor exposure, inhaler use)
        </label>
        <textarea
          id="symptom-notes-input"
          rows={2}
          maxLength={300}
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          placeholder="Morning walk near main road; used spacer inhaler at 8:15 AM..."
          className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Station: {locationName} · Timestamp attached on save
        </span>
        <div className="flex items-center gap-3">
          {justLogged && (
            <span
              role="status"
              className="text-xs font-medium text-emerald-700 dark:text-emerald-400"
            >
              Symptom log recorded
            </span>
          )}
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700"
          >
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            Log Daily Symptoms
          </button>
        </div>
      </div>
    </form>
  );
}
