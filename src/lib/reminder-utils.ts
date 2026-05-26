import type {
  ReminderEvent,
  ReminderCategory,
  ReminderPriority,
  ReminderEntityType,
} from "@/types/reminder";
import type { PatientContinuity } from "@/types/continuity";
import { getReminderStore, addReminders, saveReminderStore } from "./reminder-store";

let _idCounter = 0;
function generateId(): string {
  _idCounter++;
  return `rem-${Date.now()}-${_idCounter}`;
}

function isValidDate(dateStr: string): boolean {
  return !isNaN(new Date(dateStr + "T00:00:00").getTime());
}

function daysUntil(dateStr: string): number | null {
  if (!dateStr || !isValidDate(dateStr)) return null;
  const target = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((target.getTime() - now.getTime()) / 86400000);
}

function isDuplicate(category: ReminderCategory, entityId: string): boolean {
  const store = getReminderStore();
  return store.reminders.some(
    r => r.category === category && r.entityId === entityId && r.status !== "dismissed",
  );
}

function isCompleted(continuity: PatientContinuity, entityType: ReminderEntityType, entityId: string): boolean {
  switch (entityType) {
    case "appointment":
      return !!continuity.appointments.find(a => a.id === entityId && (a.status === "completed" || a.status === "cancelled"));
    case "follow_up":
      return !!continuity.followUps.find(f => f.id === entityId && (f.status === "completed" || f.status === "cancelled"));
    case "billing":
      return !!continuity.billing.find(b => b.id === entityId && b.status === "completed");
    default:
      return false;
  }
}

// ── Appointment reminders ──

function generateAppointmentReminders(continuity: PatientContinuity): ReminderEvent[] {
  const reminders: ReminderEvent[] = [];
  for (const apt of continuity.appointments) {
    if (isCompleted(continuity, "appointment", apt.id)) continue;
    const days = daysUntil(apt.date);
    if (days === null) continue;

    // Missed
    if (days < 0 && (apt.status === "scheduled" || apt.status === "confirmed")) {
      if (isDuplicate("appointment_missed", apt.id)) continue;
      reminders.push({
        id: generateId(),
        category: "appointment_missed",
        priority: "high",
        title: "Missed appointment",
        description: `You missed your visit with ${apt.doctorName} on ${apt.date}`,
        createdAt: new Date().toISOString(),
        scheduledFor: apt.date + "T" + (apt.time || "00:00"),
        expiresAt: null,
        status: "pending",
        entityType: "appointment",
        entityId: apt.id,
        correlationGroup: `apt-${apt.id}`,
        appointmentId: apt.id,
        consultationId: null,
        prescriptionId: null,
        followUpId: null,
        billingId: null,
        snoozedUntil: null,
        retryCount: 0,
        maxRetries: 2,
      });
      continue;
    }

    // Upcoming (today or tomorrow)
    if (days === 0 || days === 1) {
      if (isDuplicate("appointment_reminder", apt.id)) continue;
      const category: ReminderCategory = days === 0 ? "appointment_today" : "appointment_reminder";
      reminders.push({
        id: generateId(),
        category,
        priority: days === 0 ? "high" : "medium",
        title: days === 0 ? "Appointment today" : "Appointment tomorrow",
        description: `With ${apt.doctorName}${apt.time ? ` at ${apt.time}` : ""}${apt.clinicName ? ` · ${apt.clinicName}` : ""}`,
        createdAt: new Date().toISOString(),
        scheduledFor: apt.date + "T" + (apt.time || "09:00"),
        expiresAt: new Date(apt.date + "T23:59:59").toISOString(),
        status: "pending",
        entityType: "appointment",
        entityId: apt.id,
        correlationGroup: `apt-${apt.id}`,
        appointmentId: apt.id,
        consultationId: null,
        prescriptionId: null,
        followUpId: null,
        billingId: null,
        snoozedUntil: null,
        retryCount: 0,
        maxRetries: 1,
      });
    }
  }
  return reminders;
}

// ── Follow-up reminders ──

