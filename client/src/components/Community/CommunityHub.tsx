import { Award, CheckCircle2, Flame, Users } from 'lucide-react';
import { useState } from 'react';
import { formatCO2Savings, formatStreakLabel } from '../../utils/formatters';
import {
  INITIAL_BROADCASTS,
  INITIAL_REPORTS,
  buildCommunityBadges,
  type CrowdsourcedReport,
  type EmergencyBroadcast,
} from './communityData';
import { CrowdsourcedReportsPanel } from './CrowdsourcedReportsPanel';
import { EmergencyBroadcastBanner } from './EmergencyBroadcastBanner';
import { EnvironmentalJustice } from './EnvironmentalJustice';
import { Leaderboard } from './Leaderboard';
import { COMMUNITY_PLEDGES, PledgeSystem } from './PledgeSystem';

export interface CommunityHubProps {
  currentAqi: number;
  locationName: string;
}

export function CommunityHub({ currentAqi, locationName }: CommunityHubProps) {
  const [streakDays, setStreakDays] = useState<number>(7);
  const [checkedInToday, setCheckedInToday] = useState<boolean>(false);
  const [completedPledges, setCompletedPledges] = useState<string[]>([
    'pledge-carpool',
    'pledge-no-waste-burning',
  ]);
  const [joinedCarpoolChallenge, setJoinedCarpoolChallenge] = useState<boolean>(true);
  const [leaderboardOptIn, setLeaderboardOptIn] = useState<boolean>(false);
  const [reports, setReports] = useState<CrowdsourcedReport[]>(INITIAL_REPORTS);
  const [broadcasts, setBroadcasts] = useState<EmergencyBroadcast[]>(INITIAL_BROADCASTS);

  const userPledgeCo2 = COMMUNITY_PLEDGES.filter((p) => completedPledges.includes(p.id)).reduce(
    (sum, p) => sum + p.co2Kg,
    0,
  );
  // Baseline community avoided CO2 = 194 kg + user's active pledges (default 40 kg => 234 kg CO2)
  const communityTotalCo2Kg = 194 + userPledgeCo2;

  const userPoints =
    260 +
    streakDays * 20 +
    COMMUNITY_PLEDGES.filter((p) => completedPledges.includes(p.id)).reduce(
      (sum, p) => sum + p.points,
      0,
    ) +
    (joinedCarpoolChallenge ? 150 : 0);

  const badges = buildCommunityBadges({
    streakDays,
    completedPledges,
    hasSubmittedReport: reports.length > INITIAL_REPORTS.length,
  });

  const handleDailyCheckIn = () => {
    if (checkedInToday) return;
    setCheckedInToday(true);
    setStreakDays((prev) => prev + 1);
  };

  const handleTogglePledge = (pledgeId: string) => {
    setCompletedPledges((prev) =>
      prev.includes(pledgeId) ? prev.filter((id) => id !== pledgeId) : [...prev, pledgeId],
    );
  };

  const handleAddReport = (report: CrowdsourcedReport) => {
    setReports((prev) => [report, ...prev]);
  };

  const handleAcknowledgeBroadcast = (broadcastId: string) => {
    setBroadcasts((prev) =>
      prev.map((item) => (item.id === broadcastId ? { ...item, acknowledged: true } : item)),
    );
  };

  const progressPct = Math.min(100, Math.round((communityTotalCo2Kg / 300) * 100));

  return (
    <div className="space-y-6 motion-reduce:transition-none">
      {/* Header & Streak / Collective Impact Summary */}
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
            onClick={handleDailyCheckIn}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-cyan-700 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-cyan-800 disabled:bg-emerald-700"
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            {checkedInToday ? 'Checked In Today' : 'Daily Check-In (+20 pts)'}
          </button>
        </div>
      </div>

      <EmergencyBroadcastBanner
        broadcasts={broadcasts}
        onAcknowledge={handleAcknowledgeBroadcast}
      />

      {/* Monthly Challenge + Achievement Badges */}
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
            Log 3 shared rides or transit commutes this week to earn +150 bonus resilience points
            and help your district beat last month&apos;s NO2 peak.
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
            onClick={() => setJoinedCarpoolChallenge((prev) => !prev)}
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

      {/* Pledge System + Crowdsourced Reporting & Smog Photo Sharing */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7">
          <PledgeSystem
            completedIds={completedPledges}
            onTogglePledge={handleTogglePledge}
            communityTotalCo2Kg={communityTotalCo2Kg}
          />
        </div>

        <CrowdsourcedReportsPanel
          reports={reports}
          defaultZone={locationName}
          defaultAqi={currentAqi}
          onAddReport={handleAddReport}
        />
      </div>

      <EnvironmentalJustice />

      <Leaderboard
        optedIn={leaderboardOptIn}
        onToggleOptIn={setLeaderboardOptIn}
        userPoints={userPoints}
        userStreakDays={streakDays}
        userCo2Kg={userPledgeCo2}
      />
    </div>
  );
}
