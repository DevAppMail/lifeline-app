export type PaymentService = "razorpay";
export type PaymentEntity = "blood_request" | "appointment";

export type PaymentStatus =
  | "pending"        // Order created, waiting for user to pay
  | "processing"     // User has initiated, verifying with gateway
  | "completed"      // Funds captured successfully
  | "failed"         // Payment declined or errored
  | "refunded"       // Full refund issued
  | "partially_refunded" // Partial refund issued
  | "cancelled"      // Order cancelled before payment
  | "expired";       // Order expired before completion

export const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  pending:             ["processing", "cancelled", "expired"],
  processing:          ["completed", "failed", "cancelled"],
  completed:           ["refunded", "partially_refunded"],
  failed:              ["pending"], // Allow retry
  refunded:            [],
  partially_refunded:  ["refunded"],
  cancelled:           [],
  expired:             [],
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending:             "Awaiting payment",
  processing:          "Verifying payment",
  completed:           "Payment received",
  failed:              "Payment failed",
  refunded:            "Refunded",
  partially_refunded:  "Partially refunded",
  cancelled:           "Cancelled",
  expired:             "Expired",
};

export interface RazorpayOrderPayload {
  amount: number;
  currency: "INR";
  receipt: string;
  notes: {
    entity_type: PaymentEntity;
    entity_id: string;
    lifeline_id: string;
    tier?: string;
  };
}

export interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment: {
      entity: {
        id: string;
        order_id: string;
        status: string;
        amount: number;
        currency: string;
        notes: Record<string, string>;
        captured: boolean;
        error_code?: string;
        error_description?: string;
      };
    };
    order?: {
      entity: {
        id: string;
        status: string;
        amount: number;
        amount_paid: number;
        amount_due: number;
        notes: Record<string, string>;
      };
    };
  };
}

export interface PaymentRecord {
  id: string;
  entity_type: PaymentEntity;
  entity_id: string;
  lifeline_id: string;
  service: PaymentService;

  // Amount (in paise — Razorpay standard)
  amount: number;
  currency: "INR";

  // Order state
  status: PaymentStatus;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;

  // Webhook verification
  webhook_received_at?: string;
  webhook_verified: boolean;

  // Refund
  refund_id?: string;
  refund_amount?: number;
  refund_reason?: string;
  refunded_at?: string;

  // Idempotency
  idempotency_key: string;

  // Retry
  failure_reason?: string;
  retry_count: number;
  max_retries: number;

  // Timing
  created_at: string;
  updated_at: string;
  completed_at?: string;
  expired_at?: string;

  // Metadata
  notes?: Record<string, string>;
}

export function canPaymentTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from]?.includes(to) ?? false;
}
