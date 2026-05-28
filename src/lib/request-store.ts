// ── Blood Request State Store ───────────────────────────────────────
// Central state management for blood requests.
// Sprint 1: localStorage-first with API sync for offline resilience.
// Sprint 2: audit logging, escalation init, verification, multi-donor

import {
  type BloodRequestFull,
  type BloodRequestCreate,
  type RequestLifecycleStatus,
  type StatusHistoryEntry,
  type DonorResponse,
  type DonorResponseState,
  type VerificationStatus,
  canTransition,
} from "@/types/fulfillment";
import { generateLifelineId } from "@/lib/lifeline-id";
import { writeAuditEntry, logRequestCreated, logStatusChanged, logDonorResponded, logError } from "@/lib/audit-log";

const STORE_KEY = "lifeline_blood_requests";

function readStore(): BloodRequestFull[] {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeStore(requests: BloodRequestFull[]): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(requests));
}

// ── Create ──────────────────────────────────────────────────────────

export async function createRequest(data: BloodRequestCreate, requesterPhone: string, requesterName?: string): Promise<BloodRequestFull> {
  const requests = readStore();
  const now = new Date().toISOString();

  const bloodGroup = data.blood_group || "O+";
  const tier = data.tier;

  let deadline: string;
  if (tier === "emergency") {
    deadline = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
  } else if (data.required_date) {
    const d = new Date(data.required_date);
    if (data.required_time) {
      const [h, m] = data.required_time.split(":").map(Number);
      d.setHours(h, m);
    } else {
      d.setHours(18, 0);
    }
    deadline = d.toISOString();
  } else {
    deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }

  const id = generateLifelineId();

  const request: BloodRequestFull = {
    id,
    lifeline_id: generateLifelineId(),

    patient_name: data.patient_name,
    patient_age: data.patient_age,
    relationship: data.relationship,
    blood_group: bloodGroup,
    units_needed: data.units_needed,
    units_fulfilled: 0,
    fresh_blood_required: data.fresh_blood_required ?? false,
    rare_blood_flag: bloodGroup ? ["A-", "B-", "AB+", "AB-", "O-"].includes(bloodGroup) : false,

    hospital_name: data.hospital_name,
    hospital_city: data.hospital_city,

    tier,
    required_date: data.required_date,
    required_time: data.required_time,
    fulfillment_deadline: deadline,

    status: "active",
    current_radius_km: data.tier === "emergency" ? 10 : 5,
    current_wave: 0,

    doctor_note_uploaded: data.doctor_note_uploaded,
    selfie_captured: data.selfie_captured,
    consent_timestamp: data.consent_timestamp,

    requester_phone: requesterPhone,
    requester_name: requesterName,

    donors_contacted: 0,
    donors_committed: 0,
    donor_responses: [],

    created_at: now,
    updated_at: now,

    status_history: [{
      from: "draft" as RequestLifecycleStatus,
      to: "active" as RequestLifecycleStatus,
      timestamp: now,
      triggered_by: "system",
      notes: "Request created and activated",
    }],
  };

  const updated = [request, ...requests];
  writeStore(updated);

  // Sprint 2: audit log
  try { logRequestCreated(id, requesterPhone, `Tier: ${tier}, Units: ${data.units_needed}`); } catch { /* silent */ }

  // Sprint 2: init escalation tracking (lazy import to avoid circular dep)
  try { const { initEscalation } = await import("@/lib/escalation"); initEscalation(id); } catch { /* silent */ }

  // Legacy API sync
  syncRequestToApi(request);

  return request;
}

// ── Read ────────────────────────────────────────────────────────────

export function getRequest(id: string): BloodRequestFull | undefined {
  return readStore().find((r) => r.id === id || r.lifeline_id === id);
}

export function getRequestsByRequester(phone: string): BloodRequestFull[] {
  return readStore().filter((r) => r.requester_phone === phone);
}

export function getAllActiveRequests(): BloodRequestFull[] {
  return readStore().filter((r) =>
    ["active", "searching", "partially_fulfilled"].includes(r.status)
  );
}

export function getAllRequests(): BloodRequestFull[] {
  return readStore();
}

// ── Update Lifecycle Status ─────────────────────────────────────────

