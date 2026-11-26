import { Activity } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type {
  FamilyMember,
  SymptomFieldKey,
  SymptomLogEntry,
  SymptomSeverity,
} from '../../types/family';
import { formatAQI, getAQICategoryLabel } from '../../utils/formatters';
import { SymptomHistoryList } from './SymptomHistoryList';
import { INITIAL_SEVERITIES, SymptomLogForm } from './SymptomLogForm';

interface SymptomTrackerProps {
  member: FamilyMember;
  currentAqi: number;
  locationName: string;
  logs: SymptomLogEntry[];
  onAddLog: (entry: Omit<SymptomLogEntry, 'id'>) => void;
  onDeleteLog: (logId: string) => void;
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
    ...INITIAL_SEVERITIES,
  });
  const [notes, setNotes] = useState('');
  const [justLogged, setJustLogged] = useState(false);

  const memberLogs = logs
    .filter((entry) => entry.memberId === member.id)
    .sort((a, b) => b.timestamp - a.timestamp);

  const handleSeverityChange = (key: SymptomFieldKey, level: SymptomSeverity) => {
    setSeverities((prev) => ({ ...prev, [key]: level }));
  };

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
    setSeverities({ ...INITIAL_SEVERITIES });
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

      <SymptomLogForm
        severities={severities}
        notes={notes}
        locationName={locationName}
        justLogged={justLogged}
        onSeverityChange={handleSeverityChange}
        onNotesChange={setNotes}
        onSubmit={handleSubmit}
      />

      <SymptomHistoryList
        memberName={member.name}
        memberLogs={memberLogs}
        onDeleteLog={onDeleteLog}
      />
    </section>
  );
}
