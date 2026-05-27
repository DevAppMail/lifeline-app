// ── Notification Orchestration Foundation ─────────────────────────
// Sprint 2 — notification event model + queue groundwork.
// Do NOT integrate MSG91, push, or WhatsApp yet.
// Build the operational event model so integration points are clean.

import {
  type NotificationEvent,
  type NotificationEventType,
  type NotificationChannel,
  type NotificationDeliveryStatus,
} from "@/types/fulfillment";
import { writeAuditEntry } from "@/lib/audit-log";

const QUEUE_KEY = "lifeline_notification_queue";
const AUDIT_KEY = "lifeline_notification_audit";

// ── Generate ID ────────────────────────────────────────────────────

let idCounter = 0;

function generateId(): string {
  idCounter += 1;
  return `notif_${Date.now()}_${idCounter}`;
}

// ── Local Queue ────────────────────────────────────────────────────

function readQueue(): NotificationEvent[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeQueue(queue: NotificationEvent[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function readAuditTrail(): NotificationEvent[] {
  try {
    return JSON.parse(localStorage.getItem(AUDIT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeAuditTrail(events: NotificationEvent[]): void {
  localStorage.setItem(AUDIT_KEY, JSON.stringify(events));
}

// ── Enqueue ────────────────────────────────────────────────────────

export function enqueueNotification(params: {
  event_type: NotificationEventType;
  request_id: string;
  donor_id?: string;
  requester_phone?: string;
  channel?: NotificationChannel;
  priority?: "low" | "normal" | "high" | "critical";
  body: string;
}): NotificationEvent {
  const event: NotificationEvent = {
    id: generateId(),
    event_type: params.event_type,
    request_id: params.request_id,
    donor_id: params.donor_id,
    requester_phone: params.requester_phone,
    channel: params.channel ?? "in_app",
    priority: params.priority ?? "normal",
    body: params.body,
    status: "queued",
    queued_at: new Date().toISOString(),
    retry_count: 0,
    max_retries: 3,
  };

  const queue = readQueue();
  queue.push(event);
  writeQueue(queue);

  return event;
}

// ── Dequeue (process next) ─────────────────────────────────────────

export function dequeueNext(): NotificationEvent | null {
  const queue = readQueue();
  const idx = queue.findIndex((e) => e.status === "queued");
  if (idx === -1) return null;

  queue[idx].status = "sent";
  queue[idx].sent_at = new Date().toISOString();
  writeQueue(queue);

  // Move to audit trail
  const audit = readAuditTrail();
  audit.push(queue[idx]);
  writeAuditTrail(audit);

  return queue[idx];
}

// ── Mark Delivery Status ───────────────────────────────────────────

export function markDelivered(eventId: string): void {
  const queue = readQueue();
  const idx = queue.findIndex((e) => e.id === eventId);
  if (idx >= 0) {
    queue[idx].status = "delivered";
    queue[idx].delivered_at = new Date().toISOString();
    writeQueue(queue);
  }
}

export function markFailed(eventId: string, reason?: string): void {
  const queue = readQueue();
  const idx = queue.findIndex((e) => e.id === eventId);
  if (idx >= 0) {
    queue[idx].retry_count += 1;
    if (queue[idx].retry_count >= queue[idx].max_retries) {
      queue[idx].status = "failed";
      queue[idx].failed_at = new Date().toISOString();
    } else {
      queue[idx].status = "queued"; // Retry
    }
    queue[idx].failure_reason = reason;
    writeQueue(queue);
  }
}

export function suppressEvent(eventId: string, reason: string): void {
  const queue = readQueue();
  const idx = queue.findIndex((e) => e.id === eventId);
  if (idx >= 0) {
    queue[idx].status = "suppressed";
    queue[idx].suppressed_reason = reason;
    writeQueue(queue);
  }
}

// ── Duplicate Suppression ──────────────────────────────────────────

export function hasPendingEvent(requestId: string, eventType: NotificationEventType): boolean {
  const queue = readQueue();
  return queue.some(
    (e) => e.request_id === requestId && e.event_type === eventType && e.status === "queued"
  );
}

export function getPendingCount(): number {
  return readQueue().filter((e) => e.status === "queued").length;
}

// ── Quiet Hour Handling ────────────────────────────────────────────

const QUIET_HOURS = { start: 21, end: 7 }; // 9 PM – 7 AM

export function isQuietHour(): boolean {
  const hour = new Date().getHours();
  return hour >= QUIET_HOURS.start || hour < QUIET_HOURS.end;
}

export function shouldSendNow(priority: "low" | "normal" | "high" | "critical"): boolean {
  if (priority === "critical") return true;
  if (priority === "high" && isQuietHour()) return false;
  if (priority === "normal" && isQuietHour()) return false;
  if (priority === "low" && isQuietHour()) return false;
  return true;
}

// ── Convenience Enqueuers ──────────────────────────────────────────

export function notifyDonorMatched(requestId: string, donorId: string, body: string): NotificationEvent {
  const event = enqueueNotification({
    event_type: "donor_matched",
    request_id: requestId,
    donor_id: donorId,
    priority: "high",
    body,
  });

  writeAuditEntry({
    action: "donor.notified",
    actor_type: "system",
    request_id: requestId,
    donor_id: donorId,
    new_state: "notified",
    details: `Notification queued: ${event.id}`,
    severity: "info",
  });

  return event;
}

export function notifyEscalation(requestId: string, requesterPhone: string, stage: string): NotificationEvent {
  return enqueueNotification({
    event_type: "escalation_triggered",
    request_id: requestId,
    requester_phone: requesterPhone,
    priority: "high",
    body: `Your blood request has been escalated to ${stage}. More donors are being contacted.`,
  });
}

export function notifyReplacementNeeded(requestId: string, body: string): NotificationEvent {
  return enqueueNotification({
    event_type: "replacement_needed",
    request_id: requestId,
    priority: "high",
    body,
  });
}

// ── Queue Inspection ───────────────────────────────────────────────

export function getPendingNotifications(): NotificationEvent[] {
  return readQueue().filter((e) => e.status === "queued");
}

export function getSentNotifications(): NotificationEvent[] {
  return readQueue().filter((e) => e.status === "sent" || e.status === "delivered");
}

export function getFailedNotifications(): NotificationEvent[] {
  return readQueue().filter((e) => e.status === "failed");
}

export function getNotificationAuditTrail(): NotificationEvent[] {
  return readAuditTrail().reverse();
}

// ── Clear ──────────────────────────────────────────────────────────

export function clearNotificationQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}
