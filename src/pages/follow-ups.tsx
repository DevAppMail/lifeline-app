import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Heart, Droplet, Activity, User,
  Bell, CheckCircle2, XCircle, CalendarClock, Home, Stethoscope,
  Video, Clock, AlertTriangle, RotateCcw, Plus, X, Check,
  RefreshCw, AlertCircle, Info, Loader2,
} from "lucide-react";
import { useProfile } from "@/context/profile-context";
import {
  getFollowUps, addFollowUp, updateFollowUpStatus,
  addTimelineEntry, getProviders, generateId,
} from "@/lib/health-store";
import { respondToFollowUp } from "@/lib/continuity-utils";
import { getFollowUpCompletionInsights } from "@/lib/continuity-intelligence";
import type { FollowUpRequest, VisitType, FollowUpUrgency } from "@/types/health";
import { BottomNav } from "@/components/bottom-nav";

const VISIT_CONFIG: Record<VisitType, { label: string; icon: React.ReactNode; color: string }> = {
  clinic:       { label: "Clinic Visit",       icon: <Stethoscope className="w-3.5 h-3.5" />, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  home_visit:   { label: "Home Visit",          icon: <Home className="w-3.5 h-3.5" />,         color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  telemedicine: { label: "Telemedicine",        icon: <Video className="w-3.5 h-3.5" />,        color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
};

const URGENCY_CONFIG: Record<FollowUpUrgency, { label: string; color: string; dot: string }> = {
  routine: { label: "Routine",  color: "text-muted-foreground",                    dot: "bg-muted-foreground" },
  soon:    { label: "Soon",     color: "text-amber-600 dark:text-amber-400",       dot: "bg-amber-500" },
  urgent:  { label: "Urgent",   color: "text-red-600 dark:text-red-400",           dot: "bg-red-500" },
};

function getFollowUpPurpose(reason: string): string {
  const lower = reason.toLowerCase();
  if (lower.includes("bp") || lower.includes("blood pressure")) return "Regular monitoring helps you and your provider track your blood pressure over time.";
  if (lower.includes("sugar") || lower.includes("diabetes") || lower.includes("diabetic")) return "Consistent follow-ups help manage blood sugar levels and adjust medication if needed.";
  if (lower.includes("thyroid")) return "Follow-up ensures your thyroid medication dosage is still appropriate.";
  if (lower.includes("heart") || lower.includes("cardiac")) return "Cardiac follow-ups help track recovery and prevent complications.";
  if (lower.includes("lab") || lower.includes("test") || lower.includes("report")) return "Reviewing results with your provider ensures your care plan stays on track.";
  if (lower.includes("pain")) return "Ongoing pain management follow-ups help optimize your treatment approach.";
  if (lower.includes("therapy") || lower.includes("physio") || lower.includes("rehab")) return "Consistent sessions support steady improvement in mobility and function.";
  if (lower.includes("check") || lower.includes("review") || lower.includes("follow")) return "Regular check-ups help your provider track your health over time.";
  if (lower.includes("wound") || lower.includes("dressing")) return "Regular wound checks are important for proper healing and preventing infection.";
  if (lower.includes("vaccine") || lower.includes("vaccination")) return "Staying up to date with vaccinations protects your long-term health.";
  return "This follow-up helps your provider ensure your treatment is working as expected.";
}

type Tab = "pending" | "upcoming" | "past";

export default function FollowUps() {
  const [, setLocation] = useLocation();
  const { profile } = useProfile();
  const [tab, setTab] = useState<Tab>("pending");
  const [followUps, setFollowUps] = useState<FollowUpRequest[]>([]);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [addingReminder, setAddingReminder] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // New reminder form state
  const [rProvider, setRProvider] = useState("");
  const [rReason, setRReason] = useState("");
  const [rDate, setRDate] = useState("");
  const [rVisitType, setRVisitType] = useState<VisitType>("clinic");
  const [rUrgency, setRUrgency] = useState<FollowUpUrgency>("routine");
  const [rRecurring, setRRecurring] = useState(false);
  const [rSessions, setRSessions] = useState("");
  const [rInterval, setRInterval] = useState("7");

  useEffect(() => { setFollowUps(getFollowUps()); }, []);
  const refresh = () => setFollowUps(getFollowUps());

  const handleAccept = async (id: string) => {
    if (actionLoadingId) return;
    setActionLoadingId(id);
    try {
      updateFollowUpStatus(id, "accepted");
      await respondToFollowUp(id, "accepted");
      const fu = followUps.find(f => f.id === id);
      if (fu) {
        addTimelineEntry({
          id: generateId(),
          type: "follow_up",
          date: fu.recommended_date ?? new Date().toISOString(),
          title: `Follow-up: ${fu.reason}`,
          subtitle: fu.recommended_date ? new Date(fu.recommended_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : undefined,
          provider: fu.provider_name,
          status: "scheduled",
        });
      }
      refresh();
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (actionLoadingId) return;
    setActionLoadingId(id);
    try {
      updateFollowUpStatus(id, "rejected");
      await respondToFollowUp(id, "rejected");
      refresh();
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReschedule = async (id: string) => {
    if (!rescheduleDate) return;
    updateFollowUpStatus(id, "rescheduled", { rescheduled_to: rescheduleDate });
    await respondToFollowUp(id, "rescheduled", { rescheduled_date: rescheduleDate });
    addTimelineEntry({
      id: generateId(),
      type: "follow_up",
      date: rescheduleDate,
      title: `Rescheduled follow-up`,
      provider: followUps.find(f => f.id === id)?.provider_name,
      status: "scheduled",
    });
    setReschedulingId(null);
    setRescheduleDate("");
    refresh();
  };

  const handleAddReminder = () => {
    if (!rProvider.trim() || !rReason.trim()) return;
    const fu: FollowUpRequest = {
      id: generateId(),
      provider_name: rProvider.trim(),
      provider_type: "self",
      reason: rReason.trim(),
      recommended_date: rDate || undefined,
      visit_type: rVisitType,
      urgency: rUrgency,
      status: "accepted",
      created_at: new Date().toISOString(),
      is_recurring: rRecurring,
      recurring_interval_days: rRecurring ? Number(rInterval) : undefined,
      total_sessions: rRecurring && rSessions ? Number(rSessions) : undefined,
      current_session: rRecurring ? 1 : undefined,
    };
    addFollowUp(fu);
    if (rDate) {
      addTimelineEntry({
        id: generateId(),
        type: "follow_up",
        date: rDate,
        title: `Follow-up: ${rReason.trim()}`,
        provider: rProvider.trim(),
        status: "scheduled",
      });
    }
    setRProvider(""); setRReason(""); setRDate(""); setRRecurring(false); setRSessions(""); setRInterval("7");
    setAddingReminder(false);
    refresh();
    setTab("upcoming");
  };

  const pending = followUps.filter(f => f.status === "pending_approval");
  const upcoming = followUps.filter(
    f => f.status === "accepted" && (!f.recommended_date || new Date(f.recommended_date) >= new Date())
  );
  const past = followUps.filter(
    f => f.status === "rejected" || f.status === "rescheduled" || f.status === "expired" || f.status === "no_show" ||
      (f.status === "accepted" && f.recommended_date && new Date(f.recommended_date) < new Date())
  );

  const tabList: { key: Tab; label: string; count: number }[] = [
    { key: "pending",  label: "Pending",  count: pending.length },
    { key: "upcoming", label: "Upcoming", count: upcoming.length },
    { key: "past",     label: "History",  count: past.length },
  ];

  const providers = getProviders().map(p => p.name);

  if (!profile) return null;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background pb-24">

      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-4 border-b border-border">
        <button onClick={() => setLocation("/health")}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-muted hover:bg-muted/80">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Follow-Ups</h1>
          <p className="text-sm text-muted-foreground">Manage care recommendations</p>
        </div>
        <button onClick={() => setAddingReminder(true)}
          className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border px-5">
        {tabList.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-3 flex items-center justify-center gap-1.5 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}>
            {t.label}
            {t.count > 0 && (
              <span className={`min-w-[18px] h-[18px] text-[10px] font-bold rounded-full flex items-center justify-center px-1 ${
                tab === t.key ? "bg-primary text-white" : "bg-muted text-muted-foreground"
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-4">

        {/* Add Reminder Form */}
        <AnimatePresence>
          {addingReminder && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-4">
              <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-foreground">Add Follow-Up Reminder</p>
                  <button onClick={() => setAddingReminder(false)}
                    className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Provider / Doctor *</label>
                  <input list="providers-list" value={rProvider} onChange={e => setRProvider(e.target.value)}
                    placeholder="e.g. Dr. Tanvi Naik"
                    className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                  <datalist id="providers-list">
                    {providers.map(p => <option key={p} value={p} />)}
                  </datalist>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Reason *</label>
                  <input value={rReason} onChange={e => setRReason(e.target.value)}
                    placeholder="e.g. Blood pressure check"
                    className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Date</label>
                    <input type="date" value={rDate} onChange={e => setRDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Visit Type</label>
                    <select value={rVisitType} onChange={e => setRVisitType(e.target.value as VisitType)}
                      className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="clinic">Clinic</option>
                      <option value="home_visit">Home Visit</option>
                      <option value="telemedicine">Telemedicine</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Urgency</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["routine", "soon", "urgent"] as FollowUpUrgency[]).map(u => (
                      <button key={u} onClick={() => setRUrgency(u)}
                        className={`py-2 rounded-xl text-xs font-semibold border-2 transition-all capitalize ${
                          rUrgency === u ? "bg-primary text-white border-primary" : "bg-card border-border text-foreground"
                        }`}>
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setRRecurring(v => !v)}
                    className={`w-10 h-6 rounded-full relative transition-colors ${rRecurring ? "bg-primary" : "bg-muted"}`}>
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${rRecurring ? "translate-x-5" : "translate-x-1"}`} />
                  </button>
                  <span className="text-sm text-foreground">Recurring session</span>
                </div>
                <AnimatePresence>
                  {rRecurring && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                      className="grid grid-cols-2 gap-2 overflow-hidden">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground block mb-1">Total Sessions</label>
                        <input type="number" value={rSessions} onChange={e => setRSessions(e.target.value)}
                          placeholder="e.g. 12" min="2" max="52"
                          className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground block mb-1">Interval (days)</label>
                        <input type="number" value={rInterval} onChange={e => setRInterval(e.target.value)}
                          placeholder="7" min="1"
                          className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <button onClick={handleAddReminder} disabled={!rProvider.trim() || !rReason.trim()}
                  className="w-full py-3 bg-primary text-white text-sm font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" /> Save Reminder
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pending Tab */}
        {tab === "pending" && (
          pending.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <p className="text-base font-semibold text-foreground">No pending approvals</p>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-[280px]">
                When a doctor or provider recommends a follow-up, it will appear here for your approval before being added to your schedule.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map(fu => {
                const visit = VISIT_CONFIG[fu.visit_type] ?? VISIT_CONFIG.clinic;
                const urgency = URGENCY_CONFIG[fu.urgency] ?? URGENCY_CONFIG.routine;
                return (
                  <motion.div key={fu.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${visit.color}`}>
                            {visit.icon} {visit.label}
                          </span>
                          <span className="flex items-center gap-1 text-xs font-semibold">
                            <span className={`w-1.5 h-1.5 rounded-full ${urgency.dot}`} />
                            <span className={urgency.color}>{urgency.label}</span>
                          </span>
                          {fu.is_recurring && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              <RefreshCw className="w-3 h-3" />
                              {fu.current_session && fu.total_sessions
                                ? `Session ${fu.current_session}/${fu.total_sessions}`
                                : "Recurring"}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-foreground">{fu.provider_name}</p>
                        {fu.specialty && <p className="text-xs text-muted-foreground">{fu.specialty}</p>}
                        <p className="text-sm text-foreground mt-1">{fu.reason}</p>
                        {fu.recommended_date && (
                          <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(fu.recommended_date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</span>
                            {fu.recommended_time_window && <span>· {fu.recommended_time_window}</span>}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground/70 mt-1.5 leading-relaxed">
                          {getFollowUpPurpose(fu.reason)}
                        </p>
                        {fu.notes && <p className="text-xs text-muted-foreground mt-1 italic">"{fu.notes}"</p>}
                      </div>
                    </div>

                    <AnimatePresence mode="wait">
                      {reschedulingId === fu.id ? (
                        <motion.div key="reschedule-form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="space-y-2">
                          <input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)}
                            min={new Date().toISOString().split("T")[0]}
                            className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                          <div className="flex gap-2">
                            <button onClick={() => { setReschedulingId(null); setRescheduleDate(""); }}
                              className="flex-1 py-2 border border-border rounded-xl text-xs font-semibold text-muted-foreground">
                              Cancel
                            </button>
                            <button onClick={() => handleReschedule(fu.id)} disabled={!rescheduleDate}
                              className="flex-1 py-2 bg-primary text-white rounded-xl text-xs font-bold disabled:opacity-50">
                              Confirm Date
                            </button>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div key="actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="flex gap-2">
                          <button onClick={() => handleAccept(fu.id)}
                            disabled={actionLoadingId === fu.id}
                            className="flex-1 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
                            {actionLoadingId === fu.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Accept
                          </button>
                          <button onClick={() => { setReschedulingId(fu.id); setRescheduleDate(""); }}
                            className="flex-1 py-2.5 border border-primary/30 text-primary text-xs font-bold rounded-xl flex items-center justify-center gap-1.5">
                            <RotateCcw className="w-3.5 h-3.5" /> Reschedule
                          </button>
                          <button onClick={() => handleReject(fu.id)}
                            disabled={actionLoadingId === fu.id}
                            className="py-2.5 px-3 border border-border text-muted-foreground text-xs font-bold rounded-xl flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                            {actionLoadingId === fu.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )
        )}

        {/* Upcoming Tab */}
        {tab === "upcoming" && (
          upcoming.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4">
                <CalendarClock className="w-8 h-8 text-muted-foreground/30" />
              </div>
              <p className="text-base font-semibold text-foreground">No upcoming follow-ups</p>
              <p className="text-sm text-muted-foreground mt-2">Tap + to add a reminder for a follow-up visit.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map((fu, i) => {
                const visit = VISIT_CONFIG[fu.visit_type] ?? VISIT_CONFIG.clinic;
                const isOverdue = fu.recommended_date && new Date(fu.recommended_date) < new Date();
                const daysUntil = fu.recommended_date ? Math.round((new Date(fu.recommended_date).getTime() - Date.now()) / 86400000) : null;
                return (
                  <motion.div key={fu.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className={`bg-card border rounded-2xl p-4 ${isOverdue ? "border-red-200 dark:border-red-800/30" : "border-border"}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${visit.color.includes("blue") ? "bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400" : visit.color.includes("emerald") ? "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400" : "bg-purple-100 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400"}`}>
                        {visit.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-bold text-foreground">{fu.provider_name}</p>
                          {isOverdue && (
                            <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
                              Overdue
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-foreground mt-0.5">{fu.reason}</p>
                        {isOverdue && (
                          <p className="text-xs text-muted-foreground/70 mt-1 leading-relaxed">
                            {getFollowUpPurpose(fu.reason)}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${visit.color}`}>
                            {visit.label}
                          </span>
                          {fu.recommended_date && (
                            <span className={`text-xs flex items-center gap-1 ${isOverdue ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-muted-foreground"}`}>
                              <Clock className="w-3 h-3" />
                              {isOverdue
                                ? `Due ${new Date(fu.recommended_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                                : new Date(fu.recommended_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                              {daysUntil !== null && daysUntil <= 3 && daysUntil >= 0 && (
                                <span className="text-amber-600 dark:text-amber-400 font-semibold">· {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `${daysUntil}d`}</span>
                              )}
                            </span>
                          )}
                          {fu.is_recurring && fu.total_sessions && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <RefreshCw className="w-3 h-3" />
                              {fu.current_session}/{fu.total_sessions} sessions
                            </span>
                          )}
                          {fu.provider_type === "self" && (
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">Self-added</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ))}

        {/* History Tab */}
        {tab === "past" && (
          past.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <p className="text-base font-semibold text-foreground">No history yet</p>
              <p className="text-sm text-muted-foreground mt-2">Responded follow-ups will appear here.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {past.map((fu, i) => (
                <motion.div key={fu.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="bg-card border border-border rounded-2xl p-4 opacity-80">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground">{fu.provider_name}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{fu.reason}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                      fu.status === "accepted"    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : fu.status === "rejected"  ? "bg-muted text-muted-foreground"
                      : fu.status === "no_show"   ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                      : fu.status === "expired"   ? "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    }`}>
                      {fu.status === "accepted"   ? "Accepted"
                       : fu.status === "rejected" ? "Declined"
                       : fu.status === "no_show"  ? "No Show"
                       : fu.status === "expired"  ? "Expired"
                       : "Rescheduled"}
                    </span>
                  </div>
                  {fu.rescheduled_to && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Rescheduled to: {new Date(fu.rescheduled_to).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          )
        )}

        <div className="h-4" />
      </div>

      <BottomNav />
    </div>
  );
}
