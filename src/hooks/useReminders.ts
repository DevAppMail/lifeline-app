import { useState, useEffect, useCallback, useMemo } from "react";
import type { ReminderEvent, ReminderAction } from "@/types/reminder";
import {
  getReminderStore,
  markAllRemindersRead,
  updateReminderStatus,
  clearExpiredReminders,
  addReminders,
} from "@/lib/reminder-store";
import { computeAndStoreReminders, sortReminders, groupRemindersByDate, getActiveReminders } from "@/lib/reminder-utils";
import { getDueMedicationReminders } from "@/lib/medication-store";
import type { PatientContinuity } from "@/types/continuity";

interface UseRemindersResult {
  reminders: ReminderEvent[];
  unreadCount: number;
  loading: boolean;
  dispatch: (action: ReminderAction) => void;
  groups: { label: string; items: ReminderEvent[] }[];
}

export function useReminders(continuity: PatientContinuity | null): UseRemindersResult {
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const id = setTimeout(() => {
      clearExpiredReminders();
      if (continuity) {
        computeAndStoreReminders(continuity);
      }
      const medReminders = getDueMedicationReminders();
      if (medReminders.length > 0) {
        addReminders(medReminders);
      }
      setVersion(v => v + 1);
      setLoading(false);
    }, 200);
    return () => clearTimeout(id);
  }, [continuity]);

  const allReminders = useMemo(() => getReminderStore().reminders, [version]);

  const reminders = useMemo(() => {
    return sortReminders(getActiveReminders(allReminders));
  }, [allReminders]);

  const unreadCount = useMemo(() => {
    return allReminders.filter(r => r.status === "pending" || r.status === "shown").length;
  }, [allReminders]);

  const groups = useMemo(() => groupRemindersByDate(reminders), [reminders]);

  const dispatch = useCallback((action: ReminderAction) => {
    switch (action.type) {
      case "mark_read":
        updateReminderStatus(action.id, "read");
        setVersion(v => v + 1);
        break;
      case "dismiss":
        updateReminderStatus(action.id, "dismissed");
        setVersion(v => v + 1);
        break;
      case "snooze":
        updateReminderStatus(action.id, "snoozed", { snoozedUntil: action.until });
        setVersion(v => v + 1);
        break;
      case "mark_all_read":
        markAllRemindersRead();
        setVersion(v => v + 1);
        break;
    }
  }, []);

  return { reminders, unreadCount, loading, dispatch, groups };
}
