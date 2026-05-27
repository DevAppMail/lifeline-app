// ── LifeLine Blood Fulfillment System — Core Types ───────────────────
// Sprint 1 — foundational operational types
// Sprint 2 — persistence, orchestration, escalation, audit, verification

// ── Tier ───────────────────────────────────────────────────────────────

export type RequestTier = "scheduled" | "urgent" | "emergency";

export const TIER_META: Record<RequestTier, { label: string; time: string; fee: number; feeLabel: string; desc: string }> = {
  scheduled:  { label: "Scheduled",  time: "3–7 days",       fee: 99,   feeLabel: "Service fee",      desc: "Best for planned procedures." },
  urgent:     { label: "Urgent",     time: "48–72 hours",    fee: 299,  feeLabel: "Deposit held",     desc: "For time-sensitive needs." },
  emergency:  { label: "Emergency",  time: "2–4 hours",      fee: 499,  feeLabel: "Priority deposit", desc: "Critical — broadcast to all." },
};

// ── Blood Groups ──────────────────────────────────────────────────────

export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
export const BLOOD_GROUPS: BloodGroup[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

/** Returns true if donorBlood can donate to patientBlood */
export function isBloodCompatible(donorBlood: BloodGroup, patientBlood: BloodGroup): boolean {
  if (donorBlood === patientBlood) return true;
  const map: Record<BloodGroup, BloodGroup[]> = {
    "O-":  ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
    "O+":  ["A+", "B+", "AB+", "O+"],
    "A-":  ["A+", "A-", "AB+", "AB-"],
    "A+":  ["A+", "AB+"],
    "B-":  ["B+", "B-", "AB+", "AB-"],
    "B+":  ["B+", "AB+"],
    "AB-": ["AB+", "AB-"],
    "AB+": ["AB+"],
  };
  return map[donorBlood]?.includes(patientBlood) ?? false;
}

export function isRareBlood(bg: BloodGroup): boolean {
  return ["A-", "B-", "AB+", "AB-", "O-"].includes(bg);
}

// ── Request Lifecycle State Machine ──────────────────────────────────

/** Sprint 1 MVP states */
export type RequestLifecycleStatus =
  | "draft"
  | "active"
  | "searching"
  | "partially_fulfilled"
  | "fulfilled"
  | "cancelled"
  | "expired"
  | "failed";

export const REQUEST_LIFECYCLE_TRANSITIONS: Record<RequestLifecycleStatus, RequestLifecycleStatus[]> = {
  draft:               ["active", "cancelled"],
  active:              ["searching", "cancelled", "expired"],
  searching:           ["partially_fulfilled", "fulfilled", "cancelled", "expired", "failed"],
  partially_fulfilled: ["fulfilled", "searching", "cancelled", "expired", "failed"],
  fulfilled:           [],
  cancelled:           [],
  expired:             ["failed"],
  failed:              [],
};

export function canTransition(from: RequestLifecycleStatus, to: RequestLifecycleStatus): boolean {
  return REQUEST_LIFECYCLE_TRANSITIONS[from]?.includes(to) ?? false;
}

export const REQUEST_STATUS_LABELS: Record<RequestLifecycleStatus, string> = {
  draft:               "Draft",
  active:              "Looking for Donors",
  searching:           "Contacting Donors",
  partially_fulfilled: "Partially Fulfilled",
  fulfilled:           "Fulfilled",
  cancelled:           "Cancelled",
  expired:             "Expired",
  failed:              "Unfulfilled",
};

export const REQUEST_STATUS_META: Record<RequestLifecycleStatus, { color: string; badge: string }> = {
  draft:               { color: "text-muted-foreground",          badge: "bg-muted text-muted-foreground" },
  active:              { color: "text-blue-600",                  badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  searching:           { color: "text-amber-600",                 badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  partially_fulfilled: { color: "text-emerald-600",               badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  fulfilled:           { color: "text-emerald-700",                badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  cancelled:           { color: "text-gray-500",                  badge: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  expired:             { color: "text-amber-600",                  badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  failed:              { color: "text-red-600",                   badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};

// ── Donor Availability ──────────────────────────────────────────────

export type DonorAvailabilityMode = "always" | "scheduled" | "emergency_only" | "unavailable";

export interface TimeRange {
  start: string; // "09:00" (24h)
  end: string;   // "17:00" (24h)
}

export interface WeeklySchedule {
  monday: TimeRange[];
  tuesday: TimeRange[];
  wednesday: TimeRange[];
  thursday: TimeRange[];
  friday: TimeRange[];
  saturday: TimeRange[];
  sunday: TimeRange[];
}

export function defaultWeeklySchedule(): WeeklySchedule {
  const d: TimeRange[] = [{ start: "09:00", end: "17:00" }];
  return { monday: d, tuesday: d, wednesday: d, thursday: d, friday: d, saturday: [], sunday: [] };
}

export interface DonorAvailability {
  active: boolean;
  mode: DonorAvailabilityMode;
  weekly_schedule: WeeklySchedule;
  days_of_week?: number[];
  time_windows?: TimeRange[];
  temporarily_unavailable: boolean;
  unavailable_until?: string;
  unavailable_reason?: string;
  max_travel_radius_km: number;
  preferred_time_of_day: "morning" | "afternoon" | "evening" | "night" | "flexible";
  updated_at: string;
}

// ── Donor Operational State ─────────────────────────────────────────

export type DonorOperationalState =
  | "available"
  | "unavailable"
  | "cooldown"
  | "temporarily_unavailable";

export const DONOR_STATE_TRANSITIONS: Record<DonorOperationalState, DonorOperationalState[]> = {
  available:                ["unavailable", "cooldown", "temporarily_unavailable"],
  unavailable:              ["available", "temporarily_unavailable"],
  cooldown:                 ["available", "unavailable"],
  temporarily_unavailable:  ["available", "unavailable"],
};

export function canTransitionDonorState(from: DonorOperationalState, to: DonorOperationalState): boolean {
  return DONOR_STATE_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface DonorOperationalData {
  state: DonorOperationalState;
  last_donation_date?: string;
  cooldown_expiry?: string;
  availability_mode: DonorAvailabilityMode;
  last_response_at?: string;
  consecutive_ghosts: number;
  total_commitments: number;
  successful_donations: number;
  reliability_tier: "high" | "moderate" | "low" | "unproven";
}

// ── Donor Response Lifecycle ────────────────────────────────────────

export type DonorResponseState =
  | "notified"
  | "accepted"
  | "declined"
  | "pending"
  | "committed"
  | "checked_in"
  | "donated"
  | "confirmed"
  | "no_show"
  | "cancelled";

export const DONOR_RESPONSE_TRANSITIONS: Record<DonorResponseState, DonorResponseState[]> = {
  notified:  ["accepted", "declined", "pending"],
  accepted:  ["committed", "declined", "pending"],
  declined:  [],
  pending:   ["committed", "declined", "cancelled"],
  committed: ["checked_in", "no_show", "cancelled"],
  checked_in: ["donated", "no_show", "cancelled"],
  donated:   ["confirmed", "no_show"],
  confirmed: [],
  no_show:   [],
  cancelled: [],
};

export interface DonorResponse {
  request_id: string;
  donor_id: string;
  state: DonorResponseState;
  notified_at?: string;
  responded_at?: string;
  committed_at?: string;
  checked_in_at?: string;
  donated_at?: string;
  confirmed_at?: string;
  cancelled_at?: string;
  cancelled_reason?: string;
  response_time_seconds?: number;
}

// ── Matching Engine ─────────────────────────────────────────────────

export interface MatchResult {
  donor_id: string;
  donor_name: string;
  blood_group: BloodGroup;
  distance_km: number;
  availability_confidence: number;
  match_rank: number;
  time_compatible: boolean;
}

export interface MatchingConfig {
  radius_km: number;
  max_results: number;
  include_time_incompatible: boolean;
  require_availability: boolean;
  tier: RequestTier;
}

// ── Full Blood Request ──────────────────────────────────────────────

export interface BloodRequestCreate {
  patient_name: string;
  patient_age?: number;
  relationship: string;
  blood_group: BloodGroup | "";
  units_needed: number;
  hospital_name: string;
  hospital_city: string;
  required_date: string;
  required_time?: string;
  tier: RequestTier;
  fresh_blood_required?: boolean;
  notes?: string;
  doctor_note_uploaded: boolean;
  selfie_captured: boolean;
  consent_timestamp: string;
}

export interface BloodRequestFull {
  id: string;
  lifeline_id: string;
  
  // Patient
  patient_name: string;
  patient_age?: number;
  relationship: string;
  blood_group: BloodGroup;
  blood_group_unknown?: boolean;
  units_needed: number;
  units_fulfilled: number;
  fresh_blood_required: boolean;
  rare_blood_flag: boolean;
  
  // Hospital
  hospital_name: string;
  hospital_city: string;
  hospital_lat?: number;
  hospital_lng?: number;
  
  // Timing
  tier: RequestTier;
  required_date: string;
  required_time?: string;
  fulfillment_deadline?: string;
  
  // Lifecycle
  status: RequestLifecycleStatus;
  current_radius_km: number;
  current_wave: number;
  
  // Verification
  doctor_note_uploaded: boolean;
  selfie_captured: boolean;
  consent_timestamp: string;
  
  // Requester
  requester_phone: string;
  requester_name?: string;
  
  // Donor tracking
  donors_contacted: number;
  donors_committed: number;
  donor_responses: DonorResponse[];
  
  // Metadata
  created_at: string;
  updated_at: string;
  fulfilled_at?: string;
  cancelled_at?: string;
  cancelled_reason?: string;
  
  // Audit
  status_history: StatusHistoryEntry[];
}

export interface StatusHistoryEntry {
  from: RequestLifecycleStatus;
  to: RequestLifecycleStatus;
  timestamp: string;
  triggered_by?: string;
  notes?: string;
}

// ── Sprint 2: Request Verification ──────────────────────────────────

export type VerificationStatus = "unverified" | "pending_review" | "verified" | "flagged";

export interface VerificationRecord {
  status: VerificationStatus;
  doctor_note_url?: string;
  selfie_url?: string;
  consent_timestamp: string;
  reviewed_by?: string;
  reviewed_at?: string;
  flag_reason?: string;
  notes?: string;
}

// ── Sprint 2: Escalation ────────────────────────────────────────────

export type EscalationStage = "wave_1" | "wave_2" | "wave_3" | "fallback";

export interface EscalationEvent {
  stage: EscalationStage;
  wave_number: number;
  radius_km: number;
  triggered_at: string;
  triggered_by: "system" | "requester" | "admin";
  donor_count_contacted: number;
  notes?: string;
}

export const ESCALATION_STAGE_LABELS: Record<EscalationStage, string> = {
  wave_1: "Wave 1 — Initial Search",
  wave_2: "Wave 2 — Expanded Radius",
  wave_3: "Wave 3 — City-Wide",
  fallback: "Fallback — Admin Escalation",
};

export const ESCALATION_RADIUS_PRESETS: Record<EscalationStage, number> = {
  wave_1: 5,
  wave_2: 10,
  wave_3: 25,
  fallback: 50,
};

export interface EscalationState {
  current_stage: EscalationStage;
  events: EscalationEvent[];
  started_at: string;
  last_escalated_at?: string;
  cancelled_at?: string;
  is_active: boolean;
}

// ── Sprint 2: Urban/Rural Radius Presets ────────────────────────────

export type RegionType = "urban" | "semi_urban" | "rural";

export const REGION_RADIUS_DEFAULTS: Record<RegionType, Record<EscalationStage, number>> = {
  urban:     { wave_1: 5,  wave_2: 10, wave_3: 20, fallback: 40 },
  semi_urban: { wave_1: 10, wave_2: 20, wave_3: 35, fallback: 50 },
  rural:     { wave_1: 15, wave_2: 30, wave_3: 50, fallback: 80 },
};

// ── Sprint 2: Multi-Donor Assignment ────────────────────────────────

export interface DonorAssignment {
  request_id: string;
  donor_id: string;
  donor_phone: string;
  donor_name?: string;
  blood_group: BloodGroup;
  units_committed: number;
  state: DonorResponseState;
  stage_at_assignment: EscalationStage;
  donor_state_at_assignment: DonorOperationalState;
  notified_at?: string;
  responded_at?: string;
  committed_at?: string;
  checked_in_at?: string;
  donated_at?: string;
  confirmed_at?: string;
  response_latency_seconds?: number;
  replaced_by?: string;
  replacement_for?: string;
  is_replacement: boolean;
  notes?: string;
}

export interface MultiDonorState {
  units_needed: number;
  units_fulfilled: number;
  assignments: DonorAssignment[];
  replacement_queue: string[];
  over_fulfillment_prevented: boolean;
  fulfilled_at?: string;
}

// ── Sprint 2: Notification Event Model ──────────────────────────────

export type NotificationEventType =
  | "donor_matched"
  | "donor_committed"
  | "donor_confirmed"
  | "donor_no_show"
  | "request_fulfilled"
  | "request_cancelled"
  | "escalation_triggered"
  | "replacement_needed"
  | "deadline_approaching"
  | "follow_up_reminder";

export type NotificationChannel = "in_app" | "sms" | "whatsapp" | "email";
export type NotificationDeliveryStatus = "queued" | "sent" | "delivered" | "failed" | "suppressed";

export interface NotificationEvent {
  id: string;
  event_type: NotificationEventType;
  request_id: string;
  donor_id?: string;
  requester_phone?: string;
  channel: NotificationChannel;
  priority: "low" | "normal" | "high" | "critical";
  body: string;
  status: NotificationDeliveryStatus;
  queued_at: string;
  sent_at?: string;
  delivered_at?: string;
  failed_at?: string;
  failure_reason?: string;
  suppressed_reason?: string;
  retry_count: number;
  max_retries: number;
}

// ── Sprint 2: Audit Log ─────────────────────────────────────────────

export type AuditAction =
  | "request.created"
  | "request.status_changed"
  | "request.cancelled"
  | "request.verified"
  | "request.flagged"
  | "donor.notified"
  | "donor.responded"
  | "donor.committed"
  | "donor.confirmed"
  | "donor.no_show"
  | "donor.cancelled"
  | "donor.replaced"
  | "donor.duplicate_prevented"
  | "escalation.triggered"
  | "escalation.cancelled"
  | "radius.expanded"
  | "sync.pushed"
  | "sync.failed"
  | "system.expired"
  | "system.error";

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: AuditAction;
  actor_type: "system" | "requester" | "donor" | "admin";
  actor_id?: string;
  request_id?: string;
  donor_id?: string;
  previous_state?: string;
  new_state?: string;
  details?: string;
  severity: "info" | "warning" | "error" | "critical";
  
  // Escalation context
  escalation_stage?: EscalationStage;
  wave_number?: number;
  radius_km?: number;
  
  // Actor context
  ip_address?: string;
  user_agent?: string;
  
  // Idempotency
  correlation_id?: string;
}
