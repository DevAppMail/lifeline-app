// ── Donor Availability System (MVP) ─────────────────────────────────
// Sprint 1 — foundational availability model.
// Groundwork for the Temporal Availability Engine (TAE).

import {
  type DonorAvailability,
  type DonorAvailabilityMode,
  type WeeklySchedule,
  type TimeRange,
  type RequestTier,
  defaultWeeklySchedule,
} from "@/types/fulfillment";

const STORE_KEY = "lifeline_donor_availability";

// ── Defaults ────────────────────────────────────────────────────────

export function defaultAvailability(): DonorAvailability {
  return {
    active: true,
    mode: "always",
    weekly_schedule: defaultWeeklySchedule(),
    temporarily_unavailable: false,
    max_travel_radius_km: 10,
    preferred_time_of_day: "flexible",
    updated_at: new Date().toISOString(),
  };
}

// ── Read / Write ────────────────────────────────────────────────────

export function getDonorAvailability(): DonorAvailability {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultAvailability();
    return JSON.parse(raw) as DonorAvailability;
  } catch {
    return defaultAvailability();
  }
}

export function saveDonorAvailability(avail: DonorAvailability): void {
  avail.updated_at = new Date().toISOString();
  localStorage.setItem(STORE_KEY, JSON.stringify(avail));
}

// ── Mode Getters ────────────────────────────────────────────────────

export function isDonorAvailable(avail?: DonorAvailability): boolean {
  const a = avail ?? getDonorAvailability();
  if (!a.active) return false;
  if (a.temporarily_unavailable) return false;
  if (a.mode === "unavailable") return false;
  return true;
}

export function isDonorAvailableForTier(tier: RequestTier, avail?: DonorAvailability): boolean {
  const a = avail ?? getDonorAvailability();
  if (!isDonorAvailable(a)) return false;
  if (a.mode === "emergency_only" && tier !== "emergency") return false;
  return true;
}

// ── Time-Window Checking ────────────────────────────────────────────

