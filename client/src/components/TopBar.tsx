import { Bookmark, Moon, RefreshCw, Sun } from 'lucide-react';
import type { ActiveTab } from '../types/airQuality';
import { PWAInstallButton } from './PWAInstallButton';

interface TopBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  savedCount: number;
  isDark: boolean;
  onToggleTheme: () => void;
  refreshing: boolean;
  loadingStations: boolean;
  isOnline: boolean;
  onRefresh: () => void;
}

const NAV_ITEMS: ReadonlyArray<{ id: ActiveTab; label: string }> = [
  { id: 'monitor', label: 'Monitor' },
  { id: 'map', label: 'Map' },
  { id: 'family', label: 'Family' },
  { id: 'community', label: 'Community' },
  { id: 'assistant', label: 'Health AI' },
];

export function TopBar({
  activeTab,
  onSelectTab,
  savedCount,
  isDark,
  onToggleTheme,
  refreshing,
  loadingStations,
  isOnline,
  onRefresh,
}: TopBarProps) {
  const isSavedActive = activeTab === 'saved';

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Brand Wordmark */}
        <a
          href="#monitor"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('monitor');
          }}
          className="font-display text-lg font-bold tracking-tight text-slate-900 transition-colors hover:text-cyan-800 dark:text-slate-100 dark:hover:text-cyan-300 whitespace-nowrap shrink-0"
        >
          AtmoSense AI
        </a>

        {/* Zone 2: Desktop Primary Navigation */}
        <nav
          aria-label="Primary navigation"
          className="hidden items-center gap-5 text-sm font-medium md:flex lg:gap-7"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelectTab(item.id)}
                className={`border-b-2 py-5 text-sm transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'border-cyan-700 text-slate-950 dark:border-cyan-400 dark:text-white'
                    : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-100'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Top-Right Workspace Controls (Saved, Install, Refresh, Theme) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onSelectTab('saved')}
            aria-pressed={isSavedActive}
            aria-label={`Saved zones${savedCount > 0 ? ` (${savedCount})` : ''}`}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 sm:px-3 ${
              isSavedActive
                ? 'border-cyan-700 bg-cyan-50 text-cyan-900 dark:border-cyan-500 dark:bg-cyan-950/60 dark:text-cyan-200'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Saved</span>
            {savedCount > 0 && (
              <span className="rounded bg-cyan-700/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-cyan-900 dark:bg-cyan-400/20 dark:text-cyan-200">
                {savedCount}
              </span>
            )}
          </button>

          <PWAInstallButton />

          <button
            type="button"
            disabled={refreshing || loadingStations || !isOnline}
            onClick={onRefresh}
            aria-label="Refresh air quality readings"
            title={isOnline ? 'Refresh live readings' : 'Offline — using saved data'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-white disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span className="hidden lg:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            {isDark ? (
              <>
                <Sun className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Light</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Dark</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Primary Navigation Bar (< 768px) */}
      <nav
        aria-label="Mobile navigation"
        className="grid grid-cols-5 border-t border-slate-100 px-1 dark:border-slate-800 md:hidden"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={`mobile-${item.id}`}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onSelectTab(item.id)}
              className={`border-b-2 py-2.5 text-center text-[11px] font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'border-cyan-700 text-slate-950 dark:border-cyan-400 dark:text-white'
                  : 'border-transparent text-slate-600 dark:text-slate-400'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
