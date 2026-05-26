export type NotificationEventType =
  | "appointment_reminder"
  | "appointment_cancelled"
  | "follow_up_reminder"
  | "medication_reminder"
  | "payment_reminder"
  | "payment_receipt"
  | "prescription_issued"
  | "consultation_summary"
  | "follow_up_due";

export interface NotificationEventMeta {
  eventType: NotificationEventType;
  entityType: "appointment" | "consultation" | "prescription" | "follow_up" | "billing";
  entityId: string;
  federationId?: string;
  title: string;
  description?: string;
  date: string;
  priority: "high" | "medium" | "low";
  channel: "in_app" | "sms";
  correlationId?: string;
}

export function buildAppointmentReminderEvent(
  appointmentId: string,
  doctorName: string,
  date: string,
  time: string,
): NotificationEventMeta {
  return {
    eventType: "appointment_reminder",
    entityType: "appointment",
    entityId: appointmentId,
    title: `Appointment with ${doctorName}`,
    description: `Tomorrow at ${time}`,
    date,
    priority: "medium",
    channel: "in_app",
  };
}

export function buildFollowUpReminderEvent(
  followUpId: string,
  doctorName: string,
  recommendedDate: string,
  reason?: string,
): NotificationEventMeta {
  return {
    eventType: "follow_up_reminder",
    entityType: "follow_up",
    entityId: followUpId,
    title: `Follow-up${doctorName ? ` with ${doctorName}` : ""}`,
    description: reason || `Recommended by ${recommendedDate}`,
    date: recommendedDate,
    priority: new Date(recommendedDate).getTime() < Date.now() ? "high" : "medium",
    channel: "sms",
  };
}

export function buildPaymentReminderEvent(
  billingId: string,
  amount: number,
  date: string,
): NotificationEventMeta {
  return {
    eventType: "payment_reminder",
    entityType: "billing",
    entityId: billingId,
    title: `Payment of ₹${amount.toLocaleString("en-IN")}`,
    description: "Outstanding balance",
    date,
    priority: "high",
    channel: "sms",
  };
}

export function buildMedicationReminderEvent(
  prescriptionId: string,
  drugName: string,
  dosage: string,
): NotificationEventMeta {
  return {
    eventType: "medication_reminder",
    entityType: "prescription",
    entityId: prescriptionId,
    title: drugName,
    description: `${dosage} — Take as prescribed`,
    date: new Date().toISOString().split("T")[0]!,
    priority: "medium",
    channel: "in_app",
  };
}

export function buildConsultationSummaryEvent(
  consultationId: string,
  date: string,
): NotificationEventMeta {
  return {
    eventType: "consultation_summary",
    entityType: "consultation",
    entityId: consultationId,
    title: "Consultation summary available",
    description: `Review your visit from ${new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`,
    date,
    priority: "low",
    channel: "in_app",
  };
}
