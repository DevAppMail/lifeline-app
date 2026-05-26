import { motion } from "framer-motion";
import { Calendar, CalendarClock, IndianRupee, CheckCircle2, Stethoscope } from "lucide-react";
import type { PatientContinuity } from "@/types/continuity";
import { pendingFollowUps, upcomingAppointments, recentConsultations, totalPrescriptions } from "@/lib/continuity-utils";
import { Link } from "wouter";

interface ContinuitySummaryProps {
  continuity: PatientContinuity;
  loading?: boolean;
}

function SummarySkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-card border border-border rounded-2xl p-3 animate-pulse h-16" />
      ))}
    </div>
  );
}

export function ContinuitySummary({ continuity, loading }: ContinuitySummaryProps) {
  if (loading) return <SummarySkeleton />;

  const upcoming = upcomingAppointments(continuity);
  const consultCount = recentConsultations(continuity).length;
  const { count: rxCount } = totalPrescriptions(continuity);
  const pending = pendingFollowUps(continuity);
  const summary = continuity.summary;

  const nextAppt = upcoming.length > 0 ? upcoming[0] : null;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {nextAppt && (
          <Link href="/profile" className="block col-span-2">
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="bg-primary/5 border border-primary/20 rounded-2xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <Stethoscope className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Next Visit</span>
              </div>
              <p className="text-sm font-bold text-foreground leading-tight">{nextAppt.doctorName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(nextAppt.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                {nextAppt.time ? ` at ${nextAppt.time}` : ""}
              </p>
            </motion.div>
          </Link>
        )}

        <div className="bg-card border border-border rounded-2xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Calendar className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total</span>
          </div>
          <p className="text-lg font-bold text-foreground">{summary.totalAppointments}</p>
          <p className="text-[10px] text-muted-foreground">appointments</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Done</span>
          </div>
          <p className="text-lg font-bold text-foreground">{summary.totalCompleted}</p>
          <p className="text-[10px] text-muted-foreground">completed</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <CalendarClock className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Follow</span>
          </div>
          <p className="text-lg font-bold text-foreground">{pending.length}</p>
          <p className="text-[10px] text-muted-foreground">pending</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <IndianRupee className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Spent</span>
          </div>
          <p className="text-lg font-bold text-foreground">₹{summary.totalSpent.toLocaleString("en-IN")}</p>
          <p className="text-[10px] text-muted-foreground">total</p>
        </div>
      </div>

      {summary.totalPending > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-2xl p-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">₹{summary.totalPending.toLocaleString("en-IN")} pending</p>
            <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70">Outstanding balance</p>
          </div>
          <Link href="/profile" className="text-xs font-bold text-amber-700 dark:text-amber-400 underline">View</Link>
        </div>
      )}
    </div>
  );
}
