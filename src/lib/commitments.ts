// ── Donor Commitment Store ──────────────────────────────────────────
// LocalStorage-based donor commitment state.
// Sprint 1: lifecycle integration, celebration queue.
// Sprint 2: donor-linking integration, static imports.

import { type BloodGroup, type RequestTier } from "@/types/fulfillment";
import { recordDonationResult } from "@/lib/donor-state";
import { recordDonorResponse } from "@/lib/request-store";
import { transitionAssignmentState, createAssignment } from "@/lib/donor-linking";
import { addTimelineEntry, generateId } from "@/lib/health-store";

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
  checkedInAt?: string;
  status: "committed" | "checked_in" | "awaiting_confirmation" | "completed" | "missed";
  confirmationId?: number;
  requesterUserId?: number;
  donorId?: string;
  phone?: string;
}

const KEY = "lifeline_commitments";
const SEEN_KEY = "lifeline_requests_seen_ids";
const PENDING_CELEBRATION_KEY = "lifeline_pending_celebrations";

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

export function addCommitment(c: Commitment): void {
  const list = getCommitments().filter((x) => x.requestId !== c.requestId && x.lifelineId !== c.lifelineId);
  localStorage.setItem(KEY, JSON.stringify([c, ...list]));

  // Sync to request-store for lifecycle tracking
  if (c.donorId) {
    try {
      recordDonorResponse(c.requestId, c.donorId, "committed", {
        committed_at: c.committedAt,
      });
    } catch { /* silent */ }
  }

  // Sprint 2: create canonical donor assignment if donorId present
  if (c.donorId) {
    try {
      const existingAssignments = JSON.parse(localStorage.getItem("lifeline_donor_assignments") ?? "[]");
      const alreadyAssigned = existingAssignments.some(
        (a: { request_id: string; donor_id: string }) =>
          a.request_id === c.requestId && a.donor_id === c.donorId
      );
      if (!alreadyAssigned) {
        createAssignment({
          request_id: c.requestId,
          donor_id: c.donorId,
          donor_phone: c.phone ?? c.donorId,
          donor_name: c.patientFirstName,
          blood_group: c.bloodGroup as BloodGroup,
        });
      }
    } catch { /* silent */ }
  }
}

export function updateCommitmentStatus(
  requestId: string,
  status: Commitment["status"],
  extra?: { confirmationId?: number }
): void {
  const list = getCommitments().map((c) =>
    (c.requestId === requestId || c.lifelineId === requestId)
      ? { ...c, status, ...(extra ?? {}), ...(status === "checked_in" ? { checkedInAt: new Date().toISOString() } : {}) }
      : c
  );
  localStorage.setItem(KEY, JSON.stringify(list));

  // Track in donor state for reliability scoring with reason
  const c = list.find((cm) => cm.requestId === requestId || cm.lifelineId === requestId);
  if (status === "completed") {
    recordDonationResult(true, "completed", requestId);

    // Add to health timeline (Section 4 — continuity integration)
    if (c) {
      try {
        addTimelineEntry({
          id: generateId(),
          type: "donation",
          date: new Date().toISOString(),
          title: `Blood donation completed`,
          subtitle: c.patientFirstName ? `For ${c.patientFirstName}` : undefined,
          provider: c.hospitalName,
          location: c.hospitalLocation,
          status: "completed",
          notes: `Request: ${c.requestId}`,
        });
      } catch { /* silent */ }
    }
  } else if (status === "missed") {
    recordDonationResult(false, "missed", requestId);
  }

  // Sprint 2: sync to donor linking with proper state machine
  const commitment = list.find((c) => c.requestId === requestId || c.lifelineId === requestId);
  if (commitment?.donorId) {
    try {
      const mappedState = status === "completed" ? "confirmed"
        : status === "missed" ? "no_show"
        : status === "awaiting_confirmation" ? "donated"
        : status === "checked_in" ? "checked_in"
        : "committed";
      transitionAssignmentState(requestId, commitment.donorId, mappedState);
    } catch { /* silent */ }
  }
}

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
