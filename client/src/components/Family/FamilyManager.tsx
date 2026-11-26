import { Lock, Trash2, UserPlus, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AVATAR_PALETTE, type FamilyMember, type SymptomLogEntry } from '../../types/family';
import {
  eraseLocalEncryptedVault,
  loadLocalEncryptedVault,
  saveLocalEncryptedVault,
} from '../../utils/healthCrypto';
import { AddMemberForm, type NewMemberDraft } from './AddMemberForm';
import { HealthInsights } from './HealthInsights';
import { MemberCard } from './MemberCard';
import { SymptomTracker } from './SymptomTracker';

export interface FamilyManagerProps {
  currentAqi: number;
  locationName: string;
}

const LOCAL_STORAGE_KEY = 'atmosense-family-health-v1';

const DEFAULT_MEMBERS: FamilyMember[] = [
  {
    id: 'member-child-maya',
    name: 'Maya Patel',
    age: 9,
    relationship: 'Child',
    healthConditions: ['asthma', 'allergies'],
    sensitivityLevel: 'high',
    activityPatterns: ['school', 'outdoor_sports'],
    avatarColor: AVATAR_PALETTE[0],
    createdAt: Date.now() - 86_400_000 * 14,
  },
  {
    id: 'member-elder-arjun',
    name: 'Arjun Patel',
    age: 71,
    relationship: 'Parent',
    healthConditions: ['heart_disease'],
    sensitivityLevel: 'high',
    activityPatterns: ['work'],
    avatarColor: AVATAR_PALETTE[2],
    createdAt: Date.now() - 86_400_000 * 10,
  },
];

const DEFAULT_SYMPTOM_LOGS: SymptomLogEntry[] = [
  {
    id: 'log-seed-1',
    memberId: 'member-child-maya',
    timestamp: new Date().setHours(8, 15, 0, 0) - 86_400_000,
    aqiAtLog: 138,
    locationName: 'New Delhi, India',
    coughing: 'moderate',
    wheezing: 'mild',
    eyeIrritation: 'mild',
    shortnessOfBreath: 'none',
    headache: 'none',
    notes: 'School bus stop morning haze; used controller inhaler.',
  },
  {
    id: 'log-seed-2',
    memberId: 'member-child-maya',
    timestamp: new Date().setHours(7, 45, 0, 0) - 86_400_000 * 2,
    aqiAtLog: 156,
    locationName: 'New Delhi, India',
    coughing: 'moderate',
    wheezing: 'moderate',
    eyeIrritation: 'none',
    shortnessOfBreath: 'mild',
    headache: 'none',
    notes: 'Morning inversion peak before 9 AM.',
  },
];

/**
 * Household respiratory health workspace managing encrypted family profiles,
 * daily symptom logs linked to live AQI, correlation insights, and GDPR erasure.
 */
