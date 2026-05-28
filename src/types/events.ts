export type RsvpStatus = "attending" | "interested" | "cancelled" | "attended" | "missed";

export interface CommunityEvent {
  id: string;
  title: string;
  description?: string;
  event_type: string;
  date: string;
  location: string;
  registration_count: number;
  rsvp_counts?: {
    attending: number;
    interested: number;
    cancelled: number;
    attended: number;
    missed: number;
  };
  participant_count?: number;
}

export interface EventParticipation {
  id: string;
  eventId: string;
  userId: number | null;
  name: string;
  bloodGroup: string | null;
  registeredAt: string;
  rsvpStatus: RsvpStatus;
  cancelledAt: string | null;
  checkedInAt: string | null;
}

export interface RsvpAction {
  eventId: string;
  status: RsvpStatus;
}

export const RSVP_TRANSITIONS: Record<RsvpStatus, RsvpStatus[]> = {
  interested: ["attending", "cancelled"],
  attending: ["cancelled"],
  cancelled: ["attending"],
  attended: [],
  missed: [],
};

export const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  blood_drive:  { label: "Blood Drive",  color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  health_camp:  { label: "Health Camp",  color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  ngo_campaign: { label: "NGO Campaign", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
};

export const RSVP_LABELS: Record<RsvpStatus, string> = {
  attending: "Attending",
  interested: "Interested",
  cancelled: "Cancelled",
  attended: "Attended",
  missed: "Missed",
};
