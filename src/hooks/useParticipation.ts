import { useState, useEffect, useCallback } from "react";
import type { RsvpStatus, EventParticipation } from "@/types/events";
import {
  getParticipation,
  upsertParticipation,
  updateRsvpStatus,
  syncParticipationToApi,
} from "@/lib/participation-store";
import { addReminders } from "@/lib/reminder-store";
import { generateId } from "@/lib/health-store";
import { useProfile } from "@/context/profile-context";

export function useParticipation(eventId: string | undefined) {
  const { profile } = useProfile();
  const [participation, setParticipation] = useState<EventParticipation | undefined>();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!eventId) { setLoading(false); return; }
    const local = getParticipation(eventId);
    if (local) {
      setParticipation(local);
    }
    setLoading(false);
  }, [eventId]);

  const syncFromApi = useCallback(async (userId: number | null) => {
    if (!eventId || !userId) return;
    try {
      const res = await fetch(`/api/event-registrations?event_id=${eventId}&user_id=${userId}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const reg = data[0];
          const record: EventParticipation = {
            id: reg.id,
            eventId: reg.event_id,
            userId: reg.user_id,
            name: reg.name,
            bloodGroup: reg.blood_group,
            registeredAt: reg.registered_at,
            rsvpStatus: reg.rsvp_status ?? "attending",
            cancelledAt: reg.cancelled_at,
            checkedInAt: reg.checked_in_at,
          };
          upsertParticipation(record);
          setParticipation(record);
        }
      }
    } catch {
      // silent — local data is fallback
    }
  }, [eventId]);

  const rsvp = useCallback(async (status: RsvpStatus, eventTitle?: string, eventDate?: string) => {
    if (!eventId || !profile?.name) return false;
    setSyncing(true);

    const record: EventParticipation = {
      id: participation?.id ?? "",
      eventId,
      userId: participation?.userId ?? null,
      name: profile.name,
      bloodGroup: profile.bloodGroup ?? null,
      registeredAt: participation?.registeredAt ?? new Date().toISOString(),
      rsvpStatus: status,
      cancelledAt: status === "cancelled" ? new Date().toISOString() : null,
      checkedInAt: null,
    };

    upsertParticipation(record);
    setParticipation(record);

    const synced = await syncParticipationToApi(record);
    if (synced && status !== "cancelled" && eventDate) {
      const eventTime = new Date(eventDate).getTime();
      const reminderTime = eventTime - 24 * 60 * 60 * 1000;
      if (reminderTime > Date.now()) {
        addReminders([{
          id: generateId(),
          category: "appointment_reminder",
          priority: "medium",
          title: `Upcoming event: ${eventTitle ?? "Community event"}`,
          description: `You registered for an event tomorrow. Don't forget to attend!`,
          createdAt: new Date().toISOString(),
          scheduledFor: new Date(reminderTime).toISOString(),
          expiresAt: eventDate,
          status: "pending",
          entityType: "appointment",
          entityId: eventId,
          correlationGroup: `event_${eventId}`,
          doctorId: null,
          appointmentId: null,
          consultationId: null,
          prescriptionId: null,
          followUpId: null,
          billingId: null,
          snoozedUntil: null,
          retryCount: 0,
          maxRetries: 1,
        }]);
      }
    }
    setSyncing(false);
    return synced;
  }, [eventId, profile, participation]);

  return { participation, loading, syncing, rsvp, syncFromApi, setParticipation };
}