function generateFollowUpReminders(continuity: PatientContinuity): ReminderEvent[] {
  const reminders: ReminderEvent[] = [];
  for (const fup of continuity.followUps) {
    if (isCompleted(continuity, "follow_up", fup.id)) continue;
    const days = daysUntil(fup.recommendedDate);
    if (days === null) continue;

    // Overdue
    if (days < 0) {
      if (isDuplicate("follow_up_overdue", fup.id)) continue;
      reminders.push({
        id: generateId(),
        category: "follow_up_overdue",
        priority: "high",
        title: "Follow-up overdue",
        description: `${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""} past due${fup.doctorName ? ` with ${fup.doctorName}` : ""}`,
        createdAt: new Date().toISOString(),
        scheduledFor: fup.recommendedDate + "T00:00:00",
        expiresAt: null,
        status: "pending",
        entityType: "follow_up",
        entityId: fup.id,
        correlationGroup: `fup-${fup.id}`,
        appointmentId: null,
        consultationId: null,
        prescriptionId: null,
        followUpId: fup.id,
        billingId: null,
        snoozedUntil: null,
        retryCount: 0,
        maxRetries: 3,
      });
      continue;
    }

    // Due within 3 days
    if (days <= 3) {
      if (isDuplicate("follow_up_reminder", fup.id) || isDuplicate("follow_up_due", fup.id)) continue;
      const category: ReminderCategory = days === 0 ? "follow_up_due" : "follow_up_reminder";
      reminders.push({
        id: generateId(),
        category,
        priority: days === 0 ? "high" : "medium",
        title: days === 0 ? "Follow-up due today" : `Follow-up in ${days}d`,
        description: fup.reason || `Recommended${fup.doctorName ? ` by ${fup.doctorName}` : ""}`,
        createdAt: new Date().toISOString(),
        scheduledFor: fup.recommendedDate + "T09:00:00",
        expiresAt: new Date(fup.recommendedDate + "T23:59:59").toISOString(),
        status: "pending",
        entityType: "follow_up",
        entityId: fup.id,
        correlationGroup: `fup-${fup.id}`,
        appointmentId: null,
        consultationId: null,
        prescriptionId: null,
        followUpId: fup.id,
        billingId: null,
        snoozedUntil: null,
        retryCount: 0,
        maxRetries: 2,
      });
    }
  }
  return reminders;
}

// ── Medication reminders ──

function generateMedicationReminders(continuity: PatientContinuity): ReminderEvent[] {
  const reminders: ReminderEvent[] = [];
  for (const rx of continuity.prescriptions) {
    for (const med of rx.items) {
      const dedupKey = `${rx.id}-${med.drugName}`;
      if (isDuplicate("medication_reminder", dedupKey)) continue;

      let expiresAt: string | null = null;
      if (med.duration) {
        const match = med.duration.match(/(\d+)/);
        if (match) {
          const d = new Date();
          d.setDate(d.getDate() + parseInt(match[1]));
          expiresAt = d.toISOString();
        }
      }

      reminders.push({
        id: generateId(),
        category: "medication_reminder",
        priority: "medium",
        title: med.drugName,
        description: `${med.dosage}${med.duration ? ` · ${med.duration}` : ""}`,
        createdAt: new Date().toISOString(),
        scheduledFor: new Date().toISOString(),
        expiresAt,
        status: "pending",
        entityType: "prescription",
        entityId: dedupKey,
        correlationGroup: `rx-${rx.id}`,
        appointmentId: null,
        consultationId: rx.consultationId,
        prescriptionId: rx.id,
        followUpId: null,
        billingId: null,
        snoozedUntil: null,
        retryCount: 0,
        maxRetries: 1,
      });
    }
  }
  return reminders;
}

// ── Payment reminders ──

function generatePaymentReminders(continuity: PatientContinuity): ReminderEvent[] {
  const reminders: ReminderEvent[] = [];
  for (const bil of continuity.billing) {
    if (isCompleted(continuity, "billing", bil.id)) continue;
    if (bil.pendingAmount <= 0) continue;
    const days = daysUntil(bil.date);
    if (days === null) continue;

    if (isDuplicate("payment_reminder", bil.id) || isDuplicate("payment_overdue", bil.id)) continue;

    if (days < -7) {
      reminders.push({
        id: generateId(),
        category: "payment_overdue",
        priority: "high",
        title: "Payment overdue",
        description: `₹${bil.pendingAmount.toLocaleString("en-IN")} pending since ${new Date(bil.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`,
        createdAt: new Date().toISOString(),
        scheduledFor: bil.date + "T00:00:00",
        expiresAt: null,
        status: "pending",
        entityType: "billing",
        entityId: bil.id,
        correlationGroup: `bil-${bil.id}`,
        appointmentId: null,
        consultationId: bil.consultationId,
        prescriptionId: null,
        followUpId: null,
        billingId: bil.id,
        snoozedUntil: null,
        retryCount: 0,
        maxRetries: 3,
      });
    } else if (days < 0) {
      reminders.push({
        id: generateId(),
        category: "payment_reminder",
        priority: "medium",
        title: "Payment reminder",
        description: `₹${bil.pendingAmount.toLocaleString("en-IN")} outstanding`,
        createdAt: new Date().toISOString(),
        scheduledFor: bil.date + "T00:00:00",
        expiresAt: null,
        status: "pending",
        entityType: "billing",
        entityId: bil.id,
        correlationGroup: `bil-${bil.id}`,
        appointmentId: null,
        consultationId: bil.consultationId,
        prescriptionId: null,
        followUpId: null,
        billingId: bil.id,
        snoozedUntil: null,
        retryCount: 0,
        maxRetries: 1,
      });
    }
  }
  return reminders;
}

// ── Consultation summary reminders ──

