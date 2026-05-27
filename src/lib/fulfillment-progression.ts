import type { DonorResponseState } from "@/types/fulfillment";

export type FulfillmentProgressionState =
  | "donor_secured"
  | "donor_en_route"
  | "donor_arrived"
  | "donor_medically_screened"
  | "donation_completed"
  | "donor_medically_rejected"
  | "donor_cancelled"
  | "donor_no_show";

export interface DonorProgression {
  donorId: string;
  donorName: string;
  state: FulfillmentProgressionState;
  updatedAt: string;
  note?: string;
}

export interface FulfillmentProgress {
  required: number;
  fulfilled: number;
  states: Record<FulfillmentProgressionState, number>;
  donors: DonorProgression[];
}

export const PROGRESSION_LABELS: Record<FulfillmentProgressionState, { label: string; icon: string; color: string }> = {
  donor_secured:         { label: "Secured",         icon: "●", color: "text-blue-600" },
  donor_en_route:       { label: "En Route",         icon: "◉", color: "text-blue-600" },
  donor_arrived:        { label: "Arrived",          icon: "◎", color: "text-emerald-600" },
  donor_medically_screened: { label: "Screened",      icon: "◈", color: "text-emerald-600" },
  donation_completed:   { label: "Donated",          icon: "◆", color: "text-emerald-700" },
  donor_medically_rejected: { label: "Deferred",      icon: "○", color: "text-amber-600" },
  donor_cancelled:      { label: "Cancelled",         icon: "○", color: "text-muted-foreground" },
  donor_no_show:        { label: "No Show",           icon: "○", color: "text-rose-500" },
};

export const PROGRESSION_ORDER: FulfillmentProgressionState[] = [
  "donor_secured",
  "donor_en_route",
  "donor_arrived",
  "donor_medically_screened",
  "donation_completed",
  "donor_medically_rejected",
  "donor_cancelled",
  "donor_no_show",
];

const STORAGE_KEY = "lifeline_fulfillment_progression";

function getStore(): DonorProgression[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveStore(data: DonorProgression[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getFulfillmentProgress(requestId: string): DonorProgression[] {
  return getStore().filter(d => d.donorId.startsWith(requestId));
}

export function updateDonorProgression(
  requestId: string,
  donorId: string,
  donorName: string,
  state: FulfillmentProgressionState,
  note?: string,
): DonorProgression[] {
  const all = getStore();
  const key = `${requestId}::${donorId}`;
  const existing = all.findIndex(d => d.donorId === key);
  const entry: DonorProgression = {
    donorId: key,
    donorName,
    state,
    updatedAt: new Date().toISOString(),
    note,
  };

  if (existing >= 0) {
    all[existing] = entry;
  } else {
    all.push(entry);
  }

  saveStore(all);
  return all.filter(d => d.donorId.startsWith(requestId));
}

export function getProgressSummary(required: number, donors: DonorProgression[]): FulfillmentProgress {
  const states: Record<FulfillmentProgressionState, number> = {
    donor_secured: 0,
    donor_en_route: 0,
    donor_arrived: 0,
    donor_medically_screened: 0,
    donation_completed: 0,
    donor_medically_rejected: 0,
    donor_cancelled: 0,
    donor_no_show: 0,
  };

  for (const d of donors) {
    states[d.state] = (states[d.state] || 0) + 1;
  }

  const completed = states.donation_completed;
  const attempted = donors.filter(d =>
    d.state === "donation_completed" ||
    d.state === "donor_medically_rejected" ||
    d.state === "donor_no_show"
  ).length;

  return {
    required,
    fulfilled: completed,
    states,
    donors,
  };
}

export const REFUND_ELIGIBILITY: Record<string, { refundable: boolean; reason: string }> = {
  no_donor_secured:     { refundable: true,  reason: "No donor was secured for the request." },
  donor_before_arrival: { refundable: true,  reason: "Donor was secured but did not arrive." },
  donor_rejected:       { refundable: true,  reason: "Donor was medically deferred at screening." },
  donation_completed:   { refundable: false, reason: "The donation was successfully completed." },
  donor_cancelled:      { refundable: true,  reason: "The donor cancelled before donation." },
};

export function getRefundEligibility(donors: DonorProgression[]): {
  eligible: boolean;
  reason: string;
  type: string;
} {
  if (donors.length === 0) {
    return { eligible: true, reason: REFUND_ELIGIBILITY.no_donor_secured.reason, type: "no_donor_secured" };
  }

  const hasCompleted = donors.some(d => d.state === "donation_completed");
  if (hasCompleted) {
    return { eligible: false, reason: REFUND_ELIGIBILITY.donation_completed.reason, type: "donation_completed" };
  }

  const hasArrived = donors.some(d =>
    d.state === "donor_arrived" || d.state === "donor_medically_screened"
  );
  if (hasArrived || donors.some(d => d.state === "donor_medically_rejected")) {
    return { eligible: true, reason: REFUND_ELIGIBILITY.donor_rejected.reason, type: "donor_rejected" };
  }

  const hasEnRoute = donors.some(d => d.state === "donor_en_route");
  if (hasEnRoute) {
    return { eligible: true, reason: REFUND_ELIGIBILITY.donor_before_arrival.reason, type: "donor_before_arrival" };
  }

  const hasCancelled = donors.some(d => d.state === "donor_cancelled");
  if (hasCancelled) {
    return { eligible: true, reason: REFUND_ELIGIBILITY.donor_cancelled.reason, type: "donor_cancelled" };
  }

  return { eligible: true, reason: "Awaiting donor response.", type: "no_donor_secured" };
}

export const LEGAL_OPERATIONAL_NOTE =
  "LifeLine helps individuals connect with voluntary blood donors. " +
  "Successful donation depends on donor participation, " +
  "medical screening, timing, hospital procedures, " +
  "and other operational factors. " +
  "Users are encouraged to continue exploring " +
  "offline and institutional channels as well.";

export const DONOR_PROGRESSION_NOTE =
  "Progress reflects real-time donor status updates. " +
  "Medical deferral decisions are made by hospital staff " +
  "based on their screening protocols.";