export function transitionRequestStatus(
  id: string,
  newStatus: RequestLifecycleStatus,
  triggeredBy?: string,
  notes?: string
): BloodRequestFull | null {
  const requests = readStore();
  const idx = requests.findIndex((r) => r.id === id || r.lifeline_id === id);
  if (idx === -1) return null;

  const req = requests[idx];
  if (!canTransition(req.status, newStatus)) {
    console.warn(`Invalid transition: ${req.status} → ${newStatus}`);
    return null;
  }

  const now = new Date().toISOString();
  const previousStatus = req.status;

  const entry: StatusHistoryEntry = {
    from: previousStatus,
    to: newStatus,
    timestamp: now,
    triggered_by: triggeredBy,
    notes,
  };

  const updated: BloodRequestFull = {
    ...req,
    status: newStatus,
    updated_at: now,
    status_history: [...req.status_history, entry],
  };

  if (newStatus === "fulfilled") updated.fulfilled_at = now;
  if (newStatus === "cancelled") {
    updated.cancelled_at = now;
    updated.cancelled_reason = notes;
  }

  requests[idx] = updated;
  writeStore(requests);

  // Sprint 2: audit log
  try {
    logStatusChanged(id, previousStatus, newStatus, "system", triggeredBy);
  } catch { /* silent */ }

  syncStatusToApi(updated, newStatus);

  return updated;
}

// ── Donor Response Tracking ─────────────────────────────────────────

export function recordDonorResponse(
  requestId: string,
  donorId: string,
  state: DonorResponseState,
  extra?: Partial<DonorResponse>
): BloodRequestFull | null {
  const requests = readStore();
  const idx = requests.findIndex((r) => r.id === requestId || r.lifeline_id === requestId);
  if (idx === -1) return null;

  const req = requests[idx];
  const existing = req.donor_responses.findIndex((r) => r.donor_id === donorId);
  const now = new Date().toISOString();

  // Sprint 2: over-fulfillment prevention
  if (state === "confirmed" && req.units_fulfilled >= req.units_needed) {
    console.warn(`Over-fulfillment prevented: ${requestId} already fulfilled (${req.units_fulfilled}/${req.units_needed})`);
    return req;
  }

  const response: DonorResponse = {
    request_id: requestId,
    donor_id: donorId,
    state,
    ...(state === "notified" ? { notified_at: now } : {}),
    ...(state === "accepted" || state === "declined" ? { responded_at: now } : {}),
    ...(state === "committed" ? { committed_at: now } : {}),
    ...(state === "checked_in" ? { checked_in_at: now } : {}),
    ...(state === "donated" ? { donated_at: now } : {}),
    ...(state === "confirmed" ? { confirmed_at: now } : {}),
    ...(state === "cancelled" ? { cancelled_at: now } : {}),
    ...extra,
  };

  if (existing >= 0) {
    req.donor_responses[existing] = { ...req.donor_responses[existing], ...response };
  } else {
    req.donor_responses.push(response);
  }

  req.donors_contacted = req.donor_responses.filter((r) => r.notified_at).length;
  req.donors_committed = req.donor_responses.filter((r) => r.state === "committed" || r.state === "confirmed").length;
  req.units_fulfilled = req.donor_responses.filter((r) => r.state === "confirmed").length;

  // Auto-transition based on fulfillment
  const prevStatus = req.status;
  if (req.units_fulfilled >= req.units_needed && req.status !== "fulfilled") {
    const historyEntry: StatusHistoryEntry = {
      from: req.status,
      to: "fulfilled",
      timestamp: now,
      triggered_by: "system",
      notes: "All units fulfilled through donor confirmations",
    };
    req.status = "fulfilled";
    req.fulfilled_at = now;
    req.status_history.push(historyEntry);
  } else if (req.units_fulfilled > 0 && req.units_fulfilled < req.units_needed) {
    if (req.status !== "partially_fulfilled") {
      const historyEntry: StatusHistoryEntry = {
        from: req.status,
        to: "partially_fulfilled",
        timestamp: now,
        triggered_by: "system",
        notes: `${req.units_fulfilled} of ${req.units_needed} units fulfilled`,
      };
      req.status = "partially_fulfilled";
      req.status_history.push(historyEntry);
    }
  }

  req.updated_at = now;
  requests[idx] = req;
  writeStore(requests);

  // Sprint 2: audit donor response + status transitions
  try { logDonorResponded(requestId, donorId, state); } catch { /* silent */ }
  if (prevStatus !== req.status) {
    try { logStatusChanged(requestId, prevStatus, req.status, "system", `auto: donor ${state}`); } catch { /* silent */ }
  }

  return req;
}

// ── Admin / Expansion ───────────────────────────────────────────────

