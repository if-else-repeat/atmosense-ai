import { Award, Eye, EyeOff } from 'lucide-react';

export interface LeaderboardEntry {
  rank: number;
  alias: string;
  neighborhood: string;
  points: number;
  streakDays: number;
  co2AvoidedKg: number;
  isCurrentUser?: boolean;
}

interface LeaderboardProps {
  optedIn: boolean;
  onToggleOptIn: (optedIn: boolean) => void;
  userPoints: number;
  userStreakDays: number;
  userCo2Kg: number;
}

const COMMUNITY_PEERS: Omit<LeaderboardEntry, 'rank'>[] = [
  {
    alias: 'CleanAir-Cedar-42',
    neighborhood: 'North Parklands (Zone A)',
    points: 840,
    streakDays: 19,
    co2AvoidedKg: 58,
  },
  {
    alias: 'BreezeWatch-09',
    neighborhood: 'West Riverfront (Zone C)',
    points: 720,
    streakDays: 14,
    co2AvoidedKg: 49,
  },
  {
    alias: 'GreenTransit-77',
    neighborhood: 'Central Transit Hub (Zone D)',
    points: 615,
    streakDays: 11,
    co2AvoidedKg: 42,
  },
  {
    alias: 'EastCorridor-Ally-15',
    neighborhood: 'East Freight Belt (Zone B)',
    points: 510,
    streakDays: 8,
    co2AvoidedKg: 35,
  },
];

export function Leaderboard({
  optedIn,
  onToggleOptIn,
  userPoints,
  userStreakDays,
  userCo2Kg,
}: LeaderboardProps) {
  const combined: Omit<LeaderboardEntry, 'rank'>[] = optedIn
    ? [
        ...COMMUNITY_PEERS,
        {
          alias: 'You (Anonymous #204)',
          neighborhood: 'Your Active Zone',
          points: userPoints,
          streakDays: userStreakDays,
          co2AvoidedKg: userCo2Kg,
          isCurrentUser: true,
        },
      ]
    : COMMUNITY_PEERS;

  const ranked: LeaderboardEntry[] = [...combined]
    .sort((a, b) => b.points - a.points)
    .map((entry, idx) => ({
      ...entry,
      rank: idx + 1,
    }));

  return (
    <section
      aria-labelledby="leaderboard-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
        <div>
          <h3
            id="leaderboard-heading"
            className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            <Award className="h-4 w-4 text-cyan-700 dark:text-cyan-400" aria-hidden="true" />
            Anonymous Neighborhood Leaderboard
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Opt-in only. Real names and exact home addresses are never shown.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={optedIn}
          onClick={() => onToggleOptIn(!optedIn)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            optedIn
              ? 'border-cyan-700 bg-cyan-50 text-cyan-900 dark:border-cyan-500 dark:bg-cyan-950/60 dark:text-cyan-200'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          {optedIn ? (
            <>
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              Opted In (Anonymous)
            </>
          ) : (
            <>
              <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
              Opt In to Leaderboard
            </>
          )}
        </button>
      </div>

      {/* Accessible Semantic Table Format */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">
            Opt-in anonymous neighborhood air quality resilience leaderboard showing rank, alias,
            neighborhood, resilience points, check-in streak, and CO2 avoided.
          </caption>
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <th scope="col" className="py-2.5 pr-4 font-semibold">
                Rank
              </th>
              <th scope="col" className="py-2.5 pr-4 font-semibold">
                Anonymous Alias
              </th>
              <th scope="col" className="py-2.5 pr-4 font-semibold">
                Neighborhood
              </th>
              <th scope="col" className="py-2.5 pr-4 text-right font-semibold">
                Points
              </th>
              <th scope="col" className="py-2.5 pr-4 text-right font-semibold">
                Streak
              </th>
              <th scope="col" className="py-2.5 text-right font-semibold">
                CO2 Avoided
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {ranked.map((row) => (
              <tr
                key={row.alias}
                className={
                  row.isCurrentUser
                    ? 'bg-cyan-50/70 font-medium text-slate-900 dark:bg-cyan-950/30 dark:text-slate-100'
                    : 'text-slate-700 dark:text-slate-300'
                }
              >
                <td className="whitespace-nowrap py-3 pr-4 font-mono tabular-nums">#{row.rank}</td>
                <td className="whitespace-nowrap py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">
                  {row.alias}
                </td>
                <td className="whitespace-nowrap py-3 pr-4 text-xs text-slate-600 dark:text-slate-400">
                  {row.neighborhood}
                </td>
                <td className="whitespace-nowrap py-3 pr-4 text-right font-mono font-semibold tabular-nums">
                  {row.points.toLocaleString('en-US')}
                </td>
                <td className="whitespace-nowrap py-3 pr-4 text-right font-mono text-xs tabular-nums">
                  {row.streakDays}-day streak
                </td>
                <td className="whitespace-nowrap py-3 text-right font-mono text-xs tabular-nums text-emerald-700 dark:text-emerald-400">
                  {row.co2AvoidedKg} kg CO2
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
