// ── Donor ↔ Request Linking ────────────────────────────────────────
// Sprint 2 — canonical donor assignment tracking.
// Tracks every donor's full interaction lifecycle with each request.
// Foundation for reliability scoring, escalation, analytics, future AI.

import {
  type DonorAssignment,
  type DonorResponseState,
  type BloodGroup,
  type EscalationStage,
  type DonorOperationalState,
  DONOR_RESPONSE_TRANSITIONS,
} from "@/types/fulfillment";
import { recordDonorResponse, getRequest } from "@/lib/request-store";
import { writeAuditEntry } from "@/lib/audit-log";
import { getDonorOperationalData } from "@/lib/donor-state";

const LINKING_KEY = "lifeline_donor_assignments";

// ── Local Read / Write ─────────────────────────────────────────────

function readAssignments(): DonorAssignment[] {
  try {
    return JSON.parse(localStorage.getItem(LINKING_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeAssignments(assignments: DonorAssignment[]): void {
  localStorage.setItem(LINKING_KEY, JSON.stringify(assignments));
}

// ── Create Assignment ──────────────────────────────────────────────

export function createAssignment(params: {
  request_id: string;
  donor_id: string;
  donor_phone: string;
  donor_name?: string;
  blood_group: BloodGroup;
  units_committed?: number;
  stage_at_assignment?: EscalationStage;
  notes?: string;
}): DonorAssignment {
  const existing = readAssignments().find(
    (a) => a.request_id === params.request_id && a.donor_id === params.donor_id
  );
  if (existing) {
    writeAuditEntry({
      action: "donor.duplicate_prevented",
      actor_type: "system",
      request_id: params.request_id,
      donor_id: params.donor_id,
      details: "Duplicate assignment blocked",
      severity: "info",
    });
    return existing;
  }

  const ops = getDonorOperationalData();

  const assignment: DonorAssignment = {
    request_id: params.request_id,
    donor_id: params.donor_id,
    donor_phone: params.donor_phone,
    donor_name: params.donor_name,
    blood_group: params.blood_group,
    units_committed: params.units_committed ?? 1,
    state: "notified",
    stage_at_assignment: params.stage_at_assignment ?? "wave_1",
    donor_state_at_assignment: ops.state,
    notified_at: new Date().toISOString(),
    is_replacement: false,
    notes: params.notes,
  };

  // Record in request store
  try {
    recordDonorResponse(params.request_id, params.donor_id, "notified", {
      notified_at: assignment.notified_at,
    });
  } catch { /* silent */ }

  // Persist assignment
  const assignments = readAssignments();
  assignments.push(assignment);
  writeAssignments(assignments);

  // Audit
  writeAuditEntry({
    action: "donor.notified",
    actor_type: "system",
    request_id: params.request_id,
    donor_id: params.donor_id,
    new_state: "notified",
    severity: "info",
    escalation_stage: params.stage_at_assignment,
  });

  return assignment;
}

// ── Update Assignment State ────────────────────────────────────────

export function transitionAssignmentState(
  requestId: string,
  donorId: string,
  newState: DonorResponseState,
  extra?: Partial<DonorAssignment>,
): { success: boolean; assignment?: DonorAssignment; reason?: string } {
  const assignments = readAssignments();
  const idx = assignments.findIndex(
    (a) => a.request_id === requestId && a.donor_id === donorId
  );
  if (idx === -1) {
    return { success: false, reason: "Assignment not found" };
  }

  const current = assignments[idx];
  const validTransitions = DONOR_RESPONSE_TRANSITIONS[current.state];
  if (!validTransitions?.includes(newState)) {
    return {
      success: false,
      reason: `Invalid transition: ${current.state} → ${newState}`,
    };
  }

  const now = new Date().toISOString();

  // Timestamps based on state
  const timestamps: Partial<DonorAssignment> = {};
  if (newState === "accepted" || newState === "declined") {
    timestamps.responded_at = now;
    if (current.notified_at) {
      timestamps.response_latency_seconds = Math.round(
        (new Date(now).getTime() - new Date(current.notified_at).getTime()) / 1000
      );
    }
  }
  if (newState === "committed") timestamps.committed_at = now;
  if (newState === "checked_in") timestamps.checked_in_at = now;
  if (newState === "donated") timestamps.donated_at = now;
  if (newState === "confirmed") timestamps.confirmed_at = now;

  // Update
  assignments[idx] = {
    ...current,
    state: newState,
    ...timestamps,
    ...extra,
  };
  writeAssignments(assignments);

  // Sync to request-store for lifecycle tracking
  try {
    recordDonorResponse(requestId, donorId, newState);
  } catch { /* silent */ }

  // Audit
  writeAuditEntry({
    action: newState === "confirmed"
      ? "donor.confirmed"
      : newState === "no_show"
      ? "donor.no_show"
      : newState === "cancelled"
      ? "donor.cancelled"
      : "donor.responded",
    actor_type: "donor",
    actor_id: donorId,
    request_id: requestId,
    donor_id: donorId,
    previous_state: current.state,
    new_state: newState,
    details: timestamps.response_latency_seconds
      ? `Response latency: ${timestamps.response_latency_seconds}s`
      : undefined,
    severity: "info",
  });

  return { success: true, assignment: assignments[idx] };
}

// ── Replacement Donor ──────────────────────────────────────────────

export function createReplacementAssignment(
  originalDonorId: string,
  replacement: {
    request_id: string;
    donor_id: string;
    donor_phone: string;
    donor_name?: string;
    blood_group: BloodGroup;
  },
): DonorAssignment | null {
  const assignments = readAssignments();
  const original = assignments.find(
    (a) => a.request_id === replacement.request_id && a.donor_id === originalDonorId
  );
  if (!original) return null;

  // Mark original as replaced
  const origIdx = assignments.findIndex(
    (a) => a.request_id === replacement.request_id && a.donor_id === originalDonorId
  );
  if (origIdx >= 0) {
    assignments[origIdx] = {
      ...assignments[origIdx],
      state: "cancelled",
      notes: "Replaced by another donor",
    };
  }

  const ops = getDonorOperationalData();
  const newAssignment: DonorAssignment = {
    request_id: replacement.request_id,
    donor_id: replacement.donor_id,
    donor_phone: replacement.donor_phone,
    donor_name: replacement.donor_name,
    blood_group: replacement.blood_group,
    units_committed: 1,
    state: "notified",
    stage_at_assignment: original.stage_at_assignment,
    donor_state_at_assignment: ops.state,
    notified_at: new Date().toISOString(),
    is_replacement: true,
    replacement_for: originalDonorId,
  };

  assignments.push(newAssignment);
  writeAssignments(assignments);

  writeAuditEntry({
    action: "donor.replaced",
    actor_type: "system",
    request_id: replacement.request_id,
    donor_id: originalDonorId,
    new_state: "cancelled",
    details: `Replaced by donor ${replacement.donor_id}`,
    severity: "info",
  });

  return newAssignment;
}

// ── Query ──────────────────────────────────────────────────────────

export function getAssignmentsByRequest(requestId: string): DonorAssignment[] {
  return readAssignments().filter((a) => a.request_id === requestId);
}

export function getAssignmentsByDonor(donorId: string): DonorAssignment[] {
  return readAssignments().filter((a) => a.donor_id === donorId);
}

export function getActiveAssignmentsByRequest(requestId: string): DonorAssignment[] {
  return readAssignments().filter(
    (a) => a.request_id === requestId && !["no_show", "cancelled", "confirmed"].includes(a.state)
  );
}

export function getFulfillmentProgress(requestId: string): {
  assigned: number;
  committed: number;
  confirmed: number;
  noShows: number;
  totalNeeded: number;
  remaining: number;
} {
  const assignments = readAssignments().filter((a) => a.request_id === requestId);
  const req = getRequest(requestId);

  const assignmentConfirmed = assignments.filter((a) => a.state === "confirmed").length;
  const reqConfirmed = req?.donor_responses?.filter((r) => r.state === "confirmed").length ?? 0;
  const confirmed = Math.max(assignmentConfirmed, reqConfirmed);

  return {
    assigned: assignments.length,
    committed: assignments.filter((a) => a.state === "committed" || a.state === "checked_in").length,
    confirmed,
    noShows: assignments.filter((a) => a.state === "no_show").length,
    totalNeeded: req?.units_needed ?? 0,
    remaining: Math.max(0, (req?.units_needed ?? 0) - confirmed),
  };
}

// ── Response Latency Analysis (groundwork) ─────────────────────────

export function getAverageResponseLatency(donorId: string): number | null {
  const assignments = readAssignments().filter(
    (a) => a.donor_id === donorId && a.response_latency_seconds != null
  );
  if (assignments.length === 0) return null;

  const total = assignments.reduce((sum, a) => sum + (a.response_latency_seconds ?? 0), 0);
  return Math.round(total / assignments.length);
}

// ── Over-fulfillment Prevention ────────────────────────────────────

export function canAcceptMoreDonors(requestId: string): boolean {
  const progress = getFulfillmentProgress(requestId);
  return progress.remaining > 0;
}

// ── Clear ──────────────────────────────────────────────────────────

export function clearAllAssignments(): void {
  localStorage.removeItem(LINKING_KEY);
}
