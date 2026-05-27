import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, Clock, Bell, AlertTriangle,
  FileText, IndianRupee, Pill, X, ChevronDown, ChevronUp,
} from "lucide-react";
import type { ReminderEvent, ReminderCategory, ReminderAction } from "@/types/reminder";

const ICONS: Record<ReminderCategory, { icon: React.ReactNode; bg: string; color: string }> = {
  appointment_reminder:  { icon: <Calendar className="w-4 h-4" />,     bg: "bg-blue-100 dark:bg-blue-950/30",     color: "text-blue-600 dark:text-blue-400" },
  appointment_today:     { icon: <Clock className="w-4 h-4" />,        bg: "bg-blue-100 dark:bg-blue-950/30",     color: "text-blue-600 dark:text-blue-400" },
  appointment_missed:    { icon: <AlertTriangle className="w-4 h-4" />, bg: "bg-red-100 dark:bg-red-950/30",      color: "text-red-600 dark:text-red-400" },
  follow_up_reminder:    { icon: <Bell className="w-4 h-4" />,         bg: "bg-amber-100 dark:bg-amber-950/30",   color: "text-amber-600 dark:text-amber-400" },
  follow_up_due:         { icon: <Clock className="w-4 h-4" />,        bg: "bg-amber-100 dark:bg-amber-950/30",   color: "text-amber-600 dark:text-amber-400" },
  follow_up_overdue:     { icon: <AlertTriangle className="w-4 h-4" />, bg: "bg-red-100 dark:bg-red-950/30",      color: "text-red-600 dark:text-red-400" },
  medication_reminder:   { icon: <Pill className="w-4 h-4" />,         bg: "bg-purple-100 dark:bg-purple-950/30", color: "text-purple-600 dark:text-purple-400" },
  medication_expiring:   { icon: <Pill className="w-4 h-4" />,         bg: "bg-purple-100 dark:bg-purple-950/30", color: "text-purple-600 dark:text-purple-400" },
  payment_reminder:      { icon: <IndianRupee className="w-4 h-4" />,  bg: "bg-slate-100 dark:bg-slate-800",      color: "text-slate-600 dark:text-slate-400" },
  payment_overdue:       { icon: <AlertTriangle className="w-4 h-4" />, bg: "bg-red-100 dark:bg-red-950/30",      color: "text-red-600 dark:text-red-400" },
  consultation_summary:  { icon: <FileText className="w-4 h-4" />,     bg: "bg-emerald-100 dark:bg-emerald-950/30", color: "text-emerald-600 dark:text-emerald-400" },
  missed_care:           { icon: <AlertTriangle className="w-4 h-4" />, bg: "bg-red-100 dark:bg-red-950/30",      color: "text-red-600 dark:text-red-400" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface ReminderCardProps {
  reminder: ReminderEvent;
  onAction: (action: ReminderAction) => void;
}

export function ReminderCard({ reminder, onAction }: ReminderCardProps) {
  const [expanded, setExpanded] = useState(false);
  const icon = ICONS[reminder.category];

  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className={`bg-card border rounded-2xl shadow-sm transition-colors ${
        reminder.priority === "high" && reminder.status === "pending"
          ? "border-red-200 dark:border-red-900/30"
          : "border-border"
      }`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${icon.bg} ${icon.color}`}>
            {icon.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground leading-snug">{reminder.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{reminder.description}</p>
              </div>
              {reminder.status === "pending" && reminder.priority === "high" && (
                <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-2" />
              )}
            </div>

            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-[10px] text-muted-foreground">{timeAgo(reminder.createdAt)}</span>
              {reminder.retryCount > 0 && (
                <span className="text-[10px] text-amber-600">Reminder #{reminder.retryCount + 1}</span>
              )}
            </div>
          </div>

          <div className="flex gap-1 flex-shrink-0">
            <button onClick={() => onAction({ type: "mark_read", id: reminder.id })}
              className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setExpanded(!expanded)}
              className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors">
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden">
              <div className="mt-3 pt-3 border-t border-border">
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div><span className="font-semibold text-foreground">Entity:</span> {reminder.entityType}</div>
                  {reminder.appointmentId && <div><span className="font-semibold text-foreground">Appointment:</span> {reminder.appointmentId.slice(0, 8)}</div>}
                  {reminder.consultationId && <div><span className="font-semibold text-foreground">Consultation:</span> {reminder.consultationId.slice(0, 8)}</div>}
                  {reminder.prescriptionId && <div><span className="font-semibold text-foreground">Prescription:</span> {reminder.prescriptionId.slice(0, 8)}</div>}
                  {reminder.correlationGroup && <div className="col-span-2"><span className="font-semibold text-foreground">Group:</span> {reminder.correlationGroup}</div>}
                  {reminder.expiresAt && <div className="col-span-2"><span className="font-semibold text-foreground">Expires:</span> {new Date(reminder.expiresAt).toLocaleDateString()}</div>}
                </div>

                <div className="flex gap-2 mt-3">
                  {reminder.entityType === "appointment" && reminder.doctorId && (
                    <button onClick={() => onAction({ type: "rebook", id: reminder.id })}
                      className="flex-1 py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl text-xs font-bold hover:bg-primary/20 transition-colors">
                      Rebook
                    </button>
                  )}
                  <button onClick={() => onAction({ type: "mark_read", id: reminder.id })}
                    className="flex-1 py-2 border border-border rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors">
                    Mark read
                  </button>
                  <button onClick={() => {
                    const d = new Date();
                    d.setHours(d.getHours() + 2);
                    onAction({ type: "snooze", id: reminder.id, until: d.toISOString() });
                  }}
                    className="flex-1 py-2 border border-border rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors">
                    Snooze 2h
                  </button>
                  <button onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    onAction({ type: "snooze", id: reminder.id, until: d.toISOString() });
                  }}
                    className="flex-1 py-2 border border-border rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors">
                    Snooze 1d
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
