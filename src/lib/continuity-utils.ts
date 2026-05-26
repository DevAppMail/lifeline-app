import type {
  PatientContinuity,
  NormalizedContinuityEvent,
  ContinuityEntityType,
  ContinuityAppointment,
  ContinuityConsultation,
  ContinuityPrescription,
  ContinuityFollowUp,
  ContinuityBilling,
} from "@/types/continuity";

export function normalizeContinuityFeed(continuity: PatientContinuity): NormalizedContinuityEvent[] {
  const events: NormalizedContinuityEvent[] = [];

  for (const a of continuity.appointments) {
    events.push({
      id: `apt-${a.id}`,
      type: "appointment",
      date: a.date,
      sortKey: `${a.date}T${a.time || "00:00"}`,
      data: a,
    });
  }

  for (const c of continuity.consultations) {
    events.push({
      id: `con-${c.id}`,
      type: "consultation",
      date: c.date,
      sortKey: `${c.date}T23:59:59`,
      data: c,
    });
  }

  for (const p of continuity.prescriptions) {
    events.push({
      id: `rx-${p.id}`,
      type: "prescription",
      date: p.date,
      sortKey: `${p.date}T23:59:59`,
      data: p,
    });
  }

  for (const f of continuity.followUps) {
    events.push({
      id: `fup-${f.id}`,
      type: "follow_up",
      date: f.recommendedDate || f.id,
      sortKey: `${f.recommendedDate || "9999-12-31"}T00:00:00`,
      data: f,
    });
  }

  for (const b of continuity.billing) {
    events.push({
      id: `bil-${b.id}`,
      type: "billing",
      date: b.date,
      sortKey: `${b.date}T23:59:59`,
      data: b,
    });
  }

  return events.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

export function groupByDate(
  events: NormalizedContinuityEvent[],
): { label: string; items: NormalizedContinuityEvent[] }[] {
  const groups = new Map<string, NormalizedContinuityEvent[]>();
  for (const event of events) {
    const key = new Date(event.date).toDateString();
    const existing = groups.get(key) ?? [];
    groups.set(key, [...existing, event]);
  }
  return Array.from(groups.entries()).map(([key, items]) => ({
    label: formatDateLabel(new Date(key).toISOString()),
    items,
  }));
}

export function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

export function timeRemaining(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return "Overdue";
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return `${days}d left`;
  if (days < 30) return `${Math.floor(days / 7)}w left`;
  return `${Math.floor(days / 30)}mo left`;
}

export function isOverdue(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

export function pendingFollowUps(continuity: PatientContinuity): ContinuityFollowUp[] {
  return continuity.followUps.filter((f) => f.status === "pending" || f.status === "pending_approval");
}

export function upcomingAppointments(continuity: PatientContinuity): ContinuityAppointment[] {
  return continuity.appointments
    .filter((a) => a.status === "scheduled")
    .sort((a, b) => `${a.date}T${a.time || "00:00"}`.localeCompare(`${b.date}T${b.time || "00:00"}`));
}

export function recentConsultations(continuity: PatientContinuity, limit = 3): ContinuityConsultation[] {
  return continuity.consultations.slice(0, limit);
}

export function totalPrescriptions(continuity: PatientContinuity): { count: number; totalMeds: number } {
  const count = continuity.prescriptions.length;
  const totalMeds = continuity.prescriptions.reduce((s, p) => s + p.items.length, 0);
  return { count, totalMeds };
}

export function timelineEventsToContinuity(
  events: NormalizedContinuityEvent[],
  typeFilter?: ContinuityEntityType | "all",
): NormalizedContinuityEvent[] {
  if (!typeFilter || typeFilter === "all") return events;
  return events.filter((e) => e.type === typeFilter);
}

export function lineageForAppointment(
  continuity: PatientContinuity,
  appointmentId: string,
): {
  appointment?: ContinuityAppointment;
  consultations: ContinuityConsultation[];
  prescriptions: ContinuityPrescription[];
  followUps: ContinuityFollowUp[];
  billing: ContinuityBilling[];
} {
  const appointment = continuity.appointments.find((a) => a.id === appointmentId);
  const consultations = continuity.consultations.filter((c) => c.appointmentId === appointmentId);
  const consultationIds = consultations.map((c) => c.id);
  const prescriptions = continuity.prescriptions.filter((p) => consultationIds.includes(p.consultationId));
  const followUps = continuity.followUps.filter((f) => f.id && consultationIds.includes(f.id));
  const billing = continuity.billing.filter((b) => consultationIds.includes(b.consultationId));
  return { appointment, consultations, prescriptions, followUps, billing };
}
