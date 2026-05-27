import {
  type DonorOperationalState,
  type DonorOperationalData,
  type DonorAvailabilityMode,
  canTransitionDonorState,
} from "@/types/fulfillment";

const STATE_KEY = "lifeline_donor_operational_state";
const HISTORY_KEY = "lifeline_donor_outcome_history";
const ADMIN_KEY = "lifeline_donor_admin_data";
const WINDOW_SIZE = 10;

interface DonationOutcome {
  date: string;
  success: boolean;
  reason?: "completed" | "missed" | "medically_rejected" | "cancelled";
  requestId?: string;
}

interface DonorAdminData {
  cancellationReasons: { date: string; reason: string }[];
  noShowReviews: { date: string; reviewed: boolean; action?: string }[];
  strikeCount: number;
  lastStrikeDate?: string;
  notes: string;
}

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

function defaultAdminData(): DonorAdminData {
  return { cancellationReasons: [], noShowReviews: [], strikeCount: 0, notes: "" };
}

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

function getOutcomeHistory(): DonationOutcome[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveOutcomeHistory(history: DonationOutcome[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function getAdminData(): DonorAdminData {
  try {
    return JSON.parse(localStorage.getItem(ADMIN_KEY) ?? JSON.stringify(defaultAdminData()));
  } catch {
    return defaultAdminData();
  }
}

function saveAdminData(data: DonorAdminData): void {
  localStorage.setItem(ADMIN_KEY, JSON.stringify(data));
}

function computeWindowedReliability(window: DonationOutcome[]): {
  tier: DonorOperationalData["reliability_tier"];
  rate: number;
  trend: "improving" | "declining" | "stable" | "unproven";
} {
  if (window.length < 3) return { tier: "unproven", rate: 0, trend: "unproven" };

  const total = window.length;
  const successful = window.filter(o => o.success).length;
  const rate = successful / total;

  const recencyWeighted = window.reduce((sum, o, i) => {
    const weight = (i + 1) / total;
    return sum + (o.success ? weight : 0);
  }, 0);

  const firstHalf = window.slice(0, Math.floor(total / 2));
  const secondHalf = window.slice(Math.floor(total / 2));
  const firstRate = firstHalf.filter(o => o.success).length / firstHalf.length;
  const secondRate = secondHalf.filter(o => o.success).length / secondHalf.length;
  const trend = firstRate === 0 && secondRate === 0 ? "stable"
    : secondRate > firstRate ? "improving"
    : secondRate < firstRate ? "declining"
    : "stable";

  const tier = rate >= 0.9 ? "high"
    : rate >= 0.6 ? "moderate"
    : "low";

  return { tier, rate, trend };
}

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

export function enterCooldown(lastDonationDate: string): void {
  const data = getDonorOperationalData();
  data.state = "cooldown";
  data.last_donation_date = lastDonationDate;

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

export function recordDonationResult(
  success: boolean,
  reason?: "completed" | "missed" | "medically_rejected" | "cancelled",
  requestId?: string,
): void {
  const data = getDonorOperationalData();
  const outcome: DonationOutcome = {
    date: new Date().toISOString(),
    success,
    reason: reason ?? (success ? "completed" : "missed"),
    requestId,
  };

  const history = getOutcomeHistory();
  history.unshift(outcome);
  if (history.length > 50) history.length = 50;
  saveOutcomeHistory(history);

  data.total_commitments += 1;

  if (success) {
    data.successful_donations += 1;
    data.consecutive_ghosts = 0;
  } else if (reason === "missed") {
    data.consecutive_ghosts += 1;
  }

  const window = history.slice(0, WINDOW_SIZE);
  const { tier, trend } = computeWindowedReliability(window);
  data.reliability_tier = tier;

  saveDonorOperationalData(data);

  if (data.consecutive_ghosts >= 3 && data.state === "available") {
    data.state = "temporarily_unavailable";
    saveDonorOperationalData(data);
  }
}

export function getDonorReliabilityReport(): {
  tier: DonorOperationalData["reliability_tier"];
  rate: number;
  trend: "improving" | "declining" | "stable" | "unproven";
  windowSize: number;
  totalCommitments: number;
  consecutiveGhosts: number;
  isSuspended: boolean;
} {
  const data = getDonorOperationalData();
  const history = getOutcomeHistory();
  const window = history.slice(0, WINDOW_SIZE);
  const { rate, trend } = computeWindowedReliability(window);

  return {
    tier: data.reliability_tier,
    rate,
    trend,
    windowSize: window.length,
    totalCommitments: data.total_commitments,
    consecutiveGhosts: data.consecutive_ghosts,
    isSuspended: data.state === "temporarily_unavailable" && data.consecutive_ghosts >= 3,
  };
}

export function recordCancellationReason(reason: string): void {
  const admin = getAdminData();
  admin.cancellationReasons.unshift({ date: new Date().toISOString(), reason });
  saveAdminData(admin);
}

export function getDonorAdminSnapshot(): DonorAdminData {
  return getAdminData();
}

export function getDonorStateSnapshot(): DonorOperationalData {
  return getDonorOperationalData();
}
