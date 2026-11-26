import { AlertOctagon, Megaphone } from 'lucide-react';
import type { EmergencyBroadcast } from './communityData';

export interface EmergencyBroadcastBannerProps {
  broadcasts: EmergencyBroadcast[];
  onAcknowledge: (broadcastId: string) => void;
}

export function EmergencyBroadcastBanner({
  broadcasts,
  onAcknowledge,
}: EmergencyBroadcastBannerProps) {
  return (
    <section aria-labelledby="emergency-broadcast-heading" className="space-y-2.5">
      <h3 id="emergency-broadcast-heading" className="sr-only">
        Geotargeted Emergency Broadcast System
      </h3>
      {broadcasts.map((alert) => (
        <div
          key={alert.id}
          role="region"
          aria-label={`Emergency broadcast for ${alert.zone}`}
          className="flex flex-col justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50/80 p-4 sm:flex-row sm:items-center dark:border-rose-900/60 dark:bg-rose-950/40"
        >
          <div className="flex items-start gap-3">
            <Megaphone
              className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-400"
              aria-hidden="true"
            />
            <div>
              <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-rose-900 dark:text-rose-200">
                <AlertOctagon className="h-3.5 w-3.5" aria-hidden="true" />
                Geotargeted Emergency Broadcast · {alert.zone} · {alert.issuedAt}
              </p>
              <p className="mt-1 text-sm text-rose-950 dark:text-rose-100">{alert.message}</p>
            </div>
          </div>

          <button
            type="button"
            disabled={alert.acknowledged}
            onClick={() => onAcknowledge(alert.id)}
            className="shrink-0 whitespace-nowrap rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-900 hover:bg-rose-100 disabled:opacity-60 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-200"
          >
            {alert.acknowledged ? 'Alert Acknowledged' : 'Acknowledge Alert'}
          </button>
        </div>
      ))}
    </section>
  );
}