const DAY_NAMES: Record<number, keyof WeeklySchedule> = {
  0: "sunday", 1: "monday", 2: "tuesday", 3: "wednesday",
  4: "thursday", 5: "friday", 6: "saturday",
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function isTimeInRange(time: string, range: TimeRange): boolean {
  const t = timeToMinutes(time);
  return t >= timeToMinutes(range.start) && t <= timeToMinutes(range.end);
}

export function isDonorAvailableAtTime(
  dateStr: string,
  timeStr: string,
  tier: RequestTier,
  avail?: DonorAvailability
): { available: boolean; reason?: string } {
  const a = avail ?? getDonorAvailability();

  if (!isDonorAvailableForTier(tier, a)) {
    return { available: false, reason: a.mode === "emergency_only" ? "Emergency only" : "Not available" };
  }

  if (a.temporarily_unavailable) {
    return { available: false, reason: "Temporarily unavailable" };
  }

  if (a.mode === "always") {
    return { available: true };
  }

  if (a.mode === "scheduled") {
    const date = new Date(dateStr);
    const dayName = DAY_NAMES[date.getDay()];
    const daySlots = a.weekly_schedule[dayName];

    if (!daySlots || daySlots.length === 0) {
      return { available: false, reason: "Not scheduled for this day" };
    }

    const match = daySlots.some((slot) => isTimeInRange(timeStr, slot));
    if (!match) {
      return { available: false, reason: "Outside scheduled time window" };
    }

    return { available: true };
  }

  return { available: false, reason: "Availability not configured" };
}

// ── Toggle ──────────────────────────────────────────────────────────

export function setDonorActive(active: boolean): void {
  const avail = getDonorAvailability();
  avail.active = active;
  saveDonorAvailability(avail);
}

export function toggleDonorActive(): boolean {
  const avail = getDonorAvailability();
  avail.active = !avail.active;
  saveDonorAvailability(avail);
  return avail.active;
}

// ── Mode Update ─────────────────────────────────────────────────────

export function setAvailabilityMode(mode: DonorAvailabilityMode): void {
  const avail = getDonorAvailability();
  avail.mode = mode;
  saveDonorAvailability(avail);
}

export function setTemporaryUnavailable(untilDate?: string, reason?: string): void {
  const avail = getDonorAvailability();
  avail.temporarily_unavailable = true;
  avail.unavailable_until = untilDate;
  avail.unavailable_reason = reason;
  saveDonorAvailability(avail);
}

export function clearTemporaryUnavailable(): void {
  const avail = getDonorAvailability();
  avail.temporarily_unavailable = false;
  delete avail.unavailable_until;
  delete avail.unavailable_reason;
  saveDonorAvailability(avail);
}

// ── Days of Week Support ────────────────────────────────────────────

export function updateDaysOfWeek(days: number[]): void {
  const avail = getDonorAvailability();
  avail.days_of_week = days;
  saveDonorAvailability(avail);
}

export function updateTimeWindows(windows: TimeRange[]): void {
  const avail = getDonorAvailability();
  avail.time_windows = windows;
  saveDonorAvailability(avail);
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function getDayLabels(): string[] {
  return DAY_LABELS;
}

// Check if a donor is available right now based on days_of_week + time_windows
export function isAvailableNow(avail?: DonorAvailability): { available: boolean; reason?: string } {
  const a = avail ?? getDonorAvailability();
  if (!a.active) return { available: false, reason: "Inactive" };
  if (a.temporarily_unavailable) return { available: false, reason: "Temporarily unavailable" };

  if (a.mode === "unavailable") return { available: false, reason: "Unavailable" };
  if (a.mode === "always") return { available: true };
  if (a.mode === "emergency_only") return { available: true, reason: "Emergency only" };

  if (a.mode === "scheduled") {
    const now = new Date();
    const currentDay = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    if (a.days_of_week && a.days_of_week.length > 0) {
      if (!a.days_of_week.includes(currentDay)) {
        return { available: false, reason: "Not available today" };
      }
    }

    if (a.time_windows && a.time_windows.length > 0) {
      const inWindow = a.time_windows.some((w) => {
        const start = parseInt(w.start.split(":")[0]) * 60 + parseInt(w.start.split(":")[1]);
        const end = parseInt(w.end.split(":")[0]) * 60 + parseInt(w.end.split(":")[1]);
        return currentMinutes >= start && currentMinutes <= end;
      });
      if (!inWindow) {
        return { available: false, reason: "Outside available time window" };
      }
    }

    return { available: true };
  }

  return { available: false, reason: "Unknown mode" };
}

// ── Schedule Management ─────────────────────────────────────────────

export function updateWeeklySchedule(schedule: WeeklySchedule): void {
  const avail = getDonorAvailability();
  avail.weekly_schedule = schedule;
  saveDonorAvailability(avail);
}

export function updateTimeSlot(day: keyof WeeklySchedule, slots: TimeRange[]): void {
  const avail = getDonorAvailability();
  avail.weekly_schedule[day] = slots;
  saveDonorAvailability(avail);
}

// ── Cooldown Checking ───────────────────────────────────────────────

export function isDonorInCooldown(lastDonationDate?: string): { inCooldown: boolean; daysRemaining: number; nextEligible: string } {
  if (!lastDonationDate) {
    return { inCooldown: false, daysRemaining: 0, nextEligible: "" };
  }

  const last = new Date(lastDonationDate).getTime();
  const nextEligible = last + 90 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  if (now >= nextEligible) {
    return { inCooldown: false, daysRemaining: 0, nextEligible: "" };
  }

  const daysRemaining = Math.ceil((nextEligible - now) / (24 * 60 * 60 * 1000));
  return {
    inCooldown: true,
    daysRemaining,
    nextEligible: new Date(nextEligible).toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
    }),
  };
}