function generateConsultationSummaryReminders(continuity: PatientContinuity): ReminderEvent[] {
  const reminders: ReminderEvent[] = [];
  for (const con of continuity.consultations) {
    if (isDuplicate("consultation_summary", con.id)) continue;
    const days = daysUntil(con.date);
    if (days === null) continue;
    if (days >= -7 && days <= 0) {
      reminders.push({
        id: generateId(),
        category: "consultation_summary",
        priority: "low",
        title: "Consultation summary available",
        description: con.diagnosis
          ? `Diagnosis: ${con.diagnosis}`
          : `Visit summary from ${new Date(con.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`,
        createdAt: new Date().toISOString(),
        scheduledFor: con.date + "T00:00:00",
        expiresAt: null,
        status: "pending",
        entityType: "consultation",
        entityId: con.id,
        correlationGroup: null,
        appointmentId: con.appointmentId,
        consultationId: con.id,
        prescriptionId: null,
        followUpId: null,
        billingId: null,
        snoozedUntil: null,
        retryCount: 0,
        maxRetries: 0,
      });
    }
  }
  return reminders;
}

// ── Stale reminder cleanup ──

function cleanupStaleReminders(continuity: PatientContinuity): void {
  const store = getReminderStore();
  const toComplete: string[] = [];
  const toRemove: string[] = [];

  for (const r of store.reminders) {
    if (r.status !== "pending" && r.status !== "shown") continue;

    switch (r.entityType) {
      case "appointment": {
        const apt = continuity.appointments.find(a => a.id === r.entityId);
        if (!apt) continue;
        if (apt.status === "completed" || apt.status === "cancelled") {
          toComplete.push(r.id);
        } else if (r.category === "appointment_reminder" || r.category === "appointment_today") {
          const scheduledDate = r.scheduledFor.split("T")[0];
          if (scheduledDate && apt.date !== scheduledDate) {
            toRemove.push(r.id);
          }
        }
        break;
      }
      case "follow_up": {
        const fup = continuity.followUps.find(f => f.id === r.entityId);
        if (!fup) continue;
        if (fup.status === "completed" || fup.status === "cancelled") {
          toComplete.push(r.id);
        }
        break;
      }
      case "billing": {
        const bil = continuity.billing.find(b => b.id === r.entityId);
        if (!bil) continue;
        if (bil.status === "completed" || bil.pendingAmount <= 0) {
          toComplete.push(r.id);
        }
        break;
      }
      case "prescription":
      case "consultation":
        break;
    }
  }

  if (toComplete.length === 0 && toRemove.length === 0) return;

  saveReminderStore({
    ...store,
    reminders: store.reminders
      .map(r => toComplete.includes(r.id) ? { ...r, status: "completed" as const } : r)
      .filter(r => !toRemove.includes(r.id)),
  });
}

// ── Orchestrator ──

export function computeAndStoreReminders(continuity: PatientContinuity): { generated: number; suppressed: number } {
  cleanupStaleReminders(continuity);

  const allReminders: ReminderEvent[] = [
    ...generateAppointmentReminders(continuity),
    ...generateFollowUpReminders(continuity),
    ...generateMedicationReminders(continuity),
    ...generatePaymentReminders(continuity),
    ...generateConsultationSummaryReminders(continuity),
  ];

  const store = getReminderStore();
  const existingIds = new Set(store.reminders.map(r => r.id));
  const newReminders = allReminders.filter(r => !existingIds.has(r.id));

  if (newReminders.length === 0) {
    return { generated: 0, suppressed: allReminders.length };
  }

  addReminders(newReminders);
  return { generated: newReminders.length, suppressed: allReminders.length - newReminders.length };
}

// ── Sorting ──

const PRIORITY_ORDER: Record<ReminderPriority, number> = { high: 0, medium: 1, low: 2 };

export function sortReminders(reminders: ReminderEvent[]): ReminderEvent[] {
  return [...reminders].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (p !== 0) return p;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

// ── Grouping ──

export function groupRemindersByDate(reminders: ReminderEvent[]): { label: string; items: ReminderEvent[] }[] {
  const groups = new Map<string, ReminderEvent[]>();
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday start

  for (const r of reminders) {
    const date = new Date(r.createdAt);
    let label: string;
    if (date.toDateString() === now.toDateString()) label = "Today";
    else if (date.toDateString() === yesterday.toDateString()) label = "Yesterday";
    else if (date >= thisWeekStart) label = "This Week";
    else label = "Earlier";
    const items = groups.get(label) ?? [];
    groups.set(label, [...items, r]);
  }

  const order = ["Today", "Yesterday", "This Week", "Earlier"];
  return order.filter(l => groups.has(l)).map(label => ({ label, items: sortReminders(groups.get(label)!) }));
}

// ── Active filter ──

export function getActiveReminders(reminders: ReminderEvent[]): ReminderEvent[] {
  const now = Date.now();
  return reminders.filter(r => {
    if (r.status === "dismissed" || r.status === "completed") return false;
    if (r.status === "snoozed" && r.snoozedUntil && new Date(r.snoozedUntil).getTime() > now) return false;
    if (r.expiresAt && new Date(r.expiresAt).getTime() < now) return false;
    return true;
  });
}
