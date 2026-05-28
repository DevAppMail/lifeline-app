import type { ReminderEvent } from "@/types/reminder";

export type EscalationLevel = "none" | "gentle" | "moderate" | "urgent";

export function getEscalation(reminder: ReminderEvent): EscalationLevel {
  if (reminder.status !== "pending" && reminder.status !== "shown") return "none";

  const now = Date.now();
  const scheduled = new Date(reminder.scheduledFor).getTime();
  const expires = reminder.expiresAt ? new Date(reminder.expiresAt).getTime() : null;

  // Missed appointments and overdue follow-ups
  if (reminder.category === "appointment_missed" || reminder.category === "follow_up_overdue") {
    return "urgent";
  }

  // Overdue payments
  if (reminder.category === "payment_overdue") {
    return "moderate";
  }

  // Expiring medication
  if (reminder.category === "medication_expiring") {
    return "gentle";
  }

  // Time-based escalation (overdue)
  if (scheduled && scheduled < now) {
    const overdue = now - scheduled;
    if (overdue > 86400000) return "moderate";
    if (overdue > 3600000) return "gentle";
    return "none";
  }

  // Retry-based escalation
  if (reminder.retryCount >= 3) return "urgent";
  if (reminder.retryCount >= 1) return "moderate";

  // Expiration proximity
  if (expires) {
    const remaining = expires - now;
    if (remaining < 3600000) return "urgent";
    if (remaining < 86400000) return "moderate";
    if (remaining < 259200000) return "gentle";
  }

  return "none";
}

export const ESCALATION_STYLES: Record<EscalationLevel, { border: string; bg: string; dot: string }> = {
  none: { border: "border-border", bg: "bg-card", dot: "" },
  gentle: { border: "border-blue-200 dark:border-blue-800/30", bg: "bg-blue-50/30 dark:bg-blue-950/10", dot: "bg-blue-500" },
  moderate: { border: "border-amber-200 dark:border-amber-800/30", bg: "bg-amber-50/30 dark:bg-amber-950/10", dot: "bg-amber-500" },
  urgent: { border: "border-red-200 dark:border-red-800/30", bg: "bg-red-50/30 dark:bg-red-950/10", dot: "bg-red-500" },
};
