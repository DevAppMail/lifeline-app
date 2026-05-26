import type { ReminderEvent, ReminderStoreData } from "@/types/reminder";

const STORAGE_KEY = "lifeline_reminders";
const CURRENT_VERSION = 1;

function defaultStore(): ReminderStoreData {
  return { reminders: [], lastComputed: "", version: CURRENT_VERSION };
}

export function getReminderStore(): ReminderStoreData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultStore();
    const parsed = JSON.parse(raw) as ReminderStoreData;
    if (!parsed.reminders || parsed.version !== CURRENT_VERSION) return defaultStore();
    return parsed;
  } catch {
    return defaultStore();
  }
}

export function saveReminderStore(data: ReminderStoreData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage full or unavailable — fail silently
  }
}

export function addReminders(reminders: ReminderEvent[]): void {
  const store = getReminderStore();
  const existingIds = new Set(store.reminders.map(r => r.id));
  const newReminders = reminders.filter(r => !existingIds.has(r.id));
  if (newReminders.length === 0) return;
  saveReminderStore({
    ...store,
    reminders: [...newReminders, ...store.reminders],
    lastComputed: new Date().toISOString(),
  });
}

export function updateReminderStatus(
  id: string,
  status: ReminderEvent["status"],
  extras?: Partial<ReminderEvent>,
): void {
  const store = getReminderStore();
  saveReminderStore({
    ...store,
    reminders: store.reminders.map(r =>
      r.id === id ? { ...r, status, ...extras } : r,
    ),
  });
}

export function markAllRemindersRead(): void {
  const store = getReminderStore();
  saveReminderStore({
    ...store,
    reminders: store.reminders.map(r =>
      r.status === "pending" || r.status === "shown"
        ? { ...r, status: "read" as const }
        : r,
    ),
  });
}

export function getUnreadCount(): number {
  const store = getReminderStore();
  return store.reminders.filter(r => r.status === "pending" || r.status === "shown").length;
}

export function clearExpiredReminders(): void {
  const store = getReminderStore();
  const now = Date.now();
  saveReminderStore({
    ...store,
    reminders: store.reminders.filter(r => {
      if (r.expiresAt && new Date(r.expiresAt).getTime() < now) return false;
      return true;
    }),
  });
}

export function clearAllReminders(): void {
  saveReminderStore(defaultStore());
}
