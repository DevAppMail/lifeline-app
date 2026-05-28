import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Calendar, MapPin, Users, Heart, CheckCircle2, X,
  AlertCircle, Clock,
} from "lucide-react";
import { useProfile } from "@/context/profile-context";
import { BottomNav } from "@/components/bottom-nav";
import { useParticipation } from "@/hooks/useParticipation";
import type { CommunityEvent, RsvpStatus } from "@/types/events";
import { TYPE_CONFIG, RSVP_LABELS } from "@/types/events";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

export default function EventDetail() {
  const params = useParams<{ id: string }>();
  const { profile } = useProfile();

  const [event, setEvent] = useState<CommunityEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [userId, setUserId] = useState<number | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [formName, setFormName] = useState(profile?.name ?? "");
  const [formBloodGroup, setFormBloodGroup] = useState<string>(profile?.bloodGroup ?? "");
  const [formRsvp, setFormRsvp] = useState<RsvpStatus>("attending");
  const [submitting, setSubmitting] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const { participation, loading: partLoading, syncing, rsvp, syncFromApi } = useParticipation(params.id);

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

  // Resolve numeric user ID and sync participation
  useEffect(() => {
    if (!profile?.phone) return;
    (async () => {
      try {
        const r = await fetch(`/api/users/lookup?phone=${encodeURIComponent(profile.phone)}`);
        if (r.ok) { const d = await r.json(); setUserId(d.user?.id ?? null); }
      } catch { /* silent */ }
    })();
  }, [profile?.phone]);

  useEffect(() => {
    if (userId && params.id) {
      syncFromApi(userId);
    }
  }, [userId, params.id, syncFromApi]);

  const handleRegister = useCallback(async () => {
    if (!params.id || !formName.trim()) return;
    setSubmitting(true);
    const ok = await rsvp(formRsvp, event?.title, event?.date);
    if (ok) {
      setSheetOpen(false);
      setEvent(prev => prev ? { ...prev, registration_count: prev.registration_count + 1 } : prev);
    }
    setSubmitting(false);
  }, [params.id, formName, formRsvp, rsvp, event?.title, event?.date]);

  const handleCancelRsvp = useCallback(async () => {
    if (!params.id) return;
    setSubmitting(true);
    await rsvp("cancelled");
    setConfirmCancel(false);
    setSubmitting(false);
  }, [params.id, rsvp]);

  const handleRejoin = useCallback(async () => {
    if (!params.id) return;
    setSubmitting(true);
    await rsvp("attending", event?.title, event?.date);
    setSubmitting(false);
  }, [params.id, rsvp, event?.title, event?.date]);

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
  const isToday = eventDate.toDateString() === new Date().toDateString();

  const currentStatus = participation?.rsvpStatus;
  const hasRsvp = !!currentStatus && currentStatus !== "cancelled";

  function renderRsvpState() {
    if (isPast) {
      return (
        <div className="bg-muted rounded-2xl p-4 text-center">
          <p className="text-sm font-semibold text-muted-foreground">This event has already passed</p>
        </div>
      );
    }

    if (partLoading) {
      return <div className="h-12 bg-card border border-border rounded-2xl animate-pulse" />;
    }

    if (hasRsvp && currentStatus === "attending") {
      return (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-emerald-50 dark:bg-emerald-950/20 border-2 border-emerald-300 dark:border-emerald-700 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">You're attending!</p>
                <p className="text-xs text-emerald-600/80 dark:text-emerald-400/70 mt-0.5">
                  {isToday ? "Happening today — see you there!" : "We'll send you a reminder."}
                </p>
              </div>
            </div>
            <button
              onClick={() => setConfirmCancel(true)}
              disabled={submitting}
              className="text-xs text-muted-foreground font-semibold px-3 py-1.5 rounded-lg hover:bg-muted/50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      );
    }

    if (currentStatus === "interested") {
      return (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-300 dark:border-amber-700 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-700 dark:text-amber-400">You're interested</p>
                <p className="text-xs text-amber-600/80 dark:text-amber-400/70 mt-0.5">Confirm to secure your spot.</p>
              </div>
            </div>
            <button
              onClick={() => rsvp("attending", event!.title, event!.date)}
              disabled={syncing}
              className="bg-primary text-white text-xs font-bold px-4 py-1.5 rounded-lg"
            >
              Confirm
            </button>
          </div>
        </motion.div>
      );
    }

    if (currentStatus === "cancelled") {
      return (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-muted/50 border-2 border-border rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center flex-shrink-0">
                <X className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-bold text-muted-foreground">Registration cancelled</p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">Changed your mind?</p>
              </div>
            </div>
            <button
              onClick={handleRejoin}
              disabled={syncing}
              className="bg-primary text-white text-xs font-bold px-4 py-1.5 rounded-lg"
            >
              Rejoin
            </button>
          </div>
        </motion.div>
      );
    }

    return (
      <button
        onClick={() => { setFormRsvp("attending"); setSheetOpen(true); }}
        className="w-full h-12 bg-primary text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
      >
        <Heart className="w-5 h-5" />
        Register for this Event
      </button>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-5 border-b border-border">
        <Link href="/events" className="w-10 h-10 rounded-full flex items-center justify-center bg-muted hover:bg-muted/80">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">{event!.title}</h1>
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

        {/* RSVP counts */}
        {event.rsvp_counts && (
          <div className="grid grid-cols-3 gap-2">
            {(["attending", "interested", "attended"] as const).map(key => {
              const count = event.rsvp_counts![key];
              if (count === 0) return null;
              return (
                <div key={key} className="bg-card border border-border rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-foreground">{count}</p>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{RSVP_LABELS[key]}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Registration CTA */}
        {renderRsvpState()}
      </div>

      <BottomNav />

      {/* Cancel confirmation */}
      <AnimatePresence>
        {confirmCancel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end"
            onClick={e => { if (e.target === e.currentTarget) setConfirmCancel(false); }}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="bg-card w-full rounded-t-3xl p-6 pb-10 shadow-2xl">
              <div className="w-10 h-1 bg-muted-foreground/20 rounded-full mx-auto mb-5" />
              <div className="text-center mb-5">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <X className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-foreground">Cancel registration?</h3>
                <p className="text-sm text-muted-foreground mt-1">You can rejoin anytime before the event.</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmCancel(false)}
                  className="flex-1 h-11 bg-muted text-foreground rounded-xl font-bold text-sm"
                >
                  Keep registration
                </button>
                <button
                  onClick={handleCancelRsvp}
                  disabled={submitting}
                  className="flex-1 h-11 bg-red-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                >
                  {submitting ? <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" /> : "Cancel"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

                {/* RSVP preference */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-2">Your commitment</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setFormRsvp("attending")}
                      className={`h-11 rounded-xl text-sm font-bold border-2 transition-all flex items-center justify-center gap-1.5 ${
                        formRsvp === "attending" ? "bg-emerald-500 text-white border-emerald-500" : "bg-card border-border text-foreground"
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Attending
                    </button>
                    <button
                      onClick={() => setFormRsvp("interested")}
                      className={`h-11 rounded-xl text-sm font-bold border-2 transition-all flex items-center justify-center gap-1.5 ${
                        formRsvp === "interested" ? "bg-amber-500 text-white border-amber-500" : "bg-card border-border text-foreground"
                      }`}
                    >
                      <Clock className="w-4 h-4" />
                      Interested
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    {formRsvp === "attending"
                      ? "You're committed to attend. We'll send a reminder."
                      : "You're interested but haven't confirmed yet."}
                  </p>
                </div>

                <button
                  onClick={handleRegister}
                  disabled={!formName.trim() || submitting}
                  className="w-full h-12 bg-primary text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
                >
                  {submitting
                    ? <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    : <><Heart className="w-5 h-5" /> {formRsvp === "interested" ? "Save Interest" : "Confirm Registration"}</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
