/**
 * Loading skeleton placeholders for AQIDashboard and lazy-loaded dashboard panels.
 */

export function DashboardLoadingSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading live air quality telemetry"
      className="space-y-6"
      data-testid="aqi-dashboard-skeleton"
    >
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-3">
            <div className="h-4 w-44 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="flex items-baseline gap-4">
              <div className="h-16 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-6 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="h-3.5 w-64 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map((idx) => (
              <div
                key={idx}
                className="h-14 w-24 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800/80"
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((idx) => (
          <div
            key={idx}
            className="h-40 animate-pulse rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="mt-5 h-8 w-20 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="mt-6 h-2 w-full rounded bg-slate-100 dark:bg-slate-800" />
          </div>
        ))}
      </div>

      <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="h-4 w-48 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="mt-4 h-52 rounded-lg bg-slate-100 dark:bg-slate-800/70" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900" />
        <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900" />
      </div>
    </div>
  );
}

export function ForecastChartSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading 24-hour forecast chart"
      className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="h-4 w-44 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-4 h-52 rounded-lg bg-slate-100 dark:bg-slate-800/70" />
    </div>
  );
}

export function ActionHubSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading winter smog action hub"
      className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="h-5 w-64 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="h-40 rounded-lg bg-slate-100 dark:bg-slate-800/70" />
        <div className="h-40 rounded-lg bg-slate-100 dark:bg-slate-800/70" />
      </div>
    </div>
  );
}
