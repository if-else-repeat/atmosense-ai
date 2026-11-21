import { CheckCircle2, Circle, Leaf, Share2 } from 'lucide-react';
import { useState } from 'react';
import { formatCO2Savings } from '../../utils/formatters';

export interface PledgeItem {
  id: string;
  title: string;
  description: string;
  co2Kg: number;
  points: number;
  communityParticipants: number;
}

export const COMMUNITY_PLEDGES: PledgeItem[] = [
  {
    id: 'pledge-carpool',
    title: 'Carpool instead of driving alone',
    description: 'Share weekday commutes or take public transit at least 3 days a week.',
    co2Kg: 18,
    points: 120,
    communityParticipants: 142,
  },
  {
    id: 'pledge-clean-heating',
    title: 'Switch to clean heating',
    description: 'Use electric heat pumps or clean cooking/heating fuels instead of wood or coal.',
    co2Kg: 26,
    points: 150,
    communityParticipants: 89,
  },
  {
    id: 'pledge-dust-control',
    title: 'Dust control at construction site',
    description: 'Cover dry gravel, mist excavation zones, and report uncovered dust plumes.',
    co2Kg: 12,
    points: 100,
    communityParticipants: 64,
  },
  {
    id: 'pledge-no-waste-burning',
    title: 'No waste burning',
    description: 'Compost yard trimmings and recycle household waste instead of open burning.',
    co2Kg: 22,
    points: 130,
    communityParticipants: 178,
  },
  {
    id: 'pledge-vulnerable-neighbor',
    title: 'Check on vulnerable neighbor',
    description: 'Alert elderly or asthmatic neighbors ahead of AQI > 150 advisories.',
    co2Kg: 6,
    points: 110,
    communityParticipants: 116,
  },
];

interface PledgeSystemProps {
  completedIds: string[];
  onTogglePledge: (pledgeId: string) => void;
  communityTotalCo2Kg: number;
}

export function PledgeSystem({
  completedIds,
  onTogglePledge,
  communityTotalCo2Kg,
}: PledgeSystemProps) {
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const userCo2 = COMMUNITY_PLEDGES.filter((p) => completedIds.includes(p.id)).reduce(
    (sum, p) => sum + p.co2Kg,
    0,
  );

  const handleShareAchievements = async () => {
    const shareText = `I completed ${completedIds.length}/${COMMUNITY_PLEDGES.length} clean-air pledges on AtmoSense AI (${formatCO2Savings(userCo2)} personally avoided; our community avoided ${formatCO2Savings(communityTotalCo2Kg)} this month).`;

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({
          title: 'AtmoSense AI Clean Air Pledge',
          text: shareText,
        });
        setShareFeedback('Achievement shared.');
      } else if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        setShareFeedback('Achievement summary copied to clipboard.');
      } else {
        setShareFeedback(shareText);
      }
    } catch {
      setShareFeedback('Ready to share: ' + shareText);
    }
    setTimeout(() => setShareFeedback(null), 4000);
  };

  return (
    <section
      aria-labelledby="pledge-system-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
        <div>
          <h3
            id="pledge-system-heading"
            className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            <Leaf className="h-4 w-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            Clean Air Pledge System
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Track actionable household commitments and measure collective emissions avoided.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleShareAchievements()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
        >
          <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
          Share Achievement
        </button>
      </div>

      {/* Collective Impact Callout */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs dark:border-emerald-900/50 dark:bg-emerald-950/40">
        <p className="font-medium text-emerald-950 dark:text-emerald-200">
          Your community avoided{' '}
          <span className="font-mono font-bold tabular-nums">
            {formatCO2Savings(communityTotalCo2Kg)}
          </span>{' '}
          this month
        </p>
        <p className="font-mono tabular-nums text-emerald-800 dark:text-emerald-300">
          Your pledges: {completedIds.length}/{COMMUNITY_PLEDGES.length} (
          {formatCO2Savings(userCo2)})
        </p>
      </div>

      {shareFeedback && (
        <p
          role="status"
          className="mt-3 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-900 dark:border-cyan-900/60 dark:bg-cyan-950/40 dark:text-cyan-200"
        >
          {shareFeedback}
        </p>
      )}

      <ul className="mt-4 space-y-2.5">
        {COMMUNITY_PLEDGES.map((pledge) => {
          const completed = completedIds.includes(pledge.id);
          return (
            <li key={pledge.id}>
              <button
                type="button"
                aria-pressed={completed}
                onClick={() => onTogglePledge(pledge.id)}
                className={`flex w-full items-start justify-between gap-3 rounded-lg border p-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700 ${
                  completed
                    ? 'border-emerald-600 bg-emerald-50/50 dark:border-emerald-600/70 dark:bg-emerald-950/30'
                    : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-start gap-3">
                  {completed ? (
                    <CheckCircle2
                      className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400"
                      aria-hidden="true"
                    />
                  ) : (
                    <Circle
                      className="mt-0.5 h-5 w-5 shrink-0 text-slate-400 dark:text-slate-600"
                      aria-hidden="true"
                    />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {pledge.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                      {pledge.description}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-right font-mono text-xs tabular-nums">
                  <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                    -{pledge.co2Kg} kg CO2
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">+{pledge.points} pts</p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
