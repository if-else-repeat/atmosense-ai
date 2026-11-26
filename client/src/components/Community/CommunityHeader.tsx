import { Award, CheckCircle2, Flame, Users } from 'lucide-react';
import { formatCO2Savings, formatStreakLabel } from '../../utils/formatters';
import type { CommunityBadge } from './communityData';

interface CommunityHeaderProps {
  streakDays: number;
  checkedInToday: boolean;
  onDailyCheckIn: () => void;
}

export function CommunityHeader({
  streakDays,
  checkedInToday,
  onDailyCheckIn,
}: CommunityHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          <Users className="h-6 w-6 text-cyan-700 dark:text-cyan-400" aria-hidden="true" />
          Community Resilience Hub
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Crowdsourced neighborhood reporting, environmental justice tracking, clean-air pledges,
          and geotargeted alerts.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
          aria-label={`Daily protection check-in streak: ${formatStreakLabel(streakDays)}`}
        >
          <Flame className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <span className="font-mono tabular-nums">{formatStreakLabel(streakDays)}</span>
        </div>

        <button
          type="button"
          disabled={checkedInToday}
          onClick={onDailyCheckIn}
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-cyan-700 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-cyan-800 disabled:bg-emerald-700"
        >
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          {checkedInToday ? 'Checked In Today' : 'Daily Check-In (+20 pts)'}
        </button>
      </div>
    </div>
  );
}

interface CommunityChallengeRowProps {
  communityTotalCo2Kg: number;
  progressPct: number;
  joinedCarpoolChallenge: boolean;
  onToggleCarpoolChallenge: () => void;
  badges: readonly CommunityBadge[];
  userPoints: number;
}

export function CommunityChallengeRow({
  communityTotalCo2Kg,
  progressPct,
  joinedCarpoolChallenge,
  onToggleCarpoolChallenge,
  badges,
  userPoints,
}: CommunityChallengeRowProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <section
        aria-labelledby="monthly-challenge-heading"
        className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-4 dark:border-slate-800 dark:bg-slate-900"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-400">
          Monthly Community Challenge
        </p>
        <h3
          id="monthly-challenge-heading"
          className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100"
        >
          Carpool Week
        </h3>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          Log 3 shared rides or transit commutes this week to earn +150 bonus resilience points and
          help your district beat last month&apos;s NO2 peak.
        </p>

        <div className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-400">Community Progress</span>
            <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {formatCO2Savings(communityTotalCo2Kg)} / 300 kg
            </span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
            role="progressbar"
            aria-label="Carpool Week community CO2 avoidance goal"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full bg-cyan-700 dark:bg-cyan-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <button
          type="button"
          aria-pressed={joinedCarpoolChallenge}
          onClick={onToggleCarpoolChallenge}
          className={`mt-4 w-full rounded-lg border px-4 py-2 text-xs font-semibold transition-colors ${
            joinedCarpoolChallenge
              ? 'border-emerald-600 bg-emerald-50 text-emerald-900 dark:border-emerald-600/70 dark:bg-emerald-950/40 dark:text-emerald-200'
              : 'border-cyan-700 bg-cyan-700 text-white hover:bg-cyan-800'
          }`}
        >
          {joinedCarpoolChallenge
            ? 'Enrolled in Carpool Week (+150 bonus pts active)'
            : 'Join Carpool Week (+150 bonus pts)'}
        </button>
      </section>

      <section
        aria-labelledby="badges-heading"
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-8 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
          <h3
            id="badges-heading"
            className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            <Award className="h-4 w-4 text-cyan-700 dark:text-cyan-400" aria-hidden="true" />
            Resilience Achievement Badges
          </h3>
          <span className="font-mono text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">
            {badges.filter((b) => b.unlocked).length} of {badges.length} unlocked ·{' '}
            {userPoints.toLocaleString('en-US')} pts
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {badges.map((badge) => {
            const Icon = badge.icon;
            return (
              <div
                key={badge.id}
                className={`rounded-lg border p-3 ${
                  badge.unlocked
                    ? 'border-cyan-200 bg-cyan-50/40 dark:border-cyan-900/60 dark:bg-cyan-950/30'
                    : 'border-slate-200 bg-slate-50/60 opacity-75 dark:border-slate-800 dark:bg-slate-950/40'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      badge.unlocked
                        ? 'text-cyan-700 dark:text-cyan-400'
                        : 'text-slate-400 dark:text-slate-600'
                    }`}
                    aria-hidden="true"
                  />
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {badge.title}
                  </p>
                </div>
                <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
                  {badge.description}
                </p>
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Status: {badge.unlocked ? 'Unlocked' : 'In progress'}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
