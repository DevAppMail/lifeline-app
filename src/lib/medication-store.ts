import type { ReminderEvent } from "@/types/reminder";

const STORAGE_KEY = "lifeline_medication_schedules";

export interface MedicationSchedule {
  id: string;
  drugName: string;
  dosage: string;
  schedule: string;
  duration: string;
  startDate: string;
  endDate: string | null;
  instructions: string | null;
  reminderTimes: string[];
  status: "active" | "completed" | "expired";
  createdAt: string;
  source: "prescription" | "manual";
  prescriptionId: string | null;
}

interface MedicationStore {
  schedules: MedicationSchedule[];
}

function defaultStore(): MedicationStore {
  return { schedules: [] };
}

export function getMedicationStore(): MedicationStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultStore();
    const parsed = JSON.parse(raw);
    if (!parsed.schedules) return defaultStore();
    return parsed;
  } catch {
    return defaultStore();
  }
}

export function saveMedicationStore(data: MedicationStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* silent */ }
}

export function addMedicationSchedule(schedule: MedicationSchedule): void {
  const store = getMedicationStore();
  store.schedules.unshift(schedule);
  saveMedicationStore(store);
}

export function updateMedicationStatus(
  id: string,
  status: MedicationSchedule["status"],
): void {
  const store = getMedicationStore();
  store.schedules = store.schedules.map(s =>
    s.id === id ? { ...s, status } : s,
  );
  saveMedicationStore(store);
}

function parseTime(time: string): { h: number; m: number } | null {
  const parts = time.split(":").map(Number);
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
  if (parts[0] < 0 || parts[0] > 23 || parts[1] < 0 || parts[1] > 59) return null;
  return { h: parts[0], m: parts[1] };
}

export function getActiveMedications(): MedicationSchedule[] {
  const store = getMedicationStore();
  const now = new Date();

  const updated = store.schedules.map(s => {
    if (s.status === "active" && s.endDate && new Date(s.endDate) < now) {
      return { ...s, status: "expired" as const };
    }
    return s;
  });
  if (updated.some((s, i) => s.status !== store.schedules[i].status)) {
    store.schedules = updated;
    saveMedicationStore(store);
  }

  return updated.filter(s => s.status === "active");
}

export function getDueMedicationReminders(): ReminderEvent[] {
  const active = getActiveMedications();
  const now = new Date();
  const reminders: ReminderEvent[] = [];
  const todayStr = now.toISOString().split("T")[0];

  const remindedKey = `med_reminded_${todayStr}`;
  let reminded: string[] = [];
  try {
    const raw = localStorage.getItem(remindedKey);
    if (raw) reminded = JSON.parse(raw);
  } catch { /* silent */ }

  for (const med of active) {
    for (const time of med.reminderTimes) {
      const parsed = parseTime(time);
      if (!parsed) continue;

      const scheduled = new Date();
      scheduled.setHours(parsed.h, parsed.m, 0, 0);

      if (scheduled < now) continue;

      const doseKey = `${med.id}-${time}`;
      if (reminded.includes(doseKey)) continue;

      reminders.push({
        id: `med-${doseKey}`,
        category: "medication_reminder",
        priority: "medium",
        title: med.drugName,
        description: `${med.dosage} · ${med.schedule}`,
        createdAt: new Date().toISOString(),
        scheduledFor: scheduled.toISOString(),
        expiresAt: scheduled.toISOString(),
        status: "pending",
        entityType: "prescription",
        entityId: med.id,
        correlationGroup: `med-${med.id}`,
        doctorId: null,
        appointmentId: null,
        consultationId: null,
        prescriptionId: med.prescriptionId,
        followUpId: null,
        billingId: null,
        snoozedUntil: null,
        retryCount: 0,
        maxRetries: 2,
      });

      reminded.push(doseKey);
    }
  }

  try {
    localStorage.setItem(remindedKey, JSON.stringify(reminded));
  } catch { /* silent */ }

  return reminders;
}

export function markDoseTaken(medId: string, time: string): void {
  const todayStr = new Date().toISOString().split("T")[0];
  const doseKey = `${medId}-${time}`;
  try {
    const remindedKey = `med_reminded_${todayStr}`;
    const raw = localStorage.getItem(remindedKey);
    const reminded: string[] = raw ? JSON.parse(raw) : [];
    if (!reminded.includes(doseKey)) reminded.push(doseKey);
    localStorage.setItem(remindedKey, JSON.stringify(reminded));

    const takenKey = `med_taken_${todayStr}`;
    const taken: string[] = JSON.parse(localStorage.getItem(takenKey) || "[]");
    if (!taken.includes(doseKey)) {
      taken.push(doseKey);
      localStorage.setItem(takenKey, JSON.stringify(taken));
    }
  } catch { /* silent */ }
}

export function getMissedDoses(daysBack: number = 1): { date: string; medId: string; time: string; drugName: string; dosage: string }[] {
  const active = getActiveMedications();
  const missed: { date: string; medId: string; time: string; drugName: string; dosage: string }[] = [];

  for (let d = 0; d <= daysBack; d++) {
    const date = new Date(Date.now() - d * 86400000);
    const dateStr = date.toISOString().split("T")[0];
    const takenKey = `med_taken_${dateStr}`;
    let taken: string[] = [];
    try {
      taken = JSON.parse(localStorage.getItem(takenKey) || "[]");
    } catch { /* silent */ }

    for (const med of active) {
      for (const time of med.reminderTimes) {
        const doseKey = `${med.id}-${time}`;
        if (!taken.includes(doseKey)) {
          const scheduled = new Date(date);
          const parsed = parseTime(time);
          if (!parsed) continue;
          scheduled.setHours(parsed.h, parsed.m, 0, 0);
          if (scheduled < new Date()) {
            missed.push({ date: dateStr, medId: med.id, time, drugName: med.drugName, dosage: med.dosage });
          }
        }
      }
    }
  }

  return missed;
}

export function getAdherenceStats(days: number = 7): {
  total: number;
  taken: number;
  missed: number;
  rate: number;
} {
  let total = 0;
  let taken = 0;

  for (let d = 0; d < days; d++) {
    const date = new Date(Date.now() - d * 86400000);
    const dateStr = date.toISOString().split("T")[0];
    const takenKey = `med_taken_${dateStr}`;
    try {
      const t: string[] = JSON.parse(localStorage.getItem(takenKey) || "[]");
      taken += t.length;
    } catch { /* silent */ }
  }

  const active = getActiveMedications();
  for (const med of active) {
    total += med.reminderTimes.length * days;
  }

  return {
    total,
    taken,
    missed: Math.max(0, total - taken),
    rate: total > 0 ? Math.round((taken / total) * 100) : 0,
  };
}

export function clearOldMedicationData(): void {
  const thirtyDaysAgo = Date.now() - 30 * 86400000;
  const store = getMedicationStore();
  store.schedules = store.schedules.filter(s => {
    if (s.status !== "expired") return true;
    return new Date(s.endDate ?? s.createdAt).getTime() > thirtyDaysAgo;
  });
  saveMedicationStore(store);

  for (let d = 0; d < 60; d++) {
    const dateStr = new Date(Date.now() - d * 86400000).toISOString().split("T")[0];
    if (d > 30) {
      localStorage.removeItem(`med_reminded_${dateStr}`);
      localStorage.removeItem(`med_taken_${dateStr}`);
    }
  }
}

export function clearCompletedMedications(): void {
  const store = getMedicationStore();
  store.schedules = store.schedules.filter(s => s.status === "active");
  saveMedicationStore(store);
}
