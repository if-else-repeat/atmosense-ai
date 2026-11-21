import {
  AlertOctagon,
  Award,
  BookOpen,
  Camera,
  Car,
  CheckCircle2,
  Flame,
  HeartHandshake,
  Home,
  Megaphone,
  Send,
  Shield,
  Users,
} from 'lucide-react';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { formatCO2Savings, formatStreakLabel, getAQICategoryLabel } from '../../utils/formatters';
import { EnvironmentalJustice } from './EnvironmentalJustice';
import { Leaderboard } from './Leaderboard';
import { COMMUNITY_PLEDGES, PledgeSystem } from './PledgeSystem';

export interface CommunityHubProps {
  currentAqi: number;
  locationName: string;
}

interface CrowdsourcedReport {
  id: string;
  neighborhood: string;
  reportedAqi: number;
  visibility: 'Clear' | 'Light Haze' | 'Dense Smog' | 'Severe Smoke';
  note: string;
  photoDataUrl?: string;
  timestamp: string;
}

interface EmergencyBroadcast {
  id: string;
  zone: string;
  severity: 'Advisory' | 'Severe';
  message: string;
  issuedAt: string;
  acknowledged: boolean;
}

const INITIAL_REPORTS: CrowdsourcedReport[] = [
  {
    id: 'rep-1',
    neighborhood: 'East Freight & Industrial Belt (Zone B)',
    reportedAqi: 174,
    visibility: 'Dense Smog',
    note: 'Heavy morning haze near the rail overpass; noticeable particulate odor.',
    timestamp: '18 min ago',
  },
  {
    id: 'rep-2',
    neighborhood: 'North Parklands (Zone A)',
    reportedAqi: 46,
    visibility: 'Clear',
    note: 'Steady north-west breeze clearing valley floor; visibility > 10 km.',
    timestamp: '42 min ago',
  },
];

