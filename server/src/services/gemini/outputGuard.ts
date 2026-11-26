/**
 * @module geminiOutputGuard
 * Prompt-injection scanner and runtime output safety guardrails verifying Gemini
 * responses against grounded AQI telemetry and clinical medical-safety boundaries.
 */

export interface InjectionScanResult {
  detected: boolean;
  reasons: string[];
}

export interface OutputSafetyResult {
  safe: boolean;
  reason?: string;
}

const INJECTION_SIGNATURES: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  {
    label: 'instruction-override',
    pattern:
      /ignore\s+(?:all\s+|any\s+)?(?:previous|prior|above)\s+(?:instructions?|prompts?|rules?)/i,
  },
  {
    label: 'directive-disregard',
    pattern:
      /disregard\s+(?:all\s+|any\s+)?(?:previous|prior|system)\s+(?:instructions?|directives?)/i,
  },
  {
    label: 'memory-wipe',
    pattern: /forget\s+(?:everything|all\s+previous|your\s+instructions)/i,
  },
  {
    label: 'role-hijack',
    pattern: /\byou\s+are\s+now\s+(?:a|an|in)\s+(?:developer|dan|jailbreak|unrestricted|system)/i,
  },
  {
    label: 'role-delimiter',
    pattern: /(?:^|\n)\s*(?:system|assistant|developer|model)\s*:/im,
  },
  {
    label: 'xml-tag-injection',
    pattern: /<\/?\s*(?:system|prompt|instructions?|override|tool_call)\b[^>]*>/i,
  },
  {
    label: 'prompt-exfiltration',
    pattern:
      /(?:reveal|print|dump|output|show)\s+(?:your\s+)?(?:system\s+prompt|hidden\s+instructions?|api\s+key)/i,
  },
  {
    label: 'invisible-unicode',
    pattern: /[\u200B-\u200F\u202A-\u202E\uFEFF]/,
  },
];

/** Unsafe medical dosing or medication-cessation advice patterns that must never reach users. */
const UNSAFE_MEDICAL_PATTERNS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  {
    label: 'unsafe-medication-cessation',
    pattern:
      /\b(?:stop\s+taking|discontinue|quit\s+using|throw\s+away)\s+(?:your\s+)?(?:prescribed\s+)?(?:inhaler|steroid|albuterol|salbutamol|budesonide|controller|asthma\s+medication|bronchodilator|prescription)/i,
  },
  {
    label: 'unsafe-dosage-prescription',
    pattern:
      /\b(?:take|increase\s+to|double\s+your\s+dose\s+to|administer|prescribe)\s+\d+(?:\.\d+)?\s*(?:mg|mcg|ml|puffs?)\s+(?:of\s+)?(?:prednisone|albuterol|salbutamol|steroid|inhaler|epinephrine|montelukast)/i,
  },
];

/** Scans untrusted user text for prompt-injection or smuggling signatures. */
export function scanPromptInjection(input: string): InjectionScanResult {
  if (typeof input !== 'string' || !input) {
    return { detected: false, reasons: [] };
  }
  const reasons: string[] = [];
  for (const sig of INJECTION_SIGNATURES) {
    if (sig.pattern.test(input)) {
      reasons.push(sig.label);
    }
  }
  return { detected: reasons.length > 0, reasons };
}

/**
 * Validates generated AI text against two hard guardrails:
 * 1. Numeric grounding: if the output explicitly cites a current AQI value that diverges
 *    by more than `maxAqiDivergence` (default 40) from grounded telemetry, reject it.
 * 2. Clinical safety: reject directives to stop prescribed inhalers/steroids or take specific mg doses.
 */
export function validateGeminiOutputSafety(
  outputText: string,
  options: { groundedAqi?: number; maxAqiDivergence?: number } = {},
): OutputSafetyResult {
  const { groundedAqi, maxAqiDivergence = 40 } = options;

  for (const rule of UNSAFE_MEDICAL_PATTERNS) {
    if (rule.pattern.test(outputText)) {
      return {
        safe: false,
        reason: `Blocked unsafe clinical directive (${rule.label}).`,
      };
    }
  }

  if (typeof groundedAqi === 'number' && Number.isFinite(groundedAqi)) {
    const currentAqiCitation =
      /\b(?:current|today(?:'s)?|live|local|measured)\s+AQI(?:\s+(?:is|of|at|reads?|level))?\s*[:=]?\s*(\d{1,3})\b/gi;
    let match: RegExpExecArray | null;
    while ((match = currentAqiCitation.exec(outputText)) !== null) {
      const citedAqi = Number(match[1]);
      if (Number.isFinite(citedAqi) && Math.abs(citedAqi - groundedAqi) > maxAqiDivergence) {
        return {
          safe: false,
          reason: `Hallucinated current AQI (${citedAqi}) diverges from grounded telemetry (${groundedAqi}) by more than ${maxAqiDivergence}.`,
        };
      }
    }
  }

  return { safe: true };
}
