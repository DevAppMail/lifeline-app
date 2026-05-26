import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarClock, ChevronDown, ChevronUp } from "lucide-react";
import type { PatientContinuity, NormalizedContinuityEvent, ContinuityEntityType } from "@/types/continuity";
import { normalizeContinuityFeed, groupByDate, timelineEventsToContinuity } from "@/lib/continuity-utils";
import { ContinuityEventCard } from "./continuity-cards";

const FILTERS: { key: ContinuityEntityType | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "appointment", label: "Visits" },
  { key: "prescription", label: "Rx" },
  { key: "follow_up", label: "Follow-ups" },
  { key: "billing", label: "Payments" },
];

interface ContinuityTimelineProps {
  continuity: PatientContinuity;
  loading?: boolean;
  compact?: boolean;
  initialLimit?: number;
}

function TimelineSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-2xl p-4 h-[88px] animate-pulse" />
      ))}
    </div>
  );
}

function TimelineEmpty({ compact }: { compact: boolean }) {
  if (compact) return null;
  return (
    <div className="flex flex-col items-center py-10 text-center px-4">
      <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mb-3">
        <CalendarClock className="w-7 h-7 text-muted-foreground/30" />
      </div>
      <p className="text-sm font-semibold text-foreground">Your health timeline</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
        Appointments, consultations, and prescriptions will appear here once you book with a doctor.
      </p>
    </div>
  );
}

export function ContinuityTimeline({
  continuity,
  loading = false,
  compact = false,
  initialLimit = compact ? 3 : 20,
}: ContinuityTimelineProps) {
  const [filter, setFilter] = useState<ContinuityEntityType | "all">("all");
  const [showAll, setShowAll] = useState(false);

  const events = useMemo(() => normalizeContinuityFeed(continuity), [continuity]);
  const filtered = useMemo(() => timelineEventsToContinuity(events, filter), [events, filter]);

  const displayLimit = showAll ? filtered.length : initialLimit;
  const displayEvents = filtered.slice(0, displayLimit);
  const grouped = groupByDate(displayEvents);
  const hasMore = filtered.length > displayLimit;

  if (loading) return <TimelineSkeleton count={compact ? 2 : 4} />;
  if (events.length === 0) return <TimelineEmpty compact={compact} />;

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => { setFilter(f.key); setShowAll(false); }}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                filter === f.key
                  ? "bg-primary text-white border-primary"
                  : "bg-muted/40 text-muted-foreground border-border/60 hover:border-primary/30"
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-5">
        {grouped.map(({ label, items }) => (
          <div key={label}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5 flex items-center gap-2">
              <span className="flex-1 h-px bg-border" />
              {label}
              <span className="flex-1 h-px bg-border" />
            </p>
            <div className="space-y-2.5">
              {items.map((event, i) => (
                <motion.div key={event.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <ContinuityEventCard event={event} />
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <button onClick={() => setShowAll(!showAll)}
          className="w-full py-3 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-1.5">
          {showAll ? (
            <>Show Less <ChevronUp className="w-4 h-4" /></>
          ) : (
            <>Show {filtered.length - displayLimit} More <ChevronDown className="w-4 h-4" /></>
          )}
        </button>
      )}
    </div>
  );
}
