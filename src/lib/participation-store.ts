import type { RsvpStatus, EventParticipation } from "@/types/events";

const STORAGE_KEY = "lifeline_event_participations";

function read(): EventParticipation[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function write(records: EventParticipation[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function getParticipations(): EventParticipation[] {
  return read();
}

export function getParticipation(eventId: string): EventParticipation | undefined {
  return read().find(p => p.eventId === eventId);
}

export function upsertParticipation(record: EventParticipation): void {
  const records = read();
  const idx = records.findIndex(p => p.eventId === record.eventId);
  if (idx >= 0) {
    records[idx] = record;
  } else {
    records.push(record);
  }
  write(records);
}

export function updateRsvpStatus(eventId: string, status: RsvpStatus): void {
  const records = read();
  const idx = records.findIndex(p => p.eventId === eventId);
  if (idx >= 0) {
    records[idx] = { ...records[idx], rsvpStatus: status };
    write(records);
  }
}

export function removeParticipation(eventId: string): void {
  const records = read().filter(p => p.eventId !== eventId);
  write(records);
}

export function getRsvpCounts(eventId: string): Record<RsvpStatus, number> {
  const all = read();
  const byEvent = all.filter(p => p.eventId === eventId);
  return {
    attending: byEvent.filter(p => p.rsvpStatus === "attending").length,
    interested: byEvent.filter(p => p.rsvpStatus === "interested").length,
    cancelled: byEvent.filter(p => p.rsvpStatus === "cancelled").length,
    attended: byEvent.filter(p => p.rsvpStatus === "attended").length,
    missed: byEvent.filter(p => p.rsvpStatus === "missed").length,
  };
}

export function clearAllParticipations(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export async function syncParticipationToApi(record: EventParticipation): Promise<boolean> {
  try {
    const body: Record<string, unknown> = {
      event_id: record.eventId,
      user_id: record.userId,
      name: record.name,
      blood_group: record.bloodGroup,
      rsvp_status: record.rsvpStatus,
    };
    if (record.id) {
      const res = await fetch(`/api/event-registrations/${record.id}/rsvp`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rsvp_status: record.rsvpStatus, user_id: record.userId }),
      });
      return res.ok;
    }
    const res = await fetch("/api/event-registrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      const updated = { ...record, id: data.id };
      upsertParticipation(updated);
    }
    return res.ok;
  } catch {
    return false;
  }
}
