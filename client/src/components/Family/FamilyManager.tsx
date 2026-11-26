import { Lock, Trash2, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { AddMemberForm, type NewMemberDraft } from './AddMemberForm';
import { HealthInsights } from './HealthInsights';
import { MemberCard } from './MemberCard';
import { SymptomTracker } from './SymptomTracker';
import { useFamilyVault } from './useFamilyVault';

export interface FamilyManagerProps {
  currentAqi: number;
  locationName: string;
}

/**
 * Household respiratory health workspace managing encrypted family profiles,
 * daily symptom logs linked to live AQI, correlation insights, and GDPR erasure.
 */
export function FamilyManager({ currentAqi, locationName }: FamilyManagerProps) {
  const {
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
  } = useFamilyVault();

  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [confirmGdprDelete, setConfirmGdprDelete] = useState<boolean>(false);

  const handleAddMember = (draft: NewMemberDraft) => {
    addMember(draft);
    setShowAddForm(false);
  };

  const handleConfirmGdprErase = () => {
    gdprEraseAll();
    setConfirmGdprDelete(false);
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
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-cyan-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700"
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
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 font-medium text-rose-800 transition-colors hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-200 dark:hover:bg-rose-950"
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
                onClick={handleConfirmGdprErase}
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
                onRemove={removeMember}
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
              onAddLog={addSymptomLog}
              onDeleteLog={deleteSymptomLog}
            />
          </div>
          <div className="min-w-0 lg:col-span-5">
            <HealthInsights
              member={activeMember}
              logs={symptomLogs}
              aiConsent={aiConsent}
              onToggleAiConsent={toggleAiConsent}
            />
          </div>
        </div>
      )}
    </div>
  );
}
