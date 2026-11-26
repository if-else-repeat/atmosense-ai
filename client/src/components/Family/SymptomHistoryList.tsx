import { Calendar, Trash2 } from 'lucide-react';
import { SYMPTOM_FIELD_LABELS, type SymptomLogEntry } from '../../types/family';
import { SYMPTOM_KEYS } from './SymptomLogForm';

interface SymptomHistoryListProps {
  memberName: string;
  memberLogs: readonly SymptomLogEntry[];
  onDeleteLog: (logId: string) => void;
}

export function SymptomHistoryList({
  memberName,
  memberLogs,
  onDeleteLog,
}: SymptomHistoryListProps) {
  return (
    <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
      <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
        Recent Logs ({memberLogs.length})
      </h4>

      {memberLogs.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          No symptom entries recorded for {memberName} yet. Log daily observations above to build
          AQI correlations.
        </p>
      ) : (
        <div className="mt-3">
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
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 md:contents">
                    <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {formattedTime}
                    </span>
                    <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      <span className="md:hidden">AQI </span>
                      {entry.aqiAtLog}
                    </span>
                  </div>

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

                  <p className="col-span-2 min-w-0 break-words font-medium text-slate-800 md:col-span-1 md:font-normal md:text-slate-700 dark:text-slate-200 dark:md:text-slate-300">
                    {activeList.length > 0 ? activeList.join(', ') : 'Symptom-free'}
                  </p>

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
  );
}
