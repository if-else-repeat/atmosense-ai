import { useState } from 'react';
import {
  INITIAL_BROADCASTS,
  INITIAL_REPORTS,
  buildCommunityBadges,
  type CrowdsourcedReport,
  type EmergencyBroadcast,
} from './communityData';
import { CommunityChallengeRow, CommunityHeader } from './CommunityHeader';
import { CrowdsourcedReportsPanel } from './CrowdsourcedReportsPanel';
import { EmergencyBroadcastBanner } from './EmergencyBroadcastBanner';
import { EnvironmentalJustice } from './EnvironmentalJustice';
import { Leaderboard } from './Leaderboard';
import { COMMUNITY_PLEDGES, PledgeSystem } from './PledgeSystem';

export interface CommunityHubProps {
  currentAqi: number;
  locationName: string;
}

export function CommunityHub({ currentAqi, locationName }: CommunityHubProps) {
  const [streakDays, setStreakDays] = useState<number>(7);
  const [checkedInToday, setCheckedInToday] = useState<boolean>(false);
  const [completedPledges, setCompletedPledges] = useState<string[]>([
    'pledge-carpool',
    'pledge-no-waste-burning',
  ]);
  const [joinedCarpoolChallenge, setJoinedCarpoolChallenge] = useState<boolean>(true);
  const [leaderboardOptIn, setLeaderboardOptIn] = useState<boolean>(false);
  const [reports, setReports] = useState<CrowdsourcedReport[]>(INITIAL_REPORTS);
  const [broadcasts, setBroadcasts] = useState<EmergencyBroadcast[]>(INITIAL_BROADCASTS);

  const userPledgeCo2 = COMMUNITY_PLEDGES.filter((p) => completedPledges.includes(p.id)).reduce(
    (sum, p) => sum + p.co2Kg,
    0,
  );
  // Baseline community avoided CO2 = 194 kg + user's active pledges (default 40 kg => 234 kg CO2)
  const communityTotalCo2Kg = 194 + userPledgeCo2;

  const userPoints =
    260 +
    streakDays * 20 +
    COMMUNITY_PLEDGES.filter((p) => completedPledges.includes(p.id)).reduce(
      (sum, p) => sum + p.points,
      0,
    ) +
    (joinedCarpoolChallenge ? 150 : 0);

  const badges = buildCommunityBadges({
    streakDays,
    completedPledges,
    hasSubmittedReport: reports.length > INITIAL_REPORTS.length,
  });

  const handleDailyCheckIn = () => {
    if (checkedInToday) return;
    setCheckedInToday(true);
    setStreakDays((prev) => prev + 1);
  };

  const handleTogglePledge = (pledgeId: string) => {
    setCompletedPledges((prev) =>
      prev.includes(pledgeId) ? prev.filter((id) => id !== pledgeId) : [...prev, pledgeId],
    );
  };

  const handleAddReport = (report: CrowdsourcedReport) => {
    setReports((prev) => [report, ...prev]);
  };

  const handleAcknowledgeBroadcast = (broadcastId: string) => {
    setBroadcasts((prev) =>
      prev.map((item) => (item.id === broadcastId ? { ...item, acknowledged: true } : item)),
    );
  };

  const progressPct = Math.min(100, Math.round((communityTotalCo2Kg / 300) * 100));

  return (
    <div className="space-y-6 motion-reduce:transition-none">
      <CommunityHeader
        streakDays={streakDays}
        checkedInToday={checkedInToday}
        onDailyCheckIn={handleDailyCheckIn}
      />

      <EmergencyBroadcastBanner
        broadcasts={broadcasts}
        onAcknowledge={handleAcknowledgeBroadcast}
      />

      <CommunityChallengeRow
        communityTotalCo2Kg={communityTotalCo2Kg}
        progressPct={progressPct}
        joinedCarpoolChallenge={joinedCarpoolChallenge}
        onToggleCarpoolChallenge={() => setJoinedCarpoolChallenge((prev) => !prev)}
        badges={badges}
        userPoints={userPoints}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7">
          <PledgeSystem
            completedIds={completedPledges}
            onTogglePledge={handleTogglePledge}
            communityTotalCo2Kg={communityTotalCo2Kg}
          />
        </div>

        <CrowdsourcedReportsPanel
          reports={reports}
          defaultZone={locationName}
          defaultAqi={currentAqi}
          onAddReport={handleAddReport}
        />
      </div>

      <EnvironmentalJustice />

      <Leaderboard
        optedIn={leaderboardOptIn}
        onToggleOptIn={setLeaderboardOptIn}
        userPoints={userPoints}
        userStreakDays={streakDays}
        userCo2Kg={userPledgeCo2}
      />
    </div>
  );
}