export function FamilyManager({ currentAqi, locationName }: FamilyManagerProps) {
  const [members, setMembers] = useState<FamilyMember[]>(DEFAULT_MEMBERS);
  const [activeMemberId, setActiveMemberId] = useState<string>(DEFAULT_MEMBERS[0]!.id);
  const [symptomLogs, setSymptomLogs] = useState<SymptomLogEntry[]>(DEFAULT_SYMPTOM_LOGS);
  const [aiConsent, setAiConsent] = useState<boolean>(false);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [confirmGdprDelete, setConfirmGdprDelete] = useState<boolean>(false);
  const [privacyNotice, setPrivacyNotice] = useState<string | null>(null);
  const hasUserMutatedRef = useRef<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const vault = await loadLocalEncryptedVault();
      if (cancelled || hasUserMutatedRef.current) return;

      if (vault) {
        if (Array.isArray(vault.members)) {
          setMembers(vault.members);
          setActiveMemberId((prev) =>
            vault.members.some((m) => m.id === prev) ? prev : (vault.members[0]?.id ?? ''),
          );
        }
        if (Array.isArray(vault.symptomLogs)) setSymptomLogs(vault.symptomLogs);
        if (typeof vault.aiConsent === 'boolean') setAiConsent(vault.aiConsent);
        return;
      }

      try {
        const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
        if (raw && !cancelled && !hasUserMutatedRef.current) {
          const parsed = JSON.parse(raw) as {
            members?: FamilyMember[];
            symptomLogs?: SymptomLogEntry[];
            aiConsent?: boolean;
          };
          if (Array.isArray(parsed.members)) {
            const parsedMembers = parsed.members;
            setMembers(parsedMembers);
            setActiveMemberId((prev) =>
              parsedMembers.some((m) => m.id === prev) ? prev : (parsedMembers[0]?.id ?? ''),
            );
          }
          if (Array.isArray(parsed.symptomLogs)) setSymptomLogs(parsed.symptomLogs);
          if (typeof parsed.aiConsent === 'boolean') setAiConsent(parsed.aiConsent);
        }
      } catch {
        // Ignore storage read errors
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistLocal = (
    nextMembers: FamilyMember[],
    nextLogs: SymptomLogEntry[],
    nextConsent: boolean,
  ) => {
    hasUserMutatedRef.current = true;
    try {
      window.localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify({ members: nextMembers, symptomLogs: nextLogs, aiConsent: nextConsent }),
      );
    } catch {
      // Ignore storage write errors
    }
    void saveLocalEncryptedVault({
      members: nextMembers,
      symptomLogs: nextLogs,
      aiConsent: nextConsent,
    });
  };

  const activeMember = members.find((m) => m.id === activeMemberId) ?? members[0] ?? null;

  const handleAddMember = (draft: NewMemberDraft) => {
    const newMember: FamilyMember = {
      id: `member-${Date.now().toString(36)}`,
      ...draft,
      avatarColor: AVATAR_PALETTE[members.length % AVATAR_PALETTE.length]!,
      createdAt: Date.now(),
    };
    const nextMembers = [...members, newMember];
    setMembers(nextMembers);
    setActiveMemberId(newMember.id);
    persistLocal(nextMembers, symptomLogs, aiConsent);
    setShowAddForm(false);
  };

  const handleRemoveMember = (memberId: string) => {
    const nextMembers = members.filter((m) => m.id !== memberId);
    const nextLogs = symptomLogs.filter((l) => l.memberId !== memberId);
    setMembers(nextMembers);
    setSymptomLogs(nextLogs);
    if (activeMemberId === memberId) setActiveMemberId(nextMembers[0]?.id ?? '');
    persistLocal(nextMembers, nextLogs, aiConsent);
  };

  const handleAddSymptomLog = (entry: Omit<SymptomLogEntry, 'id'>) => {
    const created: SymptomLogEntry = { ...entry, id: `symptom-${Date.now().toString(36)}` };
    const nextLogs = [created, ...symptomLogs];
    setSymptomLogs(nextLogs);
    persistLocal(members, nextLogs, aiConsent);
  };

  const handleDeleteSymptomLog = (logId: string) => {
    const nextLogs = symptomLogs.filter((entry) => entry.id !== logId);
    setSymptomLogs(nextLogs);
    persistLocal(members, nextLogs, aiConsent);
  };

  const handleToggleAiConsent = (consented: boolean) => {
    setAiConsent(consented);
    persistLocal(members, symptomLogs, consented);
  };

  const handleGdprEraseAll = async () => {
    hasUserMutatedRef.current = true;
    setMembers([]);
    setSymptomLogs([]);
    setActiveMemberId('');
    setAiConsent(false);
    setConfirmGdprDelete(false);
    try {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch {
      // Ignore storage error
    }
    eraseLocalEncryptedVault();
    setPrivacyNotice(
      'All family health profiles, symptom logs, and encryption keys have been permanently erased from this browser (GDPR Article 17).',
    );
  };

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            <Users className="h-6 w-6 text-cyan-700 dark:text-cyan-400" aria-hidden="true" />
            Family Health Protection
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Manage household respiratory profiles, log daily symptoms against live AQI, and export
            clinician reports.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm((prev) => !prev)}
          aria-expanded={showAddForm}
          className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700 whitespace-nowrap shrink-0"
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          {showAddForm ? 'Cancel' : 'Add Family Member'}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-3 text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5 font-medium text-emerald-800 dark:text-emerald-300">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            AES-256-GCM Encrypted Local Browser Storage
          </span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
            ·
          </span>
          <span>Zero health data leaves this browser without consent</span>
        </div>

        <div className="flex items-center gap-2">
          {!confirmGdprDelete ? (
            <button
              type="button"
              onClick={() => setConfirmGdprDelete(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 font-medium text-rose-800 transition-colors hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-200 dark:hover:bg-rose-950 whitespace-nowrap shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Delete All Health Data (GDPR)
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2" role="alert">
              <span className="font-medium text-rose-800 dark:text-rose-300">
                Permanently erase all health records?
              </span>
              <button
                type="button"
                onClick={() => void handleGdprEraseAll()}
                className="rounded-md bg-rose-700 px-2.5 py-1 font-medium text-white hover:bg-rose-800"
              >
                Confirm Erase
              </button>
              <button
                type="button"
                onClick={() => setConfirmGdprDelete(false)}
                className="rounded-md border border-slate-300 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {privacyNotice && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          {privacyNotice}
        </div>
      )}

      {showAddForm && (
        <AddMemberForm onSubmit={handleAddMember} onCancel={() => setShowAddForm(false)} />
      )}

      <section aria-label="Family member profiles">
        {members.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
            <Users className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
            <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">
              No family profiles yet
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Add a household member to track daily symptoms, sensitivity alerts, and
              clinician-ready PDF summaries.
            </p>
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-800"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Add First Member
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                isSelected={activeMember?.id === member.id}
                currentAqi={currentAqi}
                onSelect={setActiveMemberId}
                onRemove={handleRemoveMember}
              />
            ))}
          </div>
        )}
      </section>

      {activeMember && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-7">
            <SymptomTracker
              member={activeMember}
              currentAqi={currentAqi}
              locationName={locationName}
              logs={symptomLogs}
              onAddLog={handleAddSymptomLog}
              onDeleteLog={handleDeleteSymptomLog}
            />
          </div>
          <div className="min-w-0 lg:col-span-5">
            <HealthInsights
              member={activeMember}
              logs={symptomLogs}
              aiConsent={aiConsent}
              onToggleAiConsent={handleToggleAiConsent}
            />
          </div>
        </div>
      )}
    </div>
  );
}
