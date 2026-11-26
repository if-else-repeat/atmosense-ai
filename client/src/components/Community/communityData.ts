import { BookOpen, Car, Flame, HeartHandshake, Home, Shield, type LucideIcon } from 'lucide-react';

export interface CrowdsourcedReport {
  id: string;
  neighborhood: string;
  reportedAqi: number;
  visibility: 'Clear' | 'Light Haze' | 'Dense Smog' | 'Severe Smoke';
  note: string;
  photoDataUrl?: string;
  timestamp: string;
}

export interface EmergencyBroadcast {
  id: string;
  zone: string;
  severity: 'Advisory' | 'Severe';
  message: string;
  issuedAt: string;
  acknowledged: boolean;
}

export interface CommunityBadge {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  icon: LucideIcon;
}

export const INITIAL_REPORTS: CrowdsourcedReport[] = [
  {
    id: 'rep-1',
    neighborhood: 'East Freight & Industrial Belt (Zone B)',
    reportedAqi: 174,
    visibility: 'Dense Smog',
    note: 'Heavy morning haze near the rail overpass; noticeable particulate odor.',
    timestamp: '18 min ago',
  },
  {
    id: 'rep-2',
    neighborhood: 'North Parklands (Zone A)',
    reportedAqi: 46,
    visibility: 'Clear',
    note: 'Steady north-west breeze clearing valley floor; visibility > 10 km.',
    timestamp: '42 min ago',
  },
];

export const INITIAL_BROADCASTS: EmergencyBroadcast[] = [
  {
    id: 'bc-1',
    zone: 'Zone B — East Freight & Industrial Belt',
    severity: 'Severe',
    message:
      'Geotargeted Health Alert: Morning thermal inversion trapping PM2.5 above 175 AQI. Schools advised to shift recess indoors until 11:30 AM.',
    issuedAt: 'Today, 07:30',
    acknowledged: false,
  },
];

export function buildCommunityBadges(params: {
  streakDays: number;
  completedPledges: string[];
  hasSubmittedReport: boolean;
}): CommunityBadge[] {
  const { streakDays, completedPledges, hasSubmittedReport } = params;
  return [
    {
      id: 'first-week',
      title: 'First Week Protected',
      description: 'Maintained a 7-day air quality check-in streak.',
      unlocked: streakDays >= 7,
      icon: Flame,
    },
    {
      id: 'clean-commuter',
      title: 'Clean Commuter',
      description: 'Committed to carpooling or zero-emission commutes.',
      unlocked: completedPledges.includes('pledge-carpool'),
      icon: Car,
    },
    {
      id: 'iaq-master',
      title: 'IAQ Master',
      description: 'Applied indoor filtration and clean heating practices.',
      unlocked: completedPledges.includes('pledge-clean-heating'),
      icon: Home,
    },
    {
      id: 'community-guardian',
      title: 'Community Guardian',
      description: 'Submitted a verified local air quality observation.',
      unlocked: hasSubmittedReport || completedPledges.includes('pledge-no-waste-burning'),
      icon: Shield,
    },
    {
      id: 'family-protector',
      title: 'Family Protector',
      description: 'Pledged to check on vulnerable household members or neighbors.',
      unlocked: completedPledges.includes('pledge-vulnerable-neighbor'),
      icon: HeartHandshake,
    },
    {
      id: 'knowledge-seeker',
      title: 'Knowledge Seeker',
      description: 'Reviewed neighborhood environmental justice disparity metrics.',
      unlocked: true,
      icon: BookOpen,
    },
  ];
}
