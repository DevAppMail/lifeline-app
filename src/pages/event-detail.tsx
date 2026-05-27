import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Calendar, MapPin, Users, Heart, Droplet, Activity, User,
  CheckCircle2, X,
} from "lucide-react";
import { useProfile } from "@/context/profile-context";

interface CommunityEvent {
  id: string;
  title: string;
  description?: string;
  event_type: string;
  date: string;
  location: string;
  registration_count: number;
}

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  blood_drive:  { label: "Blood Drive",  color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  health_camp:  { label: "Health Camp",  color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  ngo_campaign: { label: "NGO Campaign", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
};

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

export default function EventDetail() {
  const params = useParams<{ id: string }>();
  const { profile } = useProfile();

  const [event, setEvent] = useState<CommunityEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [userId, setUserId] = useState<number | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [checkingReg, setCheckingReg] = useState(true);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [formName, setFormName] = useState(profile?.name ?? "");
  const [formBloodGroup, setFormBloodGroup] = useState<string>(profile?.bloodGroup ?? "");
  const [submitting, setSubmitting] = useState(false);

  // Fetch event
  useEffect(() => {
    if (!params.id) return;
    fetch(`/api/events/${params.id}`)
      .then(async r => {
        if (r.status === 404) { setNotFound(true); return; }
        setEvent(await r.json());
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [params.id]);

  // Resolve numeric user ID
  useEffect(() => {
    if (!profile?.phone) { setCheckingReg(false); return; }
    (async () => {
      try {
        const r = await fetch(`/api/users/lookup?phone=${encodeURIComponent(profile.phone)}`);
        if (r.ok) { const d = await r.json(); setUserId(d.user?.id ?? null); }
      } catch { /* silent */ }
    })();
  }, [profile?.phone]);

  // Check if already registered once userId is known
  useEffect(() => {
    if (!userId || !params.id) { setCheckingReg(false); return; }
    (async () => {
      try {
        const r = await fetch(`/api/event-registrations?event_id=${params.id}&user_id=${userId}`);
        if (r.ok) {
          const data = await r.json();
          setIsRegistered(Array.isArray(data) && data.length > 0);
        }
      } catch { /* silent */ }
      setCheckingReg(false);
    })();
  }, [userId, params.id]);

  const handleRegister = useCallback(async () => {
    if (!params.id || !formName.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/event-registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: params.id,
          user_id: userId ?? undefined,
          name: formName.trim(),
          blood_group: formBloodGroup || undefined,
        }),
      });
      if (res.ok) {
        setIsRegistered(true);
        setSheetOpen(false);
        setEvent(prev => prev ? { ...prev, registration_count: prev.registration_count + 1 } : prev);
      }
    } catch { /* silent */ }
    setSubmitting(false);
  }, [params.id, userId, formName, formBloodGroup]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background">
        <div className="flex items-center gap-3 px-5 pt-12 pb-5 border-b border-border">
          <Link href="/events" className="w-10 h-10 rounded-full flex items-center justify-center bg-muted">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="h-6 w-40 bg-muted rounded-lg animate-pulse" />
        </div>
        <div className="px-5 pt-5 space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-card border border-border rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (notFound || !event) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-6 text-center">
        <Calendar className="w-12 h-12 text-muted-foreground/30 mb-4" />
        <p className="text-lg font-bold text-foreground">Event not found</p>
        <Link href="/events" className="mt-4 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-bold">
          Back to Events
        </Link>
      </div>
    );
  }

  const meta = TYPE_CONFIG[event.event_type] ?? { label: event.event_type, color: "bg-muted text-muted-foreground" };
  const eventDate = new Date(event.date);
  const isPast = eventDate < new Date();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-5 border-b border-border">
        <Link href="/events" className="w-10 h-10 rounded-full flex items-center justify-center bg-muted hover:bg-muted/80">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">{event.title}</h1>
          <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.color}`}>{meta.label}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-5 space-y-5">
        {/* Hero info card */}
        <div className="bg-primary rounded-2xl p-5 relative overflow-hidden shadow-lg shadow-primary/20">
          <div className="absolute -top-6 -right-6 w-28 h-28 bg-white/5 rounded-full" />
          <div className="relative z-10 space-y-3">
            <h2 className="text-xl font-bold text-white leading-snug">{event.title}</h2>
            {event.description && (
              <p className="text-white/75 text-sm leading-relaxed">{event.description}</p>
            )}
            <div className="flex items-center gap-2 text-white/80 text-sm">
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span>{eventDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
            </div>
            <div className="flex items-center gap-2 text-white/80 text-sm">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span>{event.location}</span>
            </div>
            <div className="flex items-center gap-2 text-white/80 text-sm">
              <Users className="w-4 h-4 flex-shrink-0" />
              <span>{event.registration_count} {event.registration_count === 1 ? "person" : "people"} registered</span>
            </div>
          </div>
        </div>

        {/* Registration CTA */}
        {isPast ? (
          <div className="bg-muted rounded-2xl p-4 text-center">
            <p className="text-sm font-semibold text-muted-foreground">This event has already passed</p>
          </div>
        ) : checkingReg ? (
          <div className="h-12 bg-card border border-border rounded-2xl animate-pulse" />
        ) : isRegistered ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-emerald-50 dark:bg-emerald-950/20 border-2 border-emerald-300 dark:border-emerald-700 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">You're registered!</p>
              <p className="text-xs text-emerald-600/80 dark:text-emerald-400/70 mt-0.5">We'll see you at the event.</p>
            </div>
          </motion.div>
        ) : (
          <button
            onClick={() => setSheetOpen(true)}
            className="w-full h-12 bg-primary text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
          >
            <Heart className="w-5 h-5" />
            Register for this Event
          </button>
        )}
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 w-full max-w-[430px] bg-card/95 backdrop-blur-md border-t border-border flex justify-around py-3 pb-safe z-50">
        <Link href="/home" className="flex flex-col items-center gap-1 text-muted-foreground"><Heart className="w-5 h-5" /><span className="text-[10px] font-medium">Home</span></Link>
        <Link href="/donate" className="flex flex-col items-center gap-1 text-muted-foreground"><Droplet className="w-5 h-5" /><span className="text-[10px] font-medium">Donate</span></Link>
        <Link href="/requests" className="flex flex-col items-center gap-1 text-muted-foreground"><Activity className="w-5 h-5" /><span className="text-[10px] font-medium">Requests</span></Link>
        <Link href="/profile" className="flex flex-col items-center gap-1 text-muted-foreground"><User className="w-5 h-5" /><span className="text-[10px] font-medium">Profile</span></Link>
      </nav>
      <style dangerouslySetInnerHTML={{ __html: `.pb-safe { padding-bottom: calc(0.75rem + env(safe-area-inset-bottom)); }` }} />

      {/* Registration Bottom Sheet */}
      <AnimatePresence>
        {sheetOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end"
            onClick={e => { if (e.target === e.currentTarget) setSheetOpen(false); }}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="bg-card w-full rounded-t-3xl p-6 pb-10 shadow-2xl">
              <div className="w-10 h-1 bg-muted-foreground/20 rounded-full mx-auto mb-5" />
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Register</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[240px]">{event.title}</p>
                </div>
                <button onClick={() => setSheetOpen(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Full Name *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="Your name"
                    className="w-full h-11 px-4 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>

                {!profile?.bloodGroup && (
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Blood Group <span className="font-normal">(optional)</span></label>
                    <div className="grid grid-cols-4 gap-2">
                      {BLOOD_GROUPS.map(bg => (
                        <button key={bg} onClick={() => setFormBloodGroup(formBloodGroup === bg ? "" : bg)}
                          className={`h-10 rounded-xl text-sm font-bold border-2 transition-all ${
                            formBloodGroup === bg ? "bg-primary text-white border-primary" : "bg-card border-border text-foreground"
                          }`}>
                          {bg}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleRegister}
                  disabled={!formName.trim() || submitting}
                  className="w-full h-12 bg-primary text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
                >
                  {submitting
                    ? <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    : <><CheckCircle2 className="w-5 h-5" /> Confirm Registration</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
