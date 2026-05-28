import { useContinuity } from "@/hooks/useContinuity";
import { useReminders } from "@/hooks/useReminders";
import { NotificationCenter } from "@/components/reminders";
import { BottomNav } from "@/components/bottom-nav";

export default function NotificationsPage() {
  const { data: continuity, loading: continuityLoading } = useContinuity({ enabled: true });
  const { reminders, unreadCount, dispatch, groups, loading: remindersLoading } = useReminders(continuity);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background pb-20">
      <NotificationCenter
        reminders={groups}
        unreadCount={unreadCount}
        dispatch={dispatch}
        loading={continuityLoading || remindersLoading}
      />
      <BottomNav />
    </div>
  );
}
