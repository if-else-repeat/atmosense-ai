export type HealthCondition = 'asthma' | 'copd' | 'heart_disease' | 'allergies';

export type SensitivityLevel = 'low' | 'medium' | 'high';

export type ActivityPattern = 'school' | 'work' | 'outdoor_sports';

export type SymptomSeverity = 'none' | 'mild' | 'moderate' | 'severe';

export type CorrelationStrength = 'weak' | 'moderate' | 'strong';

export type SymptomFieldKey =
  'coughing' | 'wheezing' | 'eyeIrritation' | 'shortnessOfBreath' | 'headache';

export interface FamilyMember {
  id: string;
  name: string;
  age: number;
  relationship: string;
  healthConditions: HealthCondition[];
  sensitivityLevel: SensitivityLevel;
  activityPatterns: ActivityPattern[];
  avatarColor: string;
  createdAt: number;
}

export interface SymptomLogEntry {
  id: string;
  memberId: string;
  timestamp: number;
  aqiAtLog: number;
  locationName: string;
  coughing: SymptomSeverity;
  wheezing: SymptomSeverity;
  eyeIrritation: SymptomSeverity;
  shortnessOfBreath: SymptomSeverity;
  headache: SymptomSeverity;
  notes?: string;
}

export interface FamilyHealthInsight {
  id: string;
  pattern: string;
  recommendation: string;
  correlationStrength: CorrelationStrength;
  affectedSymptom: string;
  averageAqiWhenReported: number;
  source: 'ai' | 'local-correlation';
}

export interface HealthPrivacyState {
  aiAnalysisConsent: boolean;
  consentUpdatedAt: number | null;
  encryptionEnabled: boolean;
}

export const HEALTH_CONDITION_LABELS: Record<HealthCondition, string> = {
  asthma: 'Asthma',
  copd: 'COPD',
  heart_disease: 'Heart disease',
  allergies: 'Allergies',
};

export const ACTIVITY_PATTERN_LABELS: Record<ActivityPattern, string> = {
  school: 'School',
  work: 'Work',
  outdoor_sports: 'Outdoor sports',
};

export const SYMPTOM_FIELD_LABELS: Record<SymptomFieldKey, string> = {
  coughing: 'Coughing',
  wheezing: 'Wheezing',
  eyeIrritation: 'Eye irritation',
  shortnessOfBreath: 'Shortness of breath',
  headache: 'Headache',
};

export const SEVERITY_SCORE: Record<SymptomSeverity, number> = {
  none: 0,
  mild: 1,
  moderate: 2,
  severe: 3,
};

export const AVATAR_PALETTE = [
  '#0E7490', // cyan-700
  '#1D4ED8', // blue-700
  '#047857', // emerald-700
  '#B45309', // amber-700
  '#6D28D9', // violet-700
  '#BE123C', // rose-700
] as const;
