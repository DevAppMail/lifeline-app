// ── Escalation System ──────────────────────────────────────────────
// Sprint 2 — escalation groundwork.
// Stage tracking, radius expansion history, manual escalation triggers.
// DO NOT build autonomous escalation AI yet.

import {
  type EscalationStage,
  type EscalationEvent,
  type EscalationState,
  type RegionType,
  type RequestTier,
  ESCALATION_STAGE_LABELS,
  ESCALATION_RADIUS_PRESETS,
  REGION_RADIUS_DEFAULTS,
} from "@/types/fulfillment";
import { expandRadius, incrementWave, getRequest, transitionRequestStatus } from "@/lib/request-store";
import { writeAuditEntry, logEscalationTriggered, logError } from "@/lib/audit-log";
import type { RequestLifecycleStatus } from "@/types/fulfillment";

const ESCALATION_KEY = "lifeline_escalation_state";

// ── Stage Ordering ─────────────────────────────────────────────────

const STAGE_ORDER: EscalationStage[] = ["wave_1", "wave_2", "wave_3", "fallback"];

function nextStage(current: EscalationStage): EscalationStage | null {
  const idx = STAGE_ORDER.indexOf(current);
  if (idx === -1 || idx >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

// ── State Management ───────────────────────────────────────────────

function readEscalationState(): Record<string, EscalationState> {
  try {
    return JSON.parse(localStorage.getItem(ESCALATION_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeEscalationState(state: Record<string, EscalationState>): void {
  localStorage.setItem(ESCALATION_KEY, JSON.stringify(state));
}

function getRequestEscalation(requestId: string): EscalationState | undefined {
  return readEscalationState()[requestId];
}

function setRequestEscalation(requestId: string, state: EscalationState): void {
  const all = readEscalationState();
  all[requestId] = state;
  writeEscalationState(all);
}

// ── Init ───────────────────────────────────────────────────────────

export function initEscalation(requestId: string): EscalationState {
  const state: EscalationState = {
    current_stage: "wave_1",
    events: [],
    started_at: new Date().toISOString(),
    is_active: true,
  };
  setRequestEscalation(requestId, state);
  return state;
}

// ── Manual Escalation Trigger ──────────────────────────────────────

export function triggerEscalation(
  requestId: string,
  regionType: RegionType = "urban",
  triggeredBy: "system" | "requester" | "admin" = "requester",
): { success: boolean; state?: EscalationState; reason?: string } {
  const escalation = getRequestEscalation(requestId);
  if (!escalation) {
    return { success: false, reason: "No escalation state found. Call initEscalation first." };
  }

  if (!escalation.is_active) {
    return { success: false, reason: "Escalation is no longer active (cancelled or fulfilled)." };
  }

  const next = nextStage(escalation.current_stage);
  if (!next) {
    return { success: false, reason: "Already at maximum escalation stage." };
  }

  const radiusPresets = REGION_RADIUS_DEFAULTS[regionType];
  const newRadius = radiusPresets[next];

  // Record the event
  const event: EscalationEvent = {
    stage: next,
    wave_number: STAGE_ORDER.indexOf(next) + 1,
    radius_km: newRadius,
    triggered_at: new Date().toISOString(),
    triggered_by: triggeredBy === "system" ? "system" : triggeredBy === "requester" ? "requester" : "admin",
    donor_count_contacted: 0,
  };

  escalation.current_stage = next;
  escalation.events.push(event);
  escalation.last_escalated_at = event.triggered_at;
  setRequestEscalation(requestId, escalation);

  // Apply to request store
  const req = getRequest(requestId);
  if (req && req.status !== "fulfilled" && req.status !== "cancelled") {
    expandRadius(requestId, newRadius);
    incrementWave(requestId);
  }

  // Audit log
  logEscalationTriggered(requestId, next, event.wave_number, newRadius);

  return { success: true, state: escalation };
}

// ── Check if escalation needed ─────────────────────────────────────

export function shouldEscalate(
  requestId: string,
  regionType: RegionType = "urban",
): { needsEscalation: boolean; suggestedAction?: string } {
  const escalation = getRequestEscalation(requestId);
  if (!escalation || !escalation.is_active) {
    return { needsEscalation: false };
  }

  if (escalation.current_stage === "fallback") {
    return { needsEscalation: false, suggestedAction: "Admin intervention needed." };
  }

  const now = Date.now();
  const lastEventTime = escalation.last_escalated_at
    ? new Date(escalation.last_escalated_at).getTime()
    : new Date(escalation.started_at).getTime();

  const minutesSinceLast = (now - lastEventTime) / (1000 * 60);

  // Suggest escalation based on tier
  const req = getRequest(requestId);
  if (!req) return { needsEscalation: false };

  const timeThresholds: Record<string, number> = {
    emergency: 30,
    urgent: 120,
    scheduled: 360,
  };

  const threshold = timeThresholds[req.tier] ?? 120;
  if (minutesSinceLast >= threshold) {
    return {
      needsEscalation: true,
      suggestedAction: `No progress in ${Math.round(minutesSinceLast)}m. Consider escalating to ${nextStage(escalation.current_stage)}.`,
    };
  }

  return { needsEscalation: false };
}

// ── Cancel Escalation ──────────────────────────────────────────────

export function cancelEscalation(requestId: string, reason?: string): boolean {
  const escalation = getRequestEscalation(requestId);
  if (!escalation) return false;

  escalation.is_active = false;
  escalation.cancelled_at = new Date().toISOString();
  setRequestEscalation(requestId, escalation);

  writeAuditEntry({
    action: "escalation.cancelled",
    actor_type: "system",
    request_id: requestId,
    details: reason ?? "Escalation cancelled",
    severity: "info",
  });

  return true;
}

// ── Status Helpers ─────────────────────────────────────────────────

export function getEscalationStageLabel(stage: EscalationStage): string {
  return ESCALATION_STAGE_LABELS[stage];
}

export function getCurrentStage(requestId: string): EscalationStage | null {
  const escalation = getRequestEscalation(requestId);
  return escalation?.current_stage ?? null;
}

export function isEscalationActive(requestId: string): boolean {
  const escalation = getRequestEscalation(requestId);
  return escalation?.is_active ?? false;
}

export function getEscalationEvents(requestId: string): EscalationEvent[] {
  const escalation = getRequestEscalation(requestId);
  return escalation?.events ?? [];
}

// ── Fulfillment Stop Conditions ────────────────────────────────────

export function shouldStopEscalation(requestId: string): { stop: boolean; reason?: string } {
  const req = getRequest(requestId);
  if (!req) return { stop: true, reason: "Request not found" };

  if (req.status === "fulfilled") return { stop: true, reason: "Fulfilled" };
  if (req.status === "cancelled") return { stop: true, reason: "Cancelled" };
  if (req.status === "expired") return { stop: true, reason: "Expired" };
  if (req.status === "failed") return { stop: true, reason: "Failed" };

  if (req.units_fulfilled >= req.units_needed) return { stop: true, reason: "All units fulfilled" };

  return { stop: false };
}

// ── Radius Suggestions ─────────────────────────────────────────────

export function getSuggestedRadius(
  currentRadius: number,
  stage: EscalationStage,
  region: RegionType,
): { suggested: number; nextStage: EscalationStage | null } {
  const presets = REGION_RADIUS_DEFAULTS[region];
  const suggested = presets[stage];

  if (suggested <= currentRadius) {
    const next = nextStage(stage);
    if (next) {
      return { suggested: presets[next], nextStage: next };
    }
    return { suggested: currentRadius + 10, nextStage: null };
  }

  return { suggested, nextStage: stage };
}

// ── Reset ──────────────────────────────────────────────────────────

export function resetEscalation(requestId: string): void {
  const all = readEscalationState();
  delete all[requestId];
  writeEscalationState(all);
}
