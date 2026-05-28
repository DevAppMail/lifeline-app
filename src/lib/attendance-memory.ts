import { getParticipations, updateRsvpStatus } from "@/lib/participation-store";
import { addContribution } from "@/lib/contribution-store";
import type { EventParticipation } from "@/types/events";

const PROCESSED_KEY = "lifeline_attendance_processed";

function getProcessed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(PROCESSED_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

function markProcessed(eventId: string): void {
  const set = getProcessed();
  set.add(eventId);
  localStorage.setItem(PROCESSED_KEY, JSON.stringify([...set]));
}

/**
 * Scan participations for events that the user attended.
 * Creates contribution records for camp_donation type.
 * Runs once per event — idempotent via PROCESSED_KEY.
 */
export function processAttendanceMemory(lifelineId: string, donorName: string): void {
  const processed = getProcessed();
  const participations = getParticipations();

  for (const p of participations) {
    if (processed.has(p.eventId)) continue;
    if (p.rsvpStatus !== "attended") continue;

    // Fetch event details to get date/location
    fetch(`/api/events/${p.eventId}`)
      .then(r => r.json())
      .then(event => {
        addContribution({
          type: "camp_donation",
          lifelineId,
          donorName,
          donationDate: event.date ?? new Date().toISOString(),
          location: event.location ?? "Community event",
          organizer: event.title ?? "Health camp",
        });
        markProcessed(p.eventId);
      })
      .catch(() => {
        // If event fetch fails, still record with what we have
        addContribution({
          type: "camp_donation",
          lifelineId,
          donorName,
          donationDate: new Date().toISOString(),
          location: "Community event",
          organizer: "Health camp",
        });
        markProcessed(p.eventId);
      });
  }
}
