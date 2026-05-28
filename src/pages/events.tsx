import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ChevronLeft, Calendar, MapPin, CheckCircle2, Clock,
} from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { useProfile } from "@/context/profile-context";
import type { CommunityEvent } from "@/types/events";
import { TYPE_CONFIG, RSVP_LABELS } from "@/types/events";
import { getParticipations } from "@/lib/participation-store";
import { processAttendanceMemory } from "@/lib/attendance-memory";

const FILTERS = ["All", "Blood Drive", "Health Camp", "NGO Campaign"] as const;
type Filter = typeof FILTERS[number];

const FILTER_TYPE: Record<Filter, string | null> = {
  "All":           null,
  "Blood Drive":   "blood_drive",
  "Health Camp":   "health_camp",
  "NGO Campaign":  "ngo_campaign",
};

export default function Events() {
  const { profile } = useProfile();
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("All");
  const [participations, setParticipations] = useState(() => getParticipations());

  useEffect(() => {
    fetch("/api/events")
      .then(r => r.json())
      .then((data: CommunityEvent[]) => {
        const now = new Date();
        setEvents(data.filter(e => new Date(e.date) >= now));
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  // Process attendance memory on load
  useEffect(() => {
    if (profile?.lifeline_id && profile?.name) {
      processAttendanceMemory(profile.lifeline_id, profile.name);
    }
  }, [profile?.lifeline_id, profile?.name]);

  // Refresh participations periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setParticipations(getParticipations());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const filtered = filter === "All"
    ? events
    : events.filter(e => e.event_type === FILTER_TYPE[filter]);

  function getEventRsvp(eventId: string) {
    return participations.find(p => p.eventId === eventId);
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background pb-24">
      {/* Header */}
      <div className="bg-primary px-5 pt-12 pb-5 rounded-b-[2rem] shadow-md shadow-primary/20">
        <div className="flex items-center gap-3">
          <Link href="/home" className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center text-white flex-shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Community Events</h1>
            <p className="text-white/70 text-sm mt-0.5">Blood drives, health camps & more</p>
          </div>
        </div>
      </div>

      {/* Filter chips */}
      <div className="px-5 pt-4 pb-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                filter === f ? "bg-primary text-white" : "bg-muted text-muted-foreground"
              }`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Events list */}
      <div className="flex-1 overflow-y-auto px-5 pt-2 space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-4 h-28 animate-pulse" />
          ))
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4">
              <Calendar className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <p className="text-base font-semibold text-foreground">No upcoming events</p>
            <p className="text-sm text-muted-foreground mt-1.5">Check back soon for community events near you.</p>
          </div>
        ) : (
          filtered.map((event, i) => {
            const meta = TYPE_CONFIG[event.event_type] ?? { label: event.event_type, color: "bg-muted text-muted-foreground" };
            const d = new Date(event.date);
            const rsvp = getEventRsvp(event.id);
            const hasRsvp = rsvp && rsvp.rsvpStatus !== "cancelled";
            return (
              <motion.div key={event.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Link href={`/events/${event.id}`} className="block">
                  <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <span className={`inline-flex text-[10px] font-bold px-2.5 py-0.5 rounded-full ${meta.color}`}>{meta.label}</span>
                      <div className="flex items-center gap-1.5">
                        {hasRsvp && (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            rsvp!.rsvpStatus === "attending"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                          }`}>
                            {rsvp!.rsvpStatus === "attending"
                              ? <CheckCircle2 className="w-3 h-3" />
                              : <Clock className="w-3 h-3" />}
                            {RSVP_LABELS[rsvp!.rsvpStatus]}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                    <h3 className="text-base font-bold text-foreground leading-snug">{event.title}</h3>
                    {event.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{event.description}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{event.location}</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })
        )}
      </div>

      <BottomNav />
    </div>
  );
}
