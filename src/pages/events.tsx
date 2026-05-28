import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ChevronLeft, Calendar, MapPin, Heart, Droplet, Activity, User,
} from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";

interface CommunityEvent {
  id: string;
  title: string;
  description?: string;
  event_type: string;
  date: string;
  location: string;
}

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  blood_drive:  { label: "Blood Drive",  color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  health_camp:  { label: "Health Camp",  color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  ngo_campaign: { label: "NGO Campaign", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
};

const FILTERS = ["All", "Blood Drive", "Health Camp", "NGO Campaign"] as const;
type Filter = typeof FILTERS[number];

const FILTER_TYPE: Record<Filter, string | null> = {
  "All":           null,
  "Blood Drive":   "blood_drive",
  "Health Camp":   "health_camp",
  "NGO Campaign":  "ngo_campaign",
};

export default function Events() {
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("All");

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

  const filtered = filter === "All"
    ? events
    : events.filter(e => e.event_type === FILTER_TYPE[filter]);

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
            return (
              <motion.div key={event.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Link href={`/events/${event.id}`} className="block">
                  <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <span className={`inline-flex text-[10px] font-bold px-2.5 py-0.5 rounded-full ${meta.color}`}>{meta.label}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
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
