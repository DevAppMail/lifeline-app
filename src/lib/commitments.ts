// ── Donor Commitment Store ──────────────────────────────────────────
// LocalStorage-based donor commitment state.
// Enhanced for Sprint 1 lifecycle integration.

import { type BloodGroup, type RequestTier } from "@/types/fulfillment";
import { recordDonationResult } from "@/lib/donor-state";

export interface Commitment {
  requestId: string;
  lifelineId?: string;
  hospitalName: string;
  hospitalLocation: string;
  patientFirstName: string;
  bloodGroup: BloodGroup | string;
  requiredDate: string;
  requiredTime: string;
  tier?: RequestTier;
  committedAt: string;
  status: "committed" | "awaiting_confirmation" | "completed" | "missed";
  confirmationId?: number;
  requesterUserId?: number;
  donorId?: string;
}

const KEY = "lifeline_commitments";
const SEEN_KEY = "lifeline_requests_seen_ids";
const PENDING_CELEBRATION_KEY = "lifeline_pending_celebrations";

// ── Read ────────────────────────────────────────────────────────────

export function getCommitments(): Commitment[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function getCommitment(requestId: string): Commitment | undefined {
  return getCommitments().find((c) => c.requestId === requestId || c.lifelineId === requestId);
}

// ── Write ───────────────────────────────────────────────────────────

export function addCommitment(c: Commitment): void {
  const list = getCommitments().filter((x) => x.requestId !== c.requestId && x.lifelineId !== c.lifelineId);
  localStorage.setItem(KEY, JSON.stringify([c, ...list]));

  // Also record in the request store for lifecycle tracking
  if (c.donorId) {
    try {
      const { recordDonorResponse } = require("@/lib/request-store");
      recordDonorResponse(c.requestId, c.donorId, "committed", {
        committed_at: c.committedAt,
      });
    } catch {}
  }
}

export function updateCommitmentStatus(
  requestId: string,
  status: Commitment["status"],
  extra?: { confirmationId?: number }
): void {
  const list = getCommitments().map((c) =>
    (c.requestId === requestId || c.lifelineId === requestId)
      ? { ...c, status, ...(extra ?? {}) }
      : c
  );
  localStorage.setItem(KEY, JSON.stringify(list));

  // Track in donor state for reliability scoring
  if (status === "completed") {
    recordDonationResult(true);
  } else if (status === "missed") {
    recordDonationResult(false);
  }
}

// ── Seen IDs ────────────────────────────────────────────────────────

export function getSeenIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function markAsSeen(ids: string[]): void {
  const current = getSeenIds();
  const merged = Array.from(new Set([...current, ...ids]));
  localStorage.setItem(SEEN_KEY, JSON.stringify(merged));
}

// ── Pending Celebrations ────────────────────────────────────────────

export function addPendingCelebration(confirmationId: number, requestId: string): void {
  const current = getPendingCelebrations();
  current[confirmationId] = requestId;
  localStorage.setItem(PENDING_CELEBRATION_KEY, JSON.stringify(current));
}

export function getPendingCelebrations(): Record<number, string> {
  try {
    return JSON.parse(localStorage.getItem(PENDING_CELEBRATION_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function removePendingCelebration(confirmationId: number): void {
  const current = getPendingCelebrations();
  delete current[confirmationId];
  localStorage.setItem(PENDING_CELEBRATION_KEY, JSON.stringify(current));
}
