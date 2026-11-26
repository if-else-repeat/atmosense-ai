import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  ACTIVITY_PATTERN_LABELS,
  HEALTH_CONDITION_LABELS,
  type ActivityPattern,
  type HealthCondition,
  type SensitivityLevel,
} from '../../types/family';

const ALL_CONDITIONS: HealthCondition[] = ['asthma', 'copd', 'heart_disease', 'allergies'];
const ALL_ACTIVITIES: ActivityPattern[] = ['school', 'work', 'outdoor_sports'];

export interface NewMemberDraft {
  name: string;
  age: number;
  relationship: string;
  healthConditions: HealthCondition[];
  sensitivityLevel: SensitivityLevel;
  activityPatterns: ActivityPattern[];
}

export interface AddMemberFormProps {
  onSubmit: (draft: NewMemberDraft) => void;
  onCancel: () => void;
}

/** Modular form for adding a new household member profile with respiratory conditions and routines. */
export function AddMemberForm({ onSubmit, onCancel }: AddMemberFormProps) {
  const [name, setName] = useState('');
  const [age, setAge] = useState('34');
  const [relationship, setRelationship] = useState('Child');
  const [conditions, setConditions] = useState<HealthCondition[]>([]);
  const [sensitivityLevel, setSensitivityLevel] = useState<SensitivityLevel>('medium');
  const [activities, setActivities] = useState<ActivityPattern[]>(['school']);

  const toggleCondition = (cond: HealthCondition) => {
    setConditions((prev) =>
      prev.includes(cond) ? prev.filter((item) => item !== cond) : [...prev, cond],
    );
  };

  const toggleActivity = (act: ActivityPattern) => {
    setActivities((prev) =>
      prev.includes(act) ? prev.filter((item) => item !== act) : [...prev, act],
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const parsedAge = Number(age);
    if (!trimmedName || !Number.isFinite(parsedAge) || parsedAge < 0 || parsedAge > 120) {
      return;
    }

    onSubmit({
      name: trimmedName,
      age: Math.round(parsedAge),
      relationship: relationship.trim() || 'Family',
      healthConditions: conditions,
      sensitivityLevel,
      activityPatterns: activities,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Add family member form"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
    >
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
        New Family Member Profile
      </h3>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <label
            htmlFor="member-name"
            className="block text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            Full Name
          </label>
          <input
            id="member-name"
            type="text"
            required
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Rohan"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        <div>
          <label
            htmlFor="member-age"
            className="block text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            Age
          </label>
          <input
            id="member-age"
            type="number"
            min={0}
            max={120}
            required
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        <div>
          <label
            htmlFor="member-relationship"
            className="block text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            Relationship
          </label>
          <select
            id="member-relationship"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="Child">Child</option>
            <option value="Parent">Parent</option>
            <option value="Spouse">Spouse / Partner</option>
            <option value="Grandparent">Grandparent</option>
            <option value="Self">Self</option>
          </select>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <fieldset className="min-w-0">
          <legend className="text-xs font-medium text-slate-700 dark:text-slate-300">
            Health Conditions
          </legend>
          <div className="mt-2 space-y-1.5">
            {ALL_CONDITIONS.map((cond) => (
              <label
                key={cond}
                className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300"
              >
                <input
                  type="checkbox"
                  checked={conditions.includes(cond)}
                  onChange={() => toggleCondition(cond)}
                  className="h-4 w-4 rounded border-slate-300 text-cyan-700"
                />
                {HEALTH_CONDITION_LABELS[cond]}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="min-w-0">
          <legend className="text-xs font-medium text-slate-700 dark:text-slate-300">
            Sensitivity Level
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['low', 'medium', 'high'] as SensitivityLevel[]).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setSensitivityLevel(level)}
                aria-pressed={sensitivityLevel === level}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  sensitivityLevel === level
                    ? 'border-cyan-700 bg-cyan-50 text-cyan-900 dark:border-cyan-500 dark:bg-cyan-950/60 dark:text-cyan-200'
                    : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="min-w-0">
          <legend className="text-xs font-medium text-slate-700 dark:text-slate-300">
            Activity Patterns
          </legend>
          <div className="mt-2 space-y-1.5">
            {ALL_ACTIVITIES.map((act) => (
              <label
                key={act}
                className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300"
              >
                <input
                  type="checkbox"
                  checked={activities.includes(act)}
                  onChange={() => toggleActivity(act)}
                  className="h-4 w-4 rounded border-slate-300 text-cyan-700"
                />
                {ACTIVITY_PATTERN_LABELS[act]}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-700 px-4 py-2 text-xs font-medium text-white hover:bg-cyan-800"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Save Member Profile
        </button>
      </div>
    </form>
  );
}
