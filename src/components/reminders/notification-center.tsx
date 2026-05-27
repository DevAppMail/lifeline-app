import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import {
  ChevronLeft, BellOff, CheckCheck,
} from "lucide-react";
import type { ReminderAction, ReminderEvent } from "@/types/reminder";
import { ReminderCard } from "./reminder-card";

interface NotificationCenterProps {
  reminders: { label: string; items: ReminderEvent[] }[];
  unreadCount: number;
  dispatch: (action: ReminderAction) => void;
  loading: boolean;
}

export function NotificationCenter({ reminders, unreadCount, dispatch, loading }: NotificationCenterProps) {
  const [, setLocation] = useLocation();
  const totalItems = reminders.reduce((s, g) => s + g.items.length, 0);

  const handleAction = (action: ReminderAction) => {
    if (action.type === "rebook") {
      const reminder = reminders.flatMap(g => g.items).find(r => r.id === action.id);
      if (reminder?.doctorId) {
        setLocation(`/book-appointment/${reminder.doctorId}`);
        return;
      }
      setLocation("/book-doctor");
      return;
    }
    dispatch(action);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-4 border-b border-border">
        <button onClick={() => setLocation("/home")}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-muted hover:bg-muted/80">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Notifications</h1>
            {unreadCount > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-white">
                {unreadCount}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">Continuity reminders & alerts</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={() => dispatch({ type: "mark_all_read" })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors">
            <CheckCheck className="w-3.5 h-3.5" />
            Read all
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 px-5 pt-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-card border border-border rounded-2xl h-[88px] animate-pulse" />
            ))}
          </div>
        ) : totalItems === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4">
              <BellOff className="w-8 h-8 text-muted-foreground/30" />
            </div>
            <p className="text-base font-semibold text-foreground">All caught up</p>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-[260px]">
              No pending reminders. We'll notify you when something needs your attention.
            </p>
            <Link href="/home" className="mt-5 px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-xl">
              Back to home
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {reminders.map(group => (
              <div key={group.label}>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                  <span className="flex-1 h-px bg-border" />
                  {group.label}
                  <span className="flex-1 h-px bg-border" />
                </p>
                <div className="space-y-2.5">
                  {group.items.map((reminder, i) => (
                    <motion.div key={reminder.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                      <ReminderCard reminder={reminder} onAction={handleAction} />
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
