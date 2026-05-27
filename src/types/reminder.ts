export type ReminderCategory =
  | "appointment_reminder"
  | "appointment_today"
  | "appointment_missed"
  | "follow_up_reminder"
  | "follow_up_due"
  | "follow_up_overdue"
  | "medication_reminder"
  | "medication_expiring"
  | "payment_reminder"
  | "payment_overdue"
  | "consultation_summary"
  | "missed_care";

export type ReminderPriority = "high" | "medium" | "low";

export type ReminderStatus = "pending" | "shown" | "read" | "dismissed" | "snoozed" | "completed";

export type ReminderEntityType = "appointment" | "consultation" | "prescription" | "follow_up" | "billing";

export interface ReminderEvent {
  id: string;
  category: ReminderCategory;
  priority: ReminderPriority;
  title: string;
  description: string;
  createdAt: string;
  scheduledFor: string;
  expiresAt: string | null;
  status: ReminderStatus;
  entityType: ReminderEntityType;
  entityId: string;
  correlationGroup: string | null;
  doctorId?: number | null;
  appointmentId: string | null;
  consultationId: string | null;
  prescriptionId: string | null;
  followUpId: string | null;
  billingId: string | null;
  snoozedUntil: string | null;
  retryCount: number;
  maxRetries: number;
}

export interface ReminderStoreData {
  reminders: ReminderEvent[];
  lastComputed: string;
  version: number;
}

export type ReminderAction =
  | { type: "mark_read"; id: string }
  | { type: "dismiss"; id: string }
  | { type: "snooze"; id: string; until: string }
  | { type: "rebook"; id: string }
  | { type: "mark_all_read" };
