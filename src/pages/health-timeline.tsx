import { useState, useEffect, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Droplet, Stethoscope, FileText, Home,
  FlaskConical, PenLine, CalendarClock, Heart, Activity, User,
  X, Check, Plus,
} from "lucide-react";
import { useProfile } from "@/context/profile-context";
import { useContinuity } from "@/hooks/useContinuity";
import {
  getTimeline, addTimelineEntry, removeTimelineEntry, generateId,
} from "@/lib/health-store";
import type { TimelineEntry, TimelineEntryType, EntryStatus } from "@/types/health";

const TYPE_CONFIG: Record<TimelineEntryType, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  donation:    { label: "Blood Donation",  icon: <Droplet className="w-4 h-4" />,       color: "text-primary",              bg: "bg-primary/10" },
  appointment: { label: "Appointment",     icon: <Stethoscope className="w-4 h-4" />,   color: "text-blue-600 dark:text-blue-400",     bg: "bg-blue-100 dark:bg-blue-950/30" },
  follow_up:   { label: "Follow-Up",       icon: <CalendarClock className="w-4 h-4" />, color: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-100 dark:bg-amber-950/30" },
  encounter:   { label: "Visit",           icon: <Home className="w-4 h-4" />,           color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-950/30" },
  prescription:{ label: "Prescription",   icon: <FileText className="w-4 h-4" />,       color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-950/30" },
  report:      { label: "Report",          icon: <FlaskConical className="w-4 h-4" />,  color: "text-cyan-600 dark:text-cyan-400",     bg: "bg-cyan-100 dark:bg-cyan-950/30" },
  health_note: { label: "Health Note",     icon: <PenLine className="w-4 h-4" />,       color: "text-slate-600 dark:text-slate-400",   bg: "bg-slate-100 dark:bg-slate-800" },
  home_visit:  { label: "Home Visit",      icon: <Home className="w-4 h-4" />,           color: "text-teal-600 dark:text-teal-400",    bg: "bg-teal-100 dark:bg-teal-950/30" },
  lab_test:    { label: "Lab Test",        icon: <FlaskConical className="w-4 h-4" />,  color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-950/30" },
};

type FilterKey = "all" | "donation" | "appointment" | "health_note";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "donation", label: "Donations" },
  { key: "appointment", label: "Appointments" },
  { key: "health_note", label: "Notes" },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function groupByDate(entries: TimelineEntry[]): { label: string; items: TimelineEntry[] }[] {
  const groups: Map<string, TimelineEntry[]> = new Map();
  for (const entry of entries) {
    const key = new Date(entry.date).toDateString();
    const existing = groups.get(key) ?? [];
    groups.set(key, [...existing, entry]);
  }
  return Array.from(groups.entries()).map(([key, items]) => ({
    label: formatDate(new Date(key).toISOString()),
    items,
  }));
}

export default function HealthTimeline() {
  const [, setLocation] = useLocation();
  const { profile } = useProfile();
  const { data: continuity, loading: continuityLoading } = useContinuity({ enabled: true });
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [addingNote, setAddingNote] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [viewMode, setViewMode] = useState<"unified" | "local">("unified");

  useEffect(() => {
    setEntries(getTimeline());
  }, []);

  const refresh = () => setEntries(getTimeline());

  const mergedEntries = useMemo(() => {
    if (viewMode === "local") return entries;
    const continuityEntries: TimelineEntry[] = [];
    if (continuity) {
      for (const a of continuity.appointments) {
        continuityEntries.push({
          id: `c-apt-${a.id}`,
          type: "appointment",
          date: a.date,
          title: a.doctorName,
          subtitle: a.doctorSpecialty,
          provider: a.clinicName,
          location: a.time,
          status: a.status as EntryStatus,
          notes: a.reason,
        });
      }
      for (const c of continuity.consultations) {
        continuityEntries.push({
          id: `c-con-${c.id}`,
          type: "encounter",
          date: c.date,
          title: "Consultation",
          subtitle: c.diagnosis,
          provider: c.doctorName,
          notes: c.notes,
          status: "completed",
        });
      }
      for (const p of continuity.prescriptions) {
        continuityEntries.push({
          id: `c-rx-${p.id}`,
          type: "prescription",
          date: p.date,
          title: `Prescription (${p.items.length} medicines)`,
          provider: p.doctorName,
          status: "completed",
          notes: p.items.map((m) => `${m.drugName} ${m.dosage}`).join(", "),
        });
      }
      for (const f of continuity.followUps) {
        continuityEntries.push({
          id: `c-fup-${f.id}`,
          type: "follow_up",
          date: f.recommendedDate,
          title: "Follow-Up",
          subtitle: f.reason,
          provider: f.doctorName,
          status: f.status as EntryStatus,
        });
      }
      for (const b of continuity.billing) {
        continuityEntries.push({
          id: `c-bil-${b.id}`,
          type: "report",
          date: b.date,
          title: `Payment: ₹${b.fee.toLocaleString("en-IN")}`,
          subtitle: b.status === "completed" ? "Paid" : `₹${b.pendingAmount.toLocaleString("en-IN")} pending`,
          status: b.status === "completed" ? "completed" : "pending",
        });
      }
    }
    const merged = [...entries, ...continuityEntries];
    return merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [entries, continuity, viewMode]);

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    addTimelineEntry({
      id: generateId(),
      type: "health_note",
      date: new Date().toISOString(),
      title: noteText.trim(),
      status: "completed",
    });
    setNoteText("");
    setAddingNote(false);
    refresh();
  };

  const handleRemove = (id: string) => {
    removeTimelineEntry(id);
    refresh();
  };

  const visible = viewMode === "local" ? entries : mergedEntries;
  const showContinuityLoading = viewMode === "unified" && continuityLoading && entries.length > 0;
  const filtered = filter === "all"
    ? visible
    : visible.filter(e => e.type === filter || (filter === "appointment" && (e.type === "appointment" || e.type === "follow_up" || e.type === "home_visit")));

  const grouped = groupByDate(filtered);

  if (!profile) return null;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background pb-24">

      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-4 border-b border-border">
        <button onClick={() => setLocation("/health")}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-muted hover:bg-muted/80">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">Health Timeline</h1>
          <p className="text-sm text-muted-foreground">Your personal health memory</p>
        </div>
      </div>

      {/* Filter + view mode */}
      <div className="flex items-center gap-2 px-5 py-3 overflow-x-auto border-b border-border">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filter === f.key
                ? "bg-primary text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}>
            {f.label}
          </button>
        ))}
        {continuity && (
          <button onClick={() => setViewMode(v => v === "unified" ? "local" : "unified")}
            className={`flex-shrink-0 ml-auto px-3 py-1.5 rounded-full text-[10px] font-semibold border transition-colors ${
              viewMode === "unified"
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-muted/40 text-muted-foreground border-border/60"
            }`}>
            {viewMode === "unified" ? "Connected" : "Local only"}
          </button>
        )}
      </div>

      {showContinuityLoading && (
        <div className="flex items-center justify-center gap-2 py-2 px-5 border-b border-border">
          <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-xs text-muted-foreground">Loading health data…</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-4">

        {/* Add note inline form */}
        <AnimatePresence>
          {addingNote && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden">
              <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground">Add Health Note</p>
                <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
                  placeholder="What happened today? Note a symptom, medication, or anything health-related…"
                  rows={3} autoFocus
                  className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                <div className="flex gap-2">
                  <button onClick={() => { setAddingNote(false); setNoteText(""); }}
                    className="flex-1 py-2.5 border border-border rounded-xl text-sm font-semibold text-muted-foreground">
                    Cancel
                  </button>
                  <button onClick={handleAddNote} disabled={!noteText.trim()}
                    className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1.5">
                    <Check className="w-4 h-4" /> Save Note
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4">
              <CalendarClock className="w-8 h-8 text-muted-foreground/30" />
            </div>
            <p className="text-base font-semibold text-foreground">Your health story starts here</p>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-[260px]">
              Donations, appointments, and health notes you add will appear in your timeline.
            </p>
            <button onClick={() => setAddingNote(true)}
              className="mt-5 px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-xl">
              Add First Note
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(({ label, items }) => (
              <div key={label}>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{label}</p>
                <div className="space-y-2.5 relative">
                  <div className="absolute left-[19px] top-3 bottom-3 w-0.5 bg-border" />
                  {items.map((entry, i) => {
                    const cfg = TYPE_CONFIG[entry.type];
                    return (
                      <motion.div key={entry.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                        className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 z-10 ${cfg.bg} ${cfg.color}`}>
                          {cfg.icon}
                        </div>
                        <div className="flex-1 bg-card border border-border rounded-2xl p-3.5 min-w-0">
                          <div className="flex items-start gap-2 justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${cfg.color}`}>
                                  {cfg.label}
                                </span>
                                {entry.status && (
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                    entry.status === "completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                    : entry.status === "cancelled" ? "bg-muted text-muted-foreground"
                                    : entry.status === "missed" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                  }`}>
                                    {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-semibold text-foreground mt-0.5 leading-snug">{entry.title}</p>
                              {entry.subtitle && <p className="text-xs text-muted-foreground mt-0.5">{entry.subtitle}</p>}
                              {entry.provider && <p className="text-xs text-muted-foreground mt-0.5">{entry.provider}</p>}
                              {entry.location && <p className="text-xs text-muted-foreground">{entry.location}</p>}
                              {entry.notes && <p className="text-xs text-muted-foreground mt-1 italic">"{entry.notes}"</p>}
                              {entry.is_placeholder && (
                                <p className="text-[10px] text-muted-foreground/60 mt-1">Placeholder — connect to provider for full record</p>
                              )}
                            </div>
                            {entry.type === "health_note" && (
                              <button onClick={() => handleRemove(entry.id)}
                                className="w-7 h-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* FAB */}
      {!addingNote && (
        <button onClick={() => setAddingNote(true)}
          className="fixed bottom-20 right-5 w-12 h-12 bg-primary text-white rounded-2xl shadow-lg shadow-primary/30 flex items-center justify-center z-40">
          <Plus className="w-5 h-5" />
        </button>
      )}

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 w-full max-w-[430px] bg-card/95 backdrop-blur-md border-t border-border flex justify-around py-3 pb-safe z-50">
        <Link href="/home" className="flex flex-col items-center gap-1 text-muted-foreground">
          <Heart className="w-5 h-5" /><span className="text-[10px] font-medium">Home</span>
        </Link>
        <Link href="/donate" className="flex flex-col items-center gap-1 text-muted-foreground">
          <Droplet className="w-5 h-5" /><span className="text-[10px] font-medium">Donate</span>
        </Link>
        <Link href="/requests" className="flex flex-col items-center gap-1 text-muted-foreground">
          <Activity className="w-5 h-5" /><span className="text-[10px] font-medium">Requests</span>
        </Link>
        <Link href="/profile" className="flex flex-col items-center gap-1 text-muted-foreground">
          <User className="w-5 h-5" /><span className="text-[10px] font-medium">Profile</span>
        </Link>
      </nav>
      <style dangerouslySetInnerHTML={{ __html: `.pb-safe { padding-bottom: calc(0.75rem + env(safe-area-inset-bottom)); }` }} />
    </div>
  );
}
