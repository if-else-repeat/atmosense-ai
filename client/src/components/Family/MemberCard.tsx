import { AlertTriangle, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react';
import {
  ACTIVITY_PATTERN_LABELS,
  HEALTH_CONDITION_LABELS,
  type FamilyMember,
} from '../../types/family';
import { getMemberInitials } from '../../utils/formatters';

export interface MemberCardProps {
  member: FamilyMember;
  isSelected: boolean;
  currentAqi: number;
  onSelect: (memberId: string) => void;
  onRemove: (memberId: string) => void;
}

/** Selectable household member summary card with vulnerability indicator and live AQI risk note. */
export function MemberCard({
  member,
  isSelected,
  currentAqi,
  onSelect,
  onRemove,
}: MemberCardProps) {
  const isVulnerable = member.sensitivityLevel === 'high';

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        isSelected
          ? 'border-cyan-700 bg-cyan-50/40 dark:border-cyan-500 dark:bg-cyan-950/25'
          : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => onSelect(member.id)}
          aria-pressed={isSelected}
          className="flex flex-1 items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700"
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
            style={{ backgroundColor: member.avatarColor }}
            aria-hidden="true"
          >
            {getMemberInitials(member.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {member.name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {member.relationship} · Age {member.age}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onRemove(member.id)}
          aria-label={`Remove ${member.name}`}
          className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/50 dark:hover:text-rose-300"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {isVulnerable ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 font-medium text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/60 dark:text-rose-200">
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
            Vulnerable Person
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-medium capitalize text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {member.sensitivityLevel} sensitivity
          </span>
        )}

        {member.healthConditions.length > 0 && (
          <span className="text-slate-600 dark:text-slate-400">
            {member.healthConditions.map((c) => HEALTH_CONDITION_LABELS[c]).join(', ')}
          </span>
        )}
      </div>

      {member.activityPatterns.length > 0 && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Routine: {member.activityPatterns.map((a) => ACTIVITY_PATTERN_LABELS[a]).join(' · ')}
        </p>
      )}

      {isVulnerable && currentAqi >= 100 && (
        <p className="mt-2 flex items-center gap-1 text-xs font-medium text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Elevated exposure risk at current AQI ({Math.round(currentAqi)})
        </p>
      )}
    </div>
  );
}