export function expandRadius(id: string, newRadiusKm: number): BloodRequestFull | null {
  const requests = readStore();
  const idx = requests.findIndex((r) => r.id === id || r.lifeline_id === id);
  if (idx === -1) return null;

  requests[idx].current_radius_km = newRadiusKm;
  requests[idx].updated_at = new Date().toISOString();
  writeStore(requests);

  // Sprint 2: audit
  try {
    writeAuditEntry({
      action: "radius.expanded",
      actor_type: "system",
      request_id: id,
      details: `Radius expanded to ${newRadiusKm}km`,
      new_state: String(newRadiusKm),
      severity: "info",
      radius_km: newRadiusKm,
    });
  } catch { /* silent */ }

  return requests[idx];
}

export function incrementWave(id: string): BloodRequestFull | null {
  const requests = readStore();
  const idx = requests.findIndex((r) => r.id === id || r.lifeline_id === id);
  if (idx === -1) return null;

  requests[idx].current_wave += 1;
  requests[idx].updated_at = new Date().toISOString();
  writeStore(requests);
  return requests[idx];
}

// ── Verification ────────────────────────────────────────────────────

export function setVerificationStatus(
  requestId: string,
  status: VerificationStatus,
  notes?: string,
): boolean {
  const req = getRequest(requestId);
  if (!req) return false;

  const requests = readStore();
  const idx = requests.findIndex((r) => r.id === requestId || r.lifeline_id === requestId);
  if (idx === -1) return false;

  const now = new Date().toISOString();
  const action = status === "flagged" ? "request.flagged" as const : "request.verified" as const;

  requests[idx] = {
    ...requests[idx],
    updated_at: now,
    // Store verification status as notes in audit rather than new field
    status_history: [
      ...requests[idx].status_history,
      {
        from: requests[idx].status,
        to: requests[idx].status,
        timestamp: now,
        triggered_by: "system",
        notes: `Verification: ${status}${notes ? ` — ${notes}` : ""}`,
      },
    ],
  };

  writeStore(requests);

  try {
    writeAuditEntry({
      action,
      actor_type: "system",
      request_id: requestId,
      new_state: status,
      details: notes,
      severity: status === "flagged" ? "warning" : "info",
    });
  } catch { /* silent */ }

  return true;
}

// ── API Sync (legacy) ───────────────────────────────────────────────

async function syncRequestToApi(req: BloodRequestFull): Promise<void> {
  try {
    await fetch("/api/blood-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lifeline_id: req.lifeline_id,
        patient_name: req.patient_name,
        blood_group: req.blood_group,
        units_needed: req.units_needed,
        hospital_name: req.hospital_name,
        hospital_location: req.hospital_city,
        request_tier: req.tier === "scheduled" ? "normal" : req.tier === "urgent" ? "urgent" : "critical",
        status: req.status,
        relationship: req.relationship,
        required_date: req.required_date || null,
        required_time: req.required_time || null,
        requester_name: req.requester_name ?? null,
        consent_accepted_at: req.consent_timestamp,
      }),
    });
  } catch {
    // Silent
  }
}

async function syncStatusToApi(req: BloodRequestFull, status: RequestLifecycleStatus): Promise<void> {
  try {
    await fetch(`/api/blood-requests/${req.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  } catch {
    // Silent
  }
}

// ── Audit ──────────────────────────────────────────────────────────

export function getRequestStatusHistory(id: string): StatusHistoryEntry[] {
  const req = getRequest(id);
  return req?.status_history ?? [];
}

// ── Auto-expiry Check ──────────────────────────────────────────────

export function checkAutoExpiry(): void {
  const requests = readStore();
  const now = Date.now();
  let changed = false;

  for (let i = 0; i < requests.length; i++) {
    const req = requests[i];
    if (!["active", "searching", "partially_fulfilled"].includes(req.status)) continue;
    if (!req.fulfillment_deadline) continue;

    const deadline = new Date(req.fulfillment_deadline).getTime();
    if (now > deadline + 2 * 60 * 60 * 1000) {
      const newStatus: RequestLifecycleStatus = "expired";
      requests[i].status = newStatus;
      requests[i].updated_at = new Date().toISOString();
      requests[i].status_history.push({
        from: req.status,
        to: newStatus,
        timestamp: new Date().toISOString(),
        triggered_by: "system",
        notes: "Auto-expired after deadline + grace period",
      });
      changed = true;

      try {
        logStatusChanged(req.id, req.status, newStatus, "system", "auto-expiry");
      } catch { /* silent */ }
    }
  }

  if (changed) writeStore(requests);
}

// ── Cancel ─────────────────────────────────────────────────────────

export function cancelRequest(id: string, reason?: string): BloodRequestFull | null {
  return transitionRequestStatus(id, "cancelled", "requester", reason);
}

export function cancelRequestById(id: string): BloodRequestFull | null {
  return cancelRequest(id);
}

export { generateLifelineId as genRequestId } from "@/lib/lifeline-id";
