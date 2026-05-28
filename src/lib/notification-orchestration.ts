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

// ═════════════════════════════════════════════════════════════════════
// Firebase FCM Preparation (Phase 2 — Do NOT fully implement yet)
// ═════════════════════════════════════════════════════════════════════

// ── Service Worker Registration ─────────────────────────────────────

export interface FcmPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  tag?: string;
  requireInteraction?: boolean;
}

export interface FcmTokenRecord {
  token: string;
  platform: "web" | "android" | "ios";
  registered_at: string;
  last_used: string;
  enabled: boolean;
}

const FCM_TOKEN_KEY = "lifeline_fcm_tokens";

export function registerFcmToken(token: string, platform: FcmTokenRecord["platform"]): FcmTokenRecord {
  const tokens = getFcmTokens();
  const existing = tokens.findIndex((t) => t.token === token);
  const record: FcmTokenRecord = {
    token,
    platform,
    registered_at: existing >= 0 ? tokens[existing].registered_at : new Date().toISOString(),
    last_used: new Date().toISOString(),
    enabled: true,
  };
  if (existing >= 0) tokens[existing] = record;
  else tokens.push(record);
  localStorage.setItem(FCM_TOKEN_KEY, JSON.stringify(tokens));
  return record;
}

export function getFcmTokens(): FcmTokenRecord[] {
  try {
    return JSON.parse(localStorage.getItem(FCM_TOKEN_KEY) ?? "[]");
  } catch { return []; }
}

export function disableFcmToken(token: string): void {
  const tokens = getFcmTokens().map((t) =>
    t.token === token ? { ...t, enabled: false } : t,
  );
  localStorage.setItem(FCM_TOKEN_KEY, JSON.stringify(tokens));
}

// ── Push Notification Channel Assignment ────────────────────────────

export function getDeliveryChannels(userPreference: {
  sms: boolean;
  push: boolean;
  email: boolean;
}): NotificationChannel[] {
  const channels: NotificationChannel[] = ["in_app"];
  if (userPreference.push) channels.push("in_app");
  if (userPreference.sms) channels.push("sms");
  if (userPreference.email) channels.push("email");
  return channels;
}

// ═════════════════════════════════════════════════════════════════════
// SMS Escalation Plumbing (Phase 2 — Do NOT fully implement yet)
// ═════════════════════════════════════════════════════════════════════

// MSG91 integration points:
//   POST https://api.msg91.com/api/v5/send
//   Headers: { authkey: MSG91_AUTH_KEY }
//   Body: {
//     template_id: VITE_MSG91_TEMPLATE_ID,
//     mobiles: "919XXXXXXXXX",
//     var1: "Donor Name",
//     var2: "Patient Name",
//     var3: "Hospital Name",
//   }

export interface SmsPayload {
  phone: string;
  templateId: string;
  variables: Record<string, string>;
  priority: "normal" | "high";
}

export function buildSmsPayload(
  phone: string,
  templateId: string,
  donorName?: string,
  patientName?: string,
  hospitalName?: string,
  requestId?: string,
): SmsPayload {
  return {
    phone,
    templateId,
    variables: {
      var1: donorName ?? "Donor",
      var2: patientName ?? "Patient",
      var3: hospitalName ?? "Hospital",
    },
    priority: "high",
  };
}

// ═════════════════════════════════════════════════════════════════════
// Notification Scheduling (Phase 2)
// ═════════════════════════════════════════════════════════════════════

export interface ScheduledNotification {
  id: string;
  event_type: NotificationEventType;
  channel: NotificationChannel;
  body: string;
  scheduled_for: string;
  status: "pending" | "sent" | "cancelled";
  donor_id?: string;
  request_id: string;
  created_at: string;
}

const SCHEDULED_KEY = "lifeline_scheduled_notifications";

export function scheduleNotification(params: {
  event_type: NotificationEventType;
  channel: NotificationChannel;
  body: string;
  scheduled_for: string;
  request_id: string;
  donor_id?: string;
}): ScheduledNotification {
  const scheduled = readScheduled();
  const entry: ScheduledNotification = {
    id: `sch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ...params,
    status: "pending",
    created_at: new Date().toISOString(),
  };
  scheduled.push(entry);
  localStorage.setItem(SCHEDULED_KEY, JSON.stringify(scheduled));
  return entry;
}

export function readScheduled(): ScheduledNotification[] {
  try {
    return JSON.parse(localStorage.getItem(SCHEDULED_KEY) ?? "[]");
  } catch { return []; }
}

export function getDueNotifications(): ScheduledNotification[] {
  return readScheduled().filter((n) => {
    if (n.status !== "pending") return false;
    return new Date(n.scheduled_for) <= new Date();
  });
}

export function cancelScheduled(id: string): void {
  const all = readScheduled().map((n) =>
    n.id === id ? { ...n, status: "cancelled" as const } : n,
  );
  localStorage.setItem(SCHEDULED_KEY, JSON.stringify(all));
}

// ═════════════════════════════════════════════════════════════════════
// Enhanced Retry Handling
// ═════════════════════════════════════════════════════════════════════

export function getRetryDelay(retryCount: number): number {
  const delays = [0, 60_000, 300_000, 900_000]; // 0s, 1m, 5m, 15m
  return delays[Math.min(retryCount, delays.length - 1)];
}

export function getChannelFallback(channel: NotificationChannel): NotificationChannel | null {
  const fallbacks: Record<NotificationChannel, NotificationChannel | null> = {
    in_app: "sms",
    sms: "whatsapp",
    whatsapp: "email",
    email: null,
  };
  return fallbacks[channel] ?? null;
}

export function shouldEscalateToSms(event: NotificationEvent): boolean {
  if (event.event_type === "donor_no_show") return true;
  if (event.event_type === "escalation_triggered") return true;
  if (event.event_type === "request_cancelled") return false;
  return event.priority === "critical" || event.priority === "high";
}

// ═════════════════════════════════════════════════════════════════════
// Extended Quiet Hours — Per-User Config
// ═════════════════════════════════════════════════════════════════════

export interface QuietHoursConfig {
  start: number; // 0–23
  end: number;   // 0–23
  enabled: boolean;
  override_for_critical: boolean;
}

const QUIET_HOURS_CONFIG_KEY = "lifeline_quiet_hours";

export function getQuietHoursConfig(): QuietHoursConfig {
  try {
    const stored = localStorage.getItem(QUIET_HOURS_CONFIG_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* use defaults */ }
  return { start: 21, end: 7, enabled: true, override_for_critical: true };
}

export function setQuietHoursConfig(config: Partial<QuietHoursConfig>): QuietHoursConfig {
  const current = getQuietHoursConfig();
  const updated = { ...current, ...config };
  localStorage.setItem(QUIET_HOURS_CONFIG_KEY, JSON.stringify(updated));
  return updated;
}

export function shouldSendNowExtended(
  priority: "low" | "normal" | "high" | "critical",
  config?: QuietHoursConfig,
): boolean {
  const cfg = config ?? getQuietHoursConfig();
  if (!cfg.enabled) return true;
  if (priority === "critical" && cfg.override_for_critical) return true;
  const hour = new Date().getHours();
  const isQuiet = hour >= cfg.start || hour < cfg.end;
  if (!isQuiet) return true;
  if (priority === "high") return false;
  if (priority === "normal" || priority === "low") return false;
  return true;
}
