export type ContributionType =
  | "emergency_fulfillment"
  | "independent_donation"
  | "camp_donation"
  | "medical_deferral"
  | "commitment_accepted";

export type TimelineContributionType =
  | "donation_recorded"
  | "community_donation_recorded";

export interface ContributionRecord {
  id: string;
  type: ContributionType;
  lifelineId: string;

  // Source
  requestId?: string;
  donorName: string;

  // Timing
  donationDate: string;
  recordedAt: string;

  // Location
  location?: string;
  organizer?: string;

  // Uploads
  donationCardUrl?: string;
  donationPhotoUrl?: string;

  // Appreciation
  appreciationGeneratedAt?: string;

  // Points (future use)
  weight?: number;

  // Metadata
  notes?: string;
}

export interface ContributionMemory {
  contributions: ContributionRecord[];
  totalCount: number;
  lastDonationDate: string | null;
  consecutiveMonths: number;
}

export interface VoluntaryDonationForm {
  donationDate: string;
  location: string;
  organizer: string;
  donationCard: File | null;
  donationPhoto: File | null;
}

export interface AppreciationCardData {
  donorName: string;
  donationDate: string;
  type: "fulfillment" | "independent";
  cardId: string;
  generatedAt: string;
}

export const CONTRIBUTION_TYPE_META: Record<ContributionType, {
  timelineType: TimelineContributionType;
  title: string;
  subtitle: string;
}> = {
  emergency_fulfillment: {
    timelineType: "donation_recorded",
    title: "Blood donation completed",
    subtitle: "Emergency fulfillment donation",
  },
  independent_donation: {
    timelineType: "community_donation_recorded",
    title: "Blood donation recorded",
    subtitle: "Community donation contribution remembered",
  },
  camp_donation: {
    timelineType: "community_donation_recorded",
    title: "Blood donation recorded",
    subtitle: "Community donation contribution remembered",
  },
  medical_deferral: {
    timelineType: "donation_recorded",
    title: "Donor showed up",
    subtitle: "Arrived but medically deferred",
  },
  commitment_accepted: {
    timelineType: "donation_recorded",
    title: "Commitment accepted",
    subtitle: "Donor committed to help",
  },
};
