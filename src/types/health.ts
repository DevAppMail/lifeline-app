export type TimelineEntryType =
  | "donation"
  | "appointment"
  | "follow_up"
  | "encounter"
  | "prescription"
  | "report"
  | "health_note"
  | "home_visit"
  | "lab_test";

export type EntryStatus = "scheduled" | "completed" | "cancelled" | "missed" | "pending";

export interface TimelineEntry {
  id: string;
  type: TimelineEntryType;
  date: string;
  title: string;
  subtitle?: string;
  provider?: string;
  location?: string;
  status?: EntryStatus;
  notes?: string;
  is_placeholder?: boolean;
}

// Aligned with lifeline-admin and lifeline-pro provider governance schema.
// Legacy values (home_care, specialist, other) kept for backward compat with stored localStorage data.
export type ProviderType =
  | "doctor"
  | "physiotherapist"
  | "occupational_therapist"
  | "speech_therapist"
  | "nurse"
  | "palliative_care_provider"
  | "home_visit_provider"
  | "clinic"
  | "multi_provider_clinic"
  | "home_care"      // legacy
  | "specialist"     // legacy
  | "other";         // legacy

export interface LinkedProvider {
  id: string;
  name: string;
  specialty: string;
  provider_type: ProviderType;
  clinic_name?: string;
  location?: string;
  phone?: string;
  last_visit_date?: string;
  next_follow_up_date?: string;
  user_notes?: string;
  added_at: string;
}

// Aligned with lifeline-admin and lifeline-pro follow-up status schema.
export type FollowUpStatus = "pending_approval" | "accepted" | "rejected" | "rescheduled" | "expired" | "no_show";

export type VisitType = "clinic" | "home_visit" | "telemedicine";

export type TimeWindow = "morning" | "afternoon" | "evening" | "flexible";

export type FollowUpUrgency = "routine" | "soon" | "urgent";

export interface FollowUpRequest {
  id: string;
  provider_id?: string;
  provider_name: string;
  provider_type: string;
  specialty?: string;
  recommended_date?: string;
  recommended_time_window?: TimeWindow;
  visit_type: VisitType;
  reason: string;
  urgency: FollowUpUrgency;
  notes?: string;
  status: FollowUpStatus;
  created_at: string;
  expires_at?: string;
  is_recurring: boolean;
  recurring_interval_days?: number;
  total_sessions?: number;
  current_session?: number;
  user_response_at?: string;
  rescheduled_to?: string;
}

export type CareCircleRole =
  | "spouse"
  | "parent"
  | "child"
  | "sibling"
  | "caregiver"
  | "guardian"
  | "friend"
  | "other";

export interface CareCircleMember {
  id: string;
  name: string;
  relationship: CareCircleRole;
  phone: string;
  email?: string;
  is_emergency_contact: boolean;
  can_view_records: boolean;
  can_manage_appointments: boolean;
  added_at: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
}

// Foundation for future consent management — do not overbuild yet
export interface ProviderConsent {
  provider_id: string;
  provider_name: string;
  can_view_timeline: boolean;
  can_view_prescriptions: boolean;
  can_view_reports: boolean;
  can_add_entries: boolean;
  granted_at: string;
  expires_at?: string;
}

// ── Future-ready stubs (architecture only — not yet implemented) ──────────────

// ABHA (Ayushman Bharat Health Account) — Phase 2
export interface AbhaLink {
  abha_id: string;
  verified: boolean;
  linked_at: string;
}

// Insurance — Phase 2
export interface InsuranceClaim {
  claim_id: string;
  insurer: string;
  status: "pending" | "approved" | "rejected";
  amount: number;
  submitted_at: string;
}

// Prescriptions — Phase 3 (provider-issued, not user-generated)
export interface Prescription {
  id: string;
  provider_id: string;
  provider_name: string;
  issued_at: string;
  medicines: { name: string; dosage: string; duration: string }[];
  instructions: string | null;
}

// Care Programs — Phase 3
export interface CareProgram {
  id: string;
  name: string;
  provider_id: string;
  start_date: string;
  end_date: string | null;
  sessions_total: number;
  sessions_completed: number;
  status: "active" | "completed" | "paused";
}

// Wearable data — Phase 4
export interface WearableSnapshot {
  recorded_at: string;
  heart_rate?: number;
  spo2?: number;
  steps?: number;
  source: "healthkit" | "google_fit" | "manual";
}
