import { Activity, Calendar, ClipboardList, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  SYMPTOM_FIELD_LABELS,
  type FamilyMember,
  type SymptomFieldKey,
  type SymptomLogEntry,
  type SymptomSeverity,
} from '../../types/family';
import { formatAQI, getAQICategoryLabel } from '../../utils/formatters';

interface SymptomTrackerProps {
  member: FamilyMember;
  currentAqi: number;
  locationName: string;
  logs: SymptomLogEntry[];
  onAddLog: (entry: Omit<SymptomLogEntry, 'id'>) => void;
  onDeleteLog: (logId: string) => void;
}

const SEVERITY_OPTIONS: SymptomSeverity[] = ['none', 'mild', 'moderate', 'severe'];

const SYMPTOM_KEYS: SymptomFieldKey[] = [
  'coughing',
  'wheezing',
  'eyeIrritation',
  'shortnessOfBreath',
  'headache',
];

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

export function SymptomTracker({
  member,
  currentAqi,
  locationName,
  logs,
  onAddLog,
  onDeleteLog,
}: SymptomTrackerProps) {
  const [severities, setSeverities] = useState<Record<SymptomFieldKey, SymptomSeverity>>({
    coughing: 'none',
    wheezing: 'none',
    eyeIrritation: 'none',
    shortnessOfBreath: 'none',
    headache: 'none',
  });
  const [notes, setNotes] = useState('');
  const [justLogged, setJustLogged] = useState(false);

  const memberLogs = logs
    .filter((entry) => entry.memberId === member.id)
    .sort((a, b) => b.timestamp - a.timestamp);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onAddLog({
      memberId: member.id,
      timestamp: Date.now(),
      aqiAtLog: Math.max(0, Math.min(500, Math.round(currentAqi))),
      locationName,
      ...severities,
      notes: notes.trim() || undefined,
    });
    setSeverities({
      coughing: 'none',
      wheezing: 'none',
      eyeIrritation: 'none',
      shortnessOfBreath: 'none',
      headache: 'none',
    });
    setNotes('');
    setJustLogged(true);
    setTimeout(() => setJustLogged(false), 3000);
  };

  return (
    <section
      aria-labelledby="symptom-tracker-heading"
      className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
        <div>
          <h3
            id="symptom-tracker-heading"
            className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            <Activity className="h-4 w-4 text-cyan-700 dark:text-cyan-400" aria-hidden="true" />
            Daily Symptom Tracker — {member.name}
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Logs automatically capture timestamp and live ambient air quality for clinician review.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950">
          <span className="text-slate-500 dark:text-slate-400">Linked AQI: </span>
          <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {formatAQI(currentAqi)}
          </span>
          <span className="ml-1.5 text-slate-600 dark:text-slate-300">
            ({getAQICategoryLabel(currentAqi)})
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
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
                      onClick={() =>
                        setSeverities((prev) => ({
                          ...prev,
                          [key]: level,
                        }))
                      }
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
            onChange={(event) => setNotes(event.target.value)}
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

      {/* Recent symptom logs table */}
      <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
          Recent Logs ({memberLogs.length})
        </h4>

        {memberLogs.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            No symptom entries recorded for {member.name} yet. Log daily observations above to build
            AQI correlations.
          </p>
        ) : (
          <div className="mt-3">
            {/* Column headers visible on md+ */}
            <div
              aria-hidden="true"
              className="hidden border-b border-slate-200 pb-2 text-xs font-medium text-slate-500 md:grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.5fr)_minmax(0,1.8fr)_minmax(0,1.4fr)_auto] md:gap-3 dark:border-slate-800 dark:text-slate-400"
            >
              <span>Recorded</span>
              <span>AQI</span>
              <span>Reported Symptoms</span>
              <span>Notes</span>
              <span className="text-right">Action</span>
            </div>

            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {memberLogs.slice(0, 8).map((entry) => {
                const activeList = SYMPTOM_KEYS.filter((k) => entry[k] !== 'none').map(
                  (k) => `${SYMPTOM_FIELD_LABELS[k]} (${entry[k]})`,
                );
                const formattedTime = new Date(entry.timestamp).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <li
                    key={entry.id}
                    className="grid grid-cols-[1fr_auto] items-start gap-x-2 gap-y-1.5 py-3 text-xs text-slate-700 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.5fr)_minmax(0,1.8fr)_minmax(0,1.4fr)_auto] md:gap-3 dark:text-slate-300"
                  >
                    {/* Timestamp + AQI (inline on mobile, separate columns on md+) */}
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 md:contents">
                      <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
                        {formattedTime}
                      </span>
                      <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                        <span className="md:hidden">AQI </span>
                        {entry.aqiAtLog}
                      </span>
                    </div>

                    {/* Delete action (top-right on mobile, last column on md+) */}
                    <div className="text-right md:order-last">
                      <button
                        type="button"
                        onClick={() => onDeleteLog(entry.id)}
                        aria-label={`Delete symptom log from ${new Date(entry.timestamp).toLocaleDateString()}`}
                        className="inline-flex items-center rounded-md p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/50 dark:hover:text-rose-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>

                    {/* Reported symptoms */}
                    <p className="col-span-2 min-w-0 break-words font-medium text-slate-800 md:col-span-1 md:font-normal md:text-slate-700 dark:text-slate-200 dark:md:text-slate-300">
                      {activeList.length > 0 ? activeList.join(', ') : 'Symptom-free'}
                    </p>

                    {/* Optional notes */}
                    <p className="col-span-2 min-w-0 break-words text-slate-500 md:col-span-1 dark:text-slate-400">
                      {entry.notes || '—'}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
