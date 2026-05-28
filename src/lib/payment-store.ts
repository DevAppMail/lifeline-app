import type { PaymentRecord, PaymentEntity, PaymentStatus } from "@/types/payment";
import { canPaymentTransition } from "@/types/payment";

const STORAGE_KEY = "lifeline_payment_records";

function read(): PaymentRecord[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function write(records: PaymentRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

// ── Idempotency ──────────────────────────────────────────────────────

export function generateIdempotencyKey(entityType: PaymentEntity, entityId: string): string {
  return `ik_${entityType}_${entityId}_${Date.now().toString(36)}`;
}

export function getExistingPayment(entityType: PaymentEntity, entityId: string): PaymentRecord | undefined {
  return read().find(
    (p) => p.entity_type === entityType && p.entity_id === entityId,
  );
}

export function hasActivePayment(entityType: PaymentEntity, entityId: string): boolean {
  const existing = getExistingPayment(entityType, entityId);
  if (!existing) return false;
  return ["pending", "processing"].includes(existing.status);
}

export function hasCompletedPayment(entityType: PaymentEntity, entityId: string): boolean {
  const existing = getExistingPayment(entityType, entityId);
  if (!existing) return false;
  return existing.status === "completed";
}

// ── CRUD ─────────────────────────────────────────────────────────────

export function createPayment(record: PaymentRecord): PaymentRecord {
  const records = read();
  const existing = records.find(
    (p) => p.entity_type === record.entity_type && p.entity_id === record.entity_id,
  );
  if (existing && ["pending", "processing", "completed"].includes(existing.status)) {
    return existing;
  }
  records.push(record);
  write(records);
  return record;
}

export function updatePaymentStatus(
  entityType: PaymentEntity,
  entityId: string,
  status: PaymentStatus,
  updates: Partial<PaymentRecord> = {},
): PaymentRecord | null {
  const records = read();
  const idx = records.findIndex(
    (p) => p.entity_type === entityType && p.entity_id === entityId,
  );
  if (idx === -1) return null;

  const current = records[idx];
  if (!canPaymentTransition(current.status, status)) {
    console.warn(`[Payment] Invalid transition: ${current.status} → ${status}`);
    return null;
  }

  records[idx] = {
    ...current,
    ...updates,
    status,
    updated_at: new Date().toISOString(),
    completed_at: status === "completed" ? new Date().toISOString() : current.completed_at,
  };
  write(records);
  return records[idx];
}

export function getPaymentForEntity(entityType: PaymentEntity, entityId: string): PaymentRecord | undefined {
  return getExistingPayment(entityType, entityId);
}

export function getAllPayments(): PaymentRecord[] {
  return read();
}

// ── Razorpay Order Creation Prep ────────────────────────────────────
// Backend route (not implemented here):
//   POST /api/payments/create-order
//   Body: { entity_type, entity_id, amount, lifeline_id }
//   Response: { order_id, amount, currency }
//
// The BFF should create a Razorpay order and store idempotency_key in
// Razorpay order notes for webhook deduplication.

export function buildOrderNotes(
  entityType: PaymentEntity,
  entityId: string,
  lifelineId: string,
  tier?: string,
): Record<string, string> {
  const notes: Record<string, string> = {
    entity_type: entityType,
    entity_id: entityId,
    lifeline_id: lifelineId,
  };
  if (tier) notes.tier = tier;
  return notes;
}

// ── Refund Groundwork ────────────────────────────────────────────────
// Refund eligibility is determined by fulfillment-progression.ts.
// When refund is approved:
// 1. BFF calls Razorpay API: POST /payments/{payment_id}/refund
// 2. Store refund_id and update status to "refunded"
// 3. Webhook confirms refund completion

export function recordRefund(
  entityType: PaymentEntity,
  entityId: string,
  refundId: string,
  refundAmount: number,
  reason: string,
): PaymentRecord | null {
  return updatePaymentStatus(entityType, entityId, "refunded", {
    refund_id: refundId,
    refund_amount: refundAmount,
    refund_reason: reason,
    refunded_at: new Date().toISOString(),
  });
}

// ── Webhook Verification Strategy ────────────────────────────────────
// Razorpay webhooks should be verified using:
// 1. Webhook secret (configured in Razorpay dashboard)
// 2. HMAC-SHA256 signature verification
// 3. Idempotency — check payment_record.webhook_received_at before processing
//
// Backend route (not implemented here):
//   POST /api/payments/webhook
//   Headers: { x-razorpay-signature: <hmac> }
//   Body: RazorpayWebhookPayload
//   1. Verify signature using RAZORPAY_WEBHOOK_SECRET
//   2. Extract payment.entity.notes.entity_type + entity_id
//   3. Check idempotency (skip if already processed)
//   4. Update PaymentRecord status
//   5. For blood_request: trigger lifecycle transition based on payment status
//   6. For appointment: trigger booking confirmation
//
// Webhook events to handle:
//   - payment.captured   → status = "completed"
//   - payment.failed     → status = "failed"
//   - refund.created     → status = "refunded"
//
// Signature verification pseudocode:
//   const crypto = require('crypto');
//   const expected = crypto
//     .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
//     .update(JSON.stringify(body))
//     .digest('hex');
//   if (expected !== signature) throw new Error('Invalid webhook signature');

// ── Duplicate Payment Prevention ─────────────────────────────────────
// Strategy:
// 1. Always check hasActivePayment() / hasCompletedPayment() before
//    allowing a new payment attempt for the same entity
// 2. Generate a unique idempotency_key per payment attempt
// 3. Razorpay order creation should pass idempotency_key in notes
// 4. Webhook handler checks for duplicate webhook events using
//    razorpay_payment_id
// 5. On payment failure, allow retry by storing failure_reason but
//    keeping the same PaymentRecord (status: failed → pending)

// ── Failed Payment Handling ──────────────────────────────────────────

export function recordPaymentFailure(
  entityType: PaymentEntity,
  entityId: string,
  errorCode: string,
  errorDescription: string,
): PaymentRecord | null {
  const record = updatePaymentStatus(entityType, entityId, "failed", {
    failure_reason: `${errorCode}: ${errorDescription}`,
  });
  return record;
}

export function retryPayment(entityType: PaymentEntity, entityId: string): PaymentRecord | null {
  const records = read();
  const existing = getExistingPayment(entityType, entityId);
  if (!existing || existing.status !== "failed") return null;
  if (existing.retry_count >= existing.max_retries) return null;

  return updatePaymentStatus(entityType, entityId, "pending", {
    retry_count: existing.retry_count + 1,
    failure_reason: undefined,
  });
}

// ── Where Razorpay Fits In ───────────────────────────────────────────
// Blood Request Flow:
//   1. Requester creates request → tier determines fee (₹99/₹299/₹499)
//   2. Before request goes active → pay coordination fee
//   3. Razorpay Checkout opens → user completes payment
//   4. PaymentRecord status = "completed" → request transitions to "active"
//   5. If no donor within response window → refund eligible
//   6. Refund goes through Razorpay API → status = "refunded"
//
// Appointment Booking Flow:
//   1. User selects provider + time slot
//   2. Consultation fee determined by provider
//   3. Razorpay Checkout opens → user completes payment
//   4. PaymentRecord status = "completed" → appointment confirmed
//   5. Provider marks appointment as completed or cancelled
//   6. If cancelled by provider → refund to patient
