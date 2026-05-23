import type {
  TimelineEntry,
  LinkedProvider,
  FollowUpRequest,
  FollowUpStatus,
  CareCircleMember,
} from "@/types/health";

const KEYS = {
  timeline: "lifeline_health_timeline",
  providers: "lifeline_linked_providers",
  follow_ups: "lifeline_follow_ups",
  care_circle: "lifeline_care_circle",
} as const;

function read<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]");
  } catch {
    return [];
  }
}

function write<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
}

// ── Timeline ──────────────────────────────────────────────────────────────────

export function getTimeline(): TimelineEntry[] {
  return read<TimelineEntry>(KEYS.timeline).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

export function addTimelineEntry(entry: TimelineEntry): void {
  const list = read<TimelineEntry>(KEYS.timeline).filter((e) => e.id !== entry.id);
  write(KEYS.timeline, [entry, ...list]);
}

export function removeTimelineEntry(id: string): void {
  write(
    KEYS.timeline,
    read<TimelineEntry>(KEYS.timeline).filter((e) => e.id !== id),
  );
}

// ── Providers ─────────────────────────────────────────────────────────────────

export function getProviders(): LinkedProvider[] {
  return read<LinkedProvider>(KEYS.providers).sort(
    (a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime(),
  );
}

export function addProvider(provider: LinkedProvider): void {
  const list = read<LinkedProvider>(KEYS.providers).filter((p) => p.id !== provider.id);
  write(KEYS.providers, [provider, ...list]);
}

export function updateProvider(id: string, updates: Partial<LinkedProvider>): void {
  write(
    KEYS.providers,
    read<LinkedProvider>(KEYS.providers).map((p) => (p.id === id ? { ...p, ...updates } : p)),
  );
}

export function removeProvider(id: string): void {
  write(
    KEYS.providers,
    read<LinkedProvider>(KEYS.providers).filter((p) => p.id !== id),
  );
}

// ── Follow-ups ────────────────────────────────────────────────────────────────

export function getFollowUps(): FollowUpRequest[] {
  return read<FollowUpRequest>(KEYS.follow_ups).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export function getPendingFollowUps(): FollowUpRequest[] {
  return getFollowUps().filter((f) => f.status === "pending_approval");
}

export function addFollowUp(followUp: FollowUpRequest): void {
  const list = read<FollowUpRequest>(KEYS.follow_ups).filter((f) => f.id !== followUp.id);
  write(KEYS.follow_ups, [followUp, ...list]);
}

export function updateFollowUpStatus(
  id: string,
  status: FollowUpStatus,
  extra?: Partial<FollowUpRequest>,
): void {
  write(
    KEYS.follow_ups,
    read<FollowUpRequest>(KEYS.follow_ups).map((f) =>
      f.id === id
        ? { ...f, status, user_response_at: new Date().toISOString(), ...(extra ?? {}) }
        : f,
    ),
  );
}

// ── Care Circle ───────────────────────────────────────────────────────────────

export function getCareCircle(): CareCircleMember[] {
  return read<CareCircleMember>(KEYS.care_circle);
}

export function addCareCircleMember(member: CareCircleMember): void {
  const list = read<CareCircleMember>(KEYS.care_circle).filter((m) => m.id !== member.id);
  write(KEYS.care_circle, [...list, member]);
}

export function updateCareCircleMember(id: string, updates: Partial<CareCircleMember>): void {
  write(
    KEYS.care_circle,
    read<CareCircleMember>(KEYS.care_circle).map((m) => (m.id === id ? { ...m, ...updates } : m)),
  );
}

export function removeCareCircleMember(id: string): void {
  write(
    KEYS.care_circle,
    read<CareCircleMember>(KEYS.care_circle).filter((m) => m.id !== id),
  );
}
