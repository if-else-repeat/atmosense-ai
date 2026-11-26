import { useEffect, useRef, useState } from 'react';
import { AVATAR_PALETTE, type FamilyMember, type SymptomLogEntry } from '../../types/family';
import {
  eraseLocalEncryptedVault,
  loadLocalEncryptedVault,
  saveLocalEncryptedVault,
} from '../../utils/healthCrypto';
import type { NewMemberDraft } from './AddMemberForm';

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
 * Manages the AES-256-GCM encrypted browser vault for household profiles,
 * symptom logs, AI analysis consent, and GDPR Article 17 erasure.
 */
export function useFamilyVault() {
  const [members, setMembers] = useState<FamilyMember[]>(DEFAULT_MEMBERS);
  const [activeMemberId, setActiveMemberId] = useState<string>(DEFAULT_MEMBERS[0]!.id);
  const [symptomLogs, setSymptomLogs] = useState<SymptomLogEntry[]>(DEFAULT_SYMPTOM_LOGS);
  const [aiConsent, setAiConsent] = useState<boolean>(false);
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

  const addMember = (draft: NewMemberDraft) => {
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
  };

  const removeMember = (memberId: string) => {
    const nextMembers = members.filter((m) => m.id !== memberId);
    const nextLogs = symptomLogs.filter((l) => l.memberId !== memberId);
    setMembers(nextMembers);
    setSymptomLogs(nextLogs);
    if (activeMemberId === memberId) setActiveMemberId(nextMembers[0]?.id ?? '');
    persistLocal(nextMembers, nextLogs, aiConsent);
  };

  const addSymptomLog = (entry: Omit<SymptomLogEntry, 'id'>) => {
    const created: SymptomLogEntry = { ...entry, id: `symptom-${Date.now().toString(36)}` };
    const nextLogs = [created, ...symptomLogs];
    setSymptomLogs(nextLogs);
    persistLocal(members, nextLogs, aiConsent);
  };

  const deleteSymptomLog = (logId: string) => {
    const nextLogs = symptomLogs.filter((entry) => entry.id !== logId);
    setSymptomLogs(nextLogs);
    persistLocal(members, nextLogs, aiConsent);
  };

  const toggleAiConsent = (consented: boolean) => {
    setAiConsent(consented);
    persistLocal(members, symptomLogs, consented);
  };

  const gdprEraseAll = () => {
    hasUserMutatedRef.current = true;
    setMembers([]);
    setSymptomLogs([]);
    setActiveMemberId('');
    setAiConsent(false);
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

  return {
    members,
    activeMember,
    setActiveMemberId,
    symptomLogs,
    aiConsent,
    privacyNotice,
    addMember,
    removeMember,
    addSymptomLog,
    deleteSymptomLog,
    toggleAiConsent,
    gdprEraseAll,
  };
}
