export interface Commitment {
  requestId: number;
  hospitalName: string;
  hospitalLocation: string;
  patientFirstName: string;
  bloodGroup: string;
  requiredDate: string;
  requiredTime: string;
  committedAt: string;
  // Status flow: committed → awaiting_confirmation → completed | missed
  status: "committed" | "awaiting_confirmation" | "completed" | "missed";
  // DB confirmation record id (set when donor marks as donated)
  confirmationId?: number;
  // requester_user_id (needed to create confirmation)
  requesterUserId?: number;
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

export function addCommitment(c: Commitment): void {
  const list = getCommitments().filter((x) => x.requestId !== c.requestId);
  localStorage.setItem(KEY, JSON.stringify([c, ...list]));
}

export function updateCommitmentStatus(
  requestId: number,
  status: Commitment["status"],
  extra?: { confirmationId?: number }
): void {
  const list = getCommitments().map((c) =>
    c.requestId === requestId ? { ...c, status, ...(extra ?? {}) } : c
  );
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function getCommitment(requestId: number): Commitment | undefined {
  return getCommitments().find((c) => c.requestId === requestId);
}

export function getSeenIds(): number[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function markAsSeen(ids: number[]): void {
  const current = getSeenIds();
  const merged = Array.from(new Set([...current, ...ids]));
  localStorage.setItem(SEEN_KEY, JSON.stringify(merged));
}

// Track which confirmation IDs are awaiting celebration trigger
export function addPendingCelebration(confirmationId: number, requestId: number): void {
  const current = getPendingCelebrations();
  current[confirmationId] = requestId;
  localStorage.setItem(PENDING_CELEBRATION_KEY, JSON.stringify(current));
}

export function getPendingCelebrations(): Record<number, number> {
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