const INITIAL_BROADCASTS: EmergencyBroadcast[] = [
  {
    id: 'bc-1',
    zone: 'Zone B — East Freight & Industrial Belt',
    severity: 'Severe',
    message:
      'Geotargeted Health Alert: Morning thermal inversion trapping PM2.5 above 175 AQI. Schools advised to shift recess indoors until 11:30 AM.',
    issuedAt: 'Today, 07:30',
    acknowledged: false,
  },
];

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
  const [reportZone, setReportZone] = useState<string>(locationName);
  const [reportAqi, setReportAqi] = useState<string>(String(Math.round(currentAqi)));
  const [reportVisibility, setReportVisibility] =
    useState<CrowdsourcedReport['visibility']>('Light Haze');
  const [reportNote, setReportNote] = useState<string>('');
  const [photoPreview, setPhotoPreview] = useState<string | undefined>(undefined);
  const [reportStatus, setReportStatus] = useState<string | null>(null);

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

  const badges = [
    {
      id: 'first-week',
      title: 'First Week Protected',
      description: 'Maintained a 7-day air quality check-in streak.',
      unlocked: streakDays >= 7,
      icon: Flame,
    },
    {
      id: 'clean-commuter',
      title: 'Clean Commuter',
      description: 'Committed to carpooling or zero-emission commutes.',
      unlocked: completedPledges.includes('pledge-carpool'),
      icon: Car,
    },
    {
      id: 'iaq-master',
      title: 'IAQ Master',
      description: 'Applied indoor filtration and clean heating practices.',
      unlocked: completedPledges.includes('pledge-clean-heating'),
      icon: Home,
    },
    {
      id: 'community-guardian',
      title: 'Community Guardian',
      description: 'Submitted a verified local air quality observation.',
      unlocked:
        reports.length > INITIAL_REPORTS.length ||
        completedPledges.includes('pledge-no-waste-burning'),
      icon: Shield,
    },
    {
      id: 'family-protector',
      title: 'Family Protector',
      description: 'Pledged to check on vulnerable household members or neighbors.',
      unlocked: completedPledges.includes('pledge-vulnerable-neighbor'),
      icon: HeartHandshake,
    },
    {
      id: 'knowledge-seeker',
      title: 'Knowledge Seeker',
      description: 'Reviewed neighborhood environmental justice disparity metrics.',
      unlocked: true,
      icon: BookOpen,
    },
  ];

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

  const handlePhotoSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleReportSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedAqi = Number(reportAqi);
    if (!reportZone.trim() || !Number.isFinite(parsedAqi) || parsedAqi < 0 || parsedAqi > 500) {
      return;
    }

    const newReport: CrowdsourcedReport = {
      id: `rep-${Date.now().toString(36)}`,
      neighborhood: reportZone.trim(),
      reportedAqi: Math.round(parsedAqi),
      visibility: reportVisibility,
      note: reportNote.trim() || 'Community sky condition report submitted.',
      photoDataUrl: photoPreview,
      timestamp: 'Just now',
    };

    setReports((prev) => [newReport, ...prev]);
    setReportNote('');
    setPhotoPreview(undefined);
    setReportStatus('Community observation published to your local zone feed.');
    setTimeout(() => setReportStatus(null), 3500);
  };

  const handleAcknowledgeBroadcast = (broadcastId: string) => {
    setBroadcasts((prev) =>
      prev.map((item) => (item.id === broadcastId ? { ...item, acknowledged: true } : item)),
    );
  };

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
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-700 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-cyan-800 disabled:bg-emerald-700 whitespace-nowrap shrink-0"
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            {checkedInToday ? 'Checked In Today' : 'Daily Check-In (+20 pts)'}
          </button>
        </div>
      </div>

      {/* Geotargeted Emergency Broadcast System */}
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
              onClick={() => handleAcknowledgeBroadcast(alert.id)}
              className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-900 hover:bg-rose-100 disabled:opacity-60 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-200 whitespace-nowrap shrink-0"
            >
              {alert.acknowledged ? 'Alert Acknowledged' : 'Acknowledge Alert'}
            </button>
          </div>
        ))}
      </section>

      {/* Monthly Challenge + Achievement Badges */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Monthly Challenge Card */}
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
              aria-valuenow={Math.min(100, Math.round((communityTotalCo2Kg / 300) * 100))}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full bg-cyan-700 dark:bg-cyan-500"
                style={{
                  width: `${Math.min(100, Math.round((communityTotalCo2Kg / 300) * 100))}%`,
                }}
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

        {/* 6 Achievement Badges */}
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

        <section
          aria-labelledby="crowdsource-heading"
          className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-5 dark:border-slate-800 dark:bg-slate-900"
        >
          <h3
            id="crowdsource-heading"
            className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            <Camera className="h-4 w-4 text-cyan-700 dark:text-cyan-400" aria-hidden="true" />
            Crowdsourced AQI &amp; Smog Photo Report
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Share ground-level visibility observations or portable monitor readings with neighbors.
          </p>

          <form onSubmit={handleReportSubmit} className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="crowd-zone"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Neighborhood / Zone
                </label>
                <input
                  id="crowd-zone"
                  type="text"
                  required
                  maxLength={100}
                  value={reportZone}
                  onChange={(e) => setReportZone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-cyan-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label
                  htmlFor="crowd-aqi"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Observed AQI (0–500)
                </label>
                <input
                  id="crowd-aqi"
                  type="number"
                  min={0}
                  max={500}
                  required
                  value={reportAqi}
                  onChange={(e) => setReportAqi(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs text-slate-900 focus:border-cyan-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="crowd-visibility"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Local Sky Condition
                </label>
                <select
                  id="crowd-visibility"
                  value={reportVisibility}
                  onChange={(e) =>
                    setReportVisibility(e.target.value as CrowdsourcedReport['visibility'])
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-cyan-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="Clear">Clear</option>
                  <option value="Light Haze">Light Haze</option>
                  <option value="Dense Smog">Dense Smog</option>
                  <option value="Severe Smoke">Severe Smoke</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="crowd-photo"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Local Smog Photo (Optional)
                </label>
                <input
                  id="crowd-photo"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="mt-1 block w-full text-xs text-slate-600 file:mr-2 file:rounded-md file:border file:border-slate-300 file:bg-slate-50 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-slate-700 dark:text-slate-400 dark:file:border-slate-700 dark:file:bg-slate-900 dark:file:text-slate-200"
                />
              </div>
            </div>

            {photoPreview && (
              <img
                src={photoPreview}
                alt="Preview of uploaded local air quality condition"
                className="h-28 w-full rounded-lg border border-slate-200 object-cover dark:border-slate-800"
              />
            )}

            <div>
              <label
                htmlFor="crowd-note"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Observation Details
              </label>
              <textarea
                id="crowd-note"
                rows={2}
                maxLength={240}
                value={reportNote}
                onChange={(e) => setReportNote(e.target.value)}
                placeholder="Visible haze along arterial highway, moderate dust near construction..."
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-cyan-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              {reportStatus ? (
                <span
                  role="status"
                  className="text-xs font-medium text-emerald-700 dark:text-emerald-400"
                >
                  {reportStatus}
                </span>
              ) : (
                <span className="text-xs text-slate-400">De-identified local feed</span>
              )}
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-700 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-cyan-800"
              >
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                Submit Report
              </button>
            </div>
          </form>

          {/* Recent Community Reports */}
          <div className="mt-5 space-y-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Recent Local Observations ({reports.length})
            </h4>
            {reports.slice(0, 4).map((rep) => (
              <article
                key={rep.id}
                className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {rep.neighborhood}
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    AQI {rep.reportedAqi} ({getAQICategoryLabel(rep.reportedAqi)})
                  </span>
                </div>
                <p className="mt-1 text-slate-600 dark:text-slate-400">
                  {rep.visibility} · {rep.note}
                </p>
                {rep.photoDataUrl && (
                  <img
                    src={rep.photoDataUrl}
                    alt={`Local smog report in ${rep.neighborhood}`}
                    className="mt-2 h-24 w-full rounded-md object-cover"
                  />
                )}
                <p className="mt-1 text-[11px] text-slate-400">{rep.timestamp}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      {/* Environmental Justice Heatmap */}
      <EnvironmentalJustice />

      {/* Opt-In Anonymous Leaderboard */}
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
