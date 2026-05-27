// ── Fulfillment Audit Log ─────────────────────────────────────────
// Append-only operational audit log.
// Sprint 2 — persistence + operational auditability
// Every fulfillment action is logged with timestamp, actor, and context.

import {
  type AuditAction,
  type AuditEntry,
  type EscalationStage,
} from "@/types/fulfillment";
import { supabase } from "@/lib/supabase";

const LOCAL_KEY = "lifeline_fulfillment_audit";

// ── Local Read ─────────────────────────────────────────────────────

function readLocalLog(): AuditEntry[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeLocalLog(entries: AuditEntry[]): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(entries));
}

// ── Write (append-only) ────────────────────────────────────────────

let idCounter = 0;

function generateEntryId(): string {
  idCounter += 1;
  return `aud_${Date.now()}_${idCounter}_${Math.random().toString(36).slice(2, 6)}`;
}

export function writeAuditEntry(entry: Omit<AuditEntry, "id" | "timestamp">): AuditEntry {
  const full: AuditEntry = {
    ...entry,
    id: generateEntryId(),
    timestamp: new Date().toISOString(),
  };

  const log = readLocalLog();
  log.push(full);
  writeLocalLog(log);

  // Fire-and-forget sync to Supabase
  syncEntryToSupabase(full);

  return full;
}

// ── Batch Write ────────────────────────────────────────────────────

export function writeAuditEntries(
  entries: Omit<AuditEntry, "id" | "timestamp">[]
): AuditEntry[] {
  const now = new Date().toISOString();
  const full: AuditEntry[] = entries.map((e) => ({
    ...e,
    id: generateEntryId(),
    timestamp: now,
  }));

  const log = readLocalLog();
  log.push(...full);
  writeLocalLog(log);

  for (const entry of full) {
    syncEntryToSupabase(entry);
  }

  return full;
}

// ── Read ───────────────────────────────────────────────────────────

export function getAuditLog(): AuditEntry[] {
  return readLocalLog().reverse();
}

export function getAuditEntriesByRequest(requestId: string): AuditEntry[] {
  return readLocalLog()
    .filter((e) => e.request_id === requestId)
    .reverse();
}

export function getAuditEntriesByDonor(donorId: string): AuditEntry[] {
  return readLocalLog()
    .filter((e) => e.donor_id === donorId)
    .reverse();
}

export function getAuditEntriesByAction(action: AuditAction): AuditEntry[] {
  return readLocalLog()
    .filter((e) => e.action === action)
    .reverse();
}

export function getRecentAuditEntries(minutes: number = 60): AuditEntry[] {
  const cutoff = Date.now() - minutes * 60 * 1000;
  return readLocalLog()
    .filter((e) => new Date(e.timestamp).getTime() > cutoff)
    .reverse();
}

// ── Supabase Sync ──────────────────────────────────────────────────

async function syncEntryToSupabase(entry: AuditEntry): Promise<void> {
  try {
    const { error } = await supabase.from("fulfillment_audit_log").insert({
      id: entry.id,
      timestamp: entry.timestamp,
      action: entry.action,
      actor_type: entry.actor_type,
      actor_id: entry.actor_id,
      request_id: entry.request_id,
      donor_id: entry.donor_id,
      previous_state: entry.previous_state,
      new_state: entry.new_state,
      details: entry.details,
      severity: entry.severity,
      escalation_stage: entry.escalation_stage,
      wave_number: entry.wave_number,
      radius_km: entry.radius_km,
      correlation_id: entry.correlation_id,
    });
    if (error) {
      console.warn("Audit sync failed:", error.message);
    }
  } catch {
    // Silent — local is source of truth
  }
}

// ── Convenience Wrappers ───────────────────────────────────────────

export function logRequestCreated(requestId: string, requesterId: string, details?: string): AuditEntry {
  return writeAuditEntry({
    action: "request.created",
    actor_type: "requester",
    actor_id: requesterId,
    request_id: requestId,
    details,
    severity: "info",
  });
}

export function logStatusChanged(
  requestId: string,
  from: string,
  to: string,
  actorType: "system" | "requester" | "donor" | "admin",
  actorId?: string,
): AuditEntry {
  return writeAuditEntry({
    action: "request.status_changed",
    actor_type: actorType,
    actor_id: actorId,
    request_id: requestId,
    previous_state: from,
    new_state: to,
    severity: "info",
  });
}

export function logDonorNotified(requestId: string, donorId: string, wave?: number): AuditEntry {
  return writeAuditEntry({
    action: "donor.notified",
    actor_type: "system",
    request_id: requestId,
    donor_id: donorId,
    wave_number: wave,
    severity: "info",
  });
}

export function logDonorResponded(requestId: string, donorId: string, state: string): AuditEntry {
  return writeAuditEntry({
    action: "donor.responded",
    actor_type: "donor",
    actor_id: donorId,
    request_id: requestId,
    donor_id: donorId,
    new_state: state,
    severity: "info",
  });
}

export function logEscalationTriggered(
  requestId: string,
  stage: EscalationStage,
  wave: number,
  radius: number,
  details?: string,
): AuditEntry {
  return writeAuditEntry({
    action: "escalation.triggered",
    actor_type: "system",
    request_id: requestId,
    escalation_stage: stage,
    wave_number: wave,
    radius_km: radius,
    details,
    severity: "info",
  });
}

export function logError(requestId: string, error: string, severity: "warning" | "error" | "critical" = "error"): AuditEntry {
  return writeAuditEntry({
    action: "system.error",
    actor_type: "system",
    request_id: requestId,
    details: error,
    severity,
  });
}

// ── Clear ──────────────────────────────────────────────────────────

export function clearAuditLog(): void {
  localStorage.removeItem(LOCAL_KEY);
}
