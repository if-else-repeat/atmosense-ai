import {
  AlertTriangle,
  CheckCircle2,
  HeartPulse,
  Info,
  OctagonAlert,
  ShieldAlert,
} from 'lucide-react';
import type { PersonaHealthGuidance, PersonaProfile } from '../../types/aqi';

export interface HealthRecommendationProps {
  guidance: PersonaHealthGuidance;
  persona: PersonaProfile;
  onChangePersona: (persona: PersonaProfile) => void;
  onOpenAssistant?: () => void;
}

const PERSONA_OPTIONS: ReadonlyArray<{ id: PersonaProfile; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'asthmatics', label: 'Asthmatics' },
  { id: 'children', label: 'Children' },
  { id: 'elderly', label: 'Elderly' },
];

const RISK_STYLES: Readonly<
  Record<
    PersonaHealthGuidance['riskTier'],
    {
      label: string;
      textClass: string;
      Icon: typeof CheckCircle2;
    }
  >
> = {
  low: {
    label: 'Low Risk',
    textClass: 'text-emerald-700 dark:text-emerald-400',
    Icon: CheckCircle2,
  },
  moderate: {
    label: 'Moderate Risk',
    textClass: 'text-amber-700 dark:text-amber-400',
    Icon: Info,
  },
  elevated: {
    label: 'Sensitive Alert',
    textClass: 'text-orange-700 dark:text-orange-400',
    Icon: AlertTriangle,
  },
  high: {
    label: 'High Risk',
    textClass: 'text-red-700 dark:text-red-400',
    Icon: ShieldAlert,
  },
  critical: {
    label: 'Critical Alert',
    textClass: 'text-rose-800 dark:text-rose-400',
    Icon: OctagonAlert,
  },
};

/**
 * Persona-aware respiratory health recommendation panel with interactive
 * persona segmented selector, mask guidance, outdoor timing, and WHO/EPA citations.
 */
export function HealthRecommendation({
  guidance,
  persona,
  onChangePersona,
  onOpenAssistant,
}: HealthRecommendationProps) {
  const riskStyle = RISK_STYLES[guidance.riskTier];
  const RiskIcon = riskStyle.Icon;

  return (
    <section
      aria-labelledby="health-recommendation-heading"
      className="flex h-full flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
    >
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <HeartPulse className="h-4 w-4 text-cyan-700 dark:text-cyan-400" aria-hidden="true" />
            <h2
              id="health-recommendation-heading"
              className="font-display text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              Health Recommendation
            </h2>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold ${riskStyle.textClass}`}
          >
            <RiskIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{riskStyle.label}</span>
          </span>
        </div>

        {/* Interactive Persona Selector */}
        <div
          role="group"
          aria-label="Select health sensitivity profile"
          className="mt-4 flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800/80"
        >
          {PERSONA_OPTIONS.map((option) => {
            const active = persona === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => onChangePersona(option.id)}
                className={`flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-900 ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-950 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {/* Primary Clinical Guidance */}
        <div className="mt-4" aria-live="polite">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {guidance.headline}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {guidance.recommendation}
          </p>
        </div>

        {/* Structured Mask + Safe Window metadata */}
        <dl className="mt-4 grid grid-cols-1 gap-3 border-y border-slate-100 py-3 sm:grid-cols-2 dark:border-slate-800">
          <div>
            <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Respirator Guidance
            </dt>
            <dd className="mt-0.5 text-xs text-slate-800 dark:text-slate-200">
              {guidance.maskGuidance}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Best Outdoor Window
            </dt>
            <dd className="mt-0.5 font-mono text-xs font-medium text-slate-800 dark:text-slate-200">
              {guidance.safeOutdoorWindow}
            </dd>
          </div>
        </dl>

        {/* Actionable Steps */}
        <ul className="mt-3.5 space-y-2 text-xs text-slate-700 dark:text-slate-300">
          {guidance.actionItems.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span
                aria-hidden="true"
                className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cyan-700 dark:bg-cyan-400"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Footer citation & optional deep-dive action */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <span>{guidance.citation}</span>
        {onOpenAssistant && (
          <button
            type="button"
            onClick={onOpenAssistant}
            className="whitespace-nowrap font-medium text-cyan-700 hover:text-cyan-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 dark:text-cyan-400 dark:hover:text-cyan-300 dark:focus-visible:ring-offset-slate-900"
          >
            Open AI Health Assistant
          </button>
        )}
      </div>
    </section>
  );
}

export default HealthRecommendation;
