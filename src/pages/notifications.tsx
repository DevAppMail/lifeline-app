import { useContinuity } from "@/hooks/useContinuity";
import { useReminders } from "@/hooks/useReminders";
import { NotificationCenter } from "@/components/reminders";

export default function NotificationsPage() {
  const { data: continuity, loading: continuityLoading } = useContinuity({ enabled: true });
  const { reminders, unreadCount, dispatch, groups, loading: remindersLoading } = useReminders(continuity);

  return (
    <NotificationCenter
      reminders={groups}
      unreadCount={unreadCount}
      dispatch={dispatch}
      loading={continuityLoading || remindersLoading}
    />
  );
}
