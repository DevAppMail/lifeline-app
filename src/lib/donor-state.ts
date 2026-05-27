// ── Donor Operational State Machine ─────────────────────────────────
// Sprint 1 — foundational donor state management.
// Groundwork for reliability scoring, fatigue detection, ghost tracking.

import {
  type DonorOperationalState,
  type DonorOperationalData,
  type DonorAvailabilityMode,
  canTransitionDonorState,
} from "@/types/fulfillment";

const STATE_KEY = "lifeline_donor_operational_state";

// ── Default ─────────────────────────────────────────────────────────

export function defaultDonorOperationalData(): DonorOperationalData {
  return {
    state: "available",
    availability_mode: "always",
    consecutive_ghosts: 0,
    total_commitments: 0,
    successful_donations: 0,
    reliability_tier: "unproven",
  };
}

// ── Read / Write ────────────────────────────────────────────────────

export function getDonorOperationalData(): DonorOperationalData {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return defaultDonorOperationalData();
    return JSON.parse(raw) as DonorOperationalData;
  } catch {
    return defaultDonorOperationalData();
  }
}

function saveDonorOperationalData(data: DonorOperationalData): void {
  localStorage.setItem(STATE_KEY, JSON.stringify(data));
}

// ── State Transitions ───────────────────────────────────────────────

export function transitionDonorState(
  newState: DonorOperationalState
): { success: boolean; data: DonorOperationalData; reason?: string } {
  const data = getDonorOperationalData();

  if (!canTransitionDonorState(data.state, newState)) {
    return {
      success: false,
      data,
      reason: `Invalid transition: ${data.state} → ${newState}`,
    };
  }

  data.state = newState;
  saveDonorOperationalData(data);
  return { success: true, data };
}

// ── State Getters ───────────────────────────────────────────────────

export function isDonorOperationallyAvailable(data?: DonorOperationalData): boolean {
  const d = data ?? getDonorOperationalData();
  return d.state === "available";
}

export function getDonorStateLabel(state: DonorOperationalState): string {
  const labels: Record<DonorOperationalState, string> = {
    available: "Available",
    unavailable: "Unavailable",
    cooldown: "Cooling Down",
    temporarily_unavailable: "Temporarily Unavailable",
  };
  return labels[state];
}

// ── Cooldown ────────────────────────────────────────────────────────

export function enterCooldown(lastDonationDate: string): void {
  const data = getDonorOperationalData();
  data.state = "cooldown";
  data.last_donation_date = lastDonationDate;

  // Cooldown expires 90 days from now
  const expiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  data.cooldown_expiry = expiry.toISOString();

  saveDonorOperationalData(data);
}

export function checkCooldownExpired(): boolean {
  const data = getDonorOperationalData();
  if (data.state !== "cooldown" || !data.cooldown_expiry) return false;

  if (Date.now() >= new Date(data.cooldown_expiry).getTime()) {
    data.state = "available";
    data.cooldown_expiry = undefined;
    saveDonorOperationalData(data);
    return true;
  }
  return false;
}

// ── Reliability Tracking (groundwork) ───────────────────────────────

export function recordDonationResult(success: boolean): void {
  const data = getDonorOperationalData();
  data.total_commitments += 1;

  if (success) {
    data.successful_donations += 1;
    data.consecutive_ghosts = 0;
  } else {
    data.consecutive_ghosts += 1;
  }

  // Basic reliability tier computation (groundwork)
  if (data.total_commitments >= 3) {
    const rate = data.successful_donations / data.total_commitments;
    if (rate >= 0.9) data.reliability_tier = "high";
    else if (rate >= 0.6) data.reliability_tier = "moderate";
    else data.reliability_tier = "low";
  }

  saveDonorOperationalData(data);
}

// ── Sync Helper ────────────────────────────────────────────────────

export function getDonorStateSnapshot(): DonorOperationalData {
  return getDonorOperationalData();
}
