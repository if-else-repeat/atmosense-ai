import { AlertTriangle, ArrowDown, RefreshCw, ShieldAlert, WifiOff } from 'lucide-react';

export const PULL_TRIGGER_PX = 68;

export interface DashboardBannersProps {
  pullDistance: number;
  isOffline: boolean;
  isFromCache: boolean;
  serviceWorkerActive: boolean;
  loading: boolean;
  error: string | null;
  hasData: boolean;
  onRefresh: () => void;
}

export function DashboardBanners({
  pullDistance,
  isOffline,
  isFromCache,
  serviceWorkerActive,
  loading,
  error,
  hasData,
  onRefresh,
}: DashboardBannersProps) {
  return (
    <>
      {pullDistance > 12 && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50/80 py-2 text-xs font-medium text-cyan-800 dark:border-cyan-800/70 dark:bg-cyan-950/40 dark:text-cyan-300"
        >
          <ArrowDown
            className={`h-3.5 w-3.5 transition-transform duration-150 ${
              pullDistance >= PULL_TRIGGER_PX ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
          <span>
            {pullDistance >= PULL_TRIGGER_PX
              ? 'Release to refresh air quality data'
              : 'Pull down to refresh'}
          </span>
        </div>
      )}

      {(isOffline || isFromCache) && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/45 dark:text-amber-200"
        >
          <div className="flex items-center gap-2.5">
            <WifiOff
              className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400"
              aria-hidden="true"
            />
            <span>
              <strong>Offline mode</strong>
              {serviceWorkerActive
                ? ' — Service Worker is serving cached air quality readings.'
                : ' — displaying last cached air quality readings.'}
            </span>
          </div>
          {!isOffline && (
            <button
              type="button"
              onClick={onRefresh}
              className="whitespace-nowrap font-medium underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
            >
              Sync live data
            </button>
          )}
        </div>
      )}

      {!loading && error && !hasData && (
        <section
          role="alert"
          className="rounded-xl border border-red-200 bg-white p-6 dark:border-red-900/70 dark:bg-slate-900"
        >
          <div className="flex items-start gap-3">
            <ShieldAlert
              className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                Unable to load live air quality data
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{error}</p>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={onRefresh}
                  className="inline-flex items-center gap-2 rounded-lg bg-cyan-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 dark:bg-cyan-600 dark:hover:bg-cyan-500 dark:focus-visible:ring-offset-slate-900"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  Retry
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {error && hasData && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Refresh failed: {error}</span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-800 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 dark:border-red-800 dark:bg-slate-900 dark:text-red-200"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            Retry
          </button>
        </div>
      )}
    </>
  );
}
