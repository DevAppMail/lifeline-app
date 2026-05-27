import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Droplet, Heart, Activity, User, MapPin,
  Stethoscope, HeartPulse, ChevronLeft, ChevronRight,
  Building2, Flame, Star, Trophy, Sparkles, TrendingUp, ArrowRight, Calendar,
  X, ExternalLink, Bell, BellRing,
} from "lucide-react";
import { useProfile } from "@/context/profile-context";
import { getSeenIds } from "@/lib/commitments";
import { useContinuity } from "@/hooks/useContinuity";
import { useReminders } from "@/hooks/useReminders";
import { CommitmentStrip } from "@/components/commitment-strip";
import { ContinuitySummary, ContinuityTimeline } from "@/components/continuity";

// ── Ad Types ──────────────────────────────────────────────────────────────────

interface LiveAd {
  id: string;
  title: string;
  description: string | null;
  banner_url: string;
  cta_type: string;
  cta_url: string | null;
  is_sponsored: boolean;
}

interface DefaultBanner {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  cta_url: string | null;
}

// Static fallback shown only when both API ads and default_banners are empty
const STATIC_FALLBACK = [
  {
    label: "Health Camp",
    bg: "from-primary to-red-800",
    icon: <Stethoscope className="w-16 h-16 text-white/25" />,
    title: "Free Health Camp",
    sub: "Blood tests, BP check & more — join us this Sunday",
    cta: "Register Free",
  },
  {
    label: "NGO Drive",
    bg: "from-red-700 to-rose-900",
    icon: <Heart className="w-16 h-16 text-white/25 fill-white/15" />,
    title: "NGO Donation Drive",
    sub: "Give the gift of life. Camps across 20 Indian cities.",
    cta: "Find Nearest Camp",
  },
  {
    label: "Hospital Partner",
    bg: "from-rose-800 to-primary",
    icon: <Building2 className="w-16 h-16 text-white/25" />,
    title: "Apollo × LifeLine",
    sub: "Priority access & fast-track matching for registered donors.",
    cta: "Learn More",
  },
];

// ── Registration Modal ────────────────────────────────────────────────────────

interface RegModalProps {
  adId: string;
  prefillName: string;
  prefillPhone: string;
  prefillBloodGroup: string;
  prefillCity: string;
  onClose: () => void;
}

function RegistrationModal({ adId, prefillName, prefillPhone, prefillBloodGroup, prefillCity, onClose }: RegModalProps) {
  const [name, setName] = useState(prefillName);
  const [phone, setPhone] = useState(prefillPhone);
  const [bloodGroup, setBloodGroup] = useState(prefillBloodGroup);
  const [city, setCity] = useState(prefillCity);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const submit = async () => {
    if (!name.trim() || !phone.trim()) return;
    setSubmitting(true);
    try {
      await fetch("/api/ad-registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ad_id: adId, user_name: name, user_phone: phone, blood_group: bloodGroup, city }),
      });
      setSuccess(true);
    } catch { /* silent */ } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="relative z-10 w-full max-w-[430px] bg-background rounded-t-3xl shadow-xl p-6 pb-safe"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-muted text-muted-foreground">
          <X className="w-4 h-4" />
        </button>

        {success ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="w-7 h-7 text-emerald-600 fill-emerald-600" />
            </div>
            <h3 className="text-lg font-bold text-foreground">You're registered!</h3>
            <p className="text-sm text-muted-foreground mt-1">The organizer will contact you soon.</p>
            <button onClick={onClose}
              className="mt-5 w-full py-2.5 bg-primary text-white text-sm font-semibold rounded-xl">
              Done
            </button>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-bold text-foreground mb-4">Register for this event</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Full Name *</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Phone *</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} type="tel"
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Blood Group</label>
                  <input value={bloodGroup} onChange={e => setBloodGroup(e.target.value)}
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">City</label>
                  <input value={city} onChange={e => setCity(e.target.value)}
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
            </div>
            <button onClick={submit} disabled={submitting || !name.trim() || !phone.trim()}
              className="mt-5 w-full py-2.5 bg-primary text-white text-sm font-semibold rounded-xl disabled:opacity-60 transition-opacity">
              {submitting ? "Submitting…" : "Register Now"}
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}

const ACTIONS = [
  { label: "Request Blood", icon: <Droplet className="w-6 h-6" />, color: "bg-primary text-white", accent: "bg-white/20", href: "/request-blood" },
  { label: "I'm Available to Donate", icon: <Heart className="w-6 h-6 fill-current" />, color: "bg-rose-100 text-primary dark:bg-primary/20", accent: "bg-primary/10", href: "/donate" },
  { label: "Book Doctor", icon: <Stethoscope className="w-6 h-6" />, color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200", accent: "bg-slate-200/50", href: "/book-doctor" },
  { label: "My Health", icon: <HeartPulse className="w-6 h-6" />, color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", accent: "bg-emerald-100/50", href: "/health" },
];

type BadgeTier = { label: string; color: string; icon: React.ReactNode };
function getBadgeTier(count: number): BadgeTier {
  if (count === 0)  return { label: "New Donor",      color: "bg-white/15 text-white/90",       icon: <Sparkles className="w-3 h-3" /> };
  if (count <= 3)   return { label: "Active Donor",   color: "bg-blue-400/25 text-blue-100",    icon: <TrendingUp className="w-3 h-3" /> };
  if (count <= 10)  return { label: "Verified Hero",  color: "bg-emerald-400/25 text-emerald-100", icon: <Star className="w-3 h-3" /> };
  return               { label: "Lifesaver Elite", color: "bg-amber-400/25 text-amber-100",  icon: <Trophy className="w-3 h-3" /> };
}

// ── Activity Feed ─────────────────────────────────────────────────────────────

interface ActivityBloodRequest {
  id: number;
  patient_name: string;
  blood_group: string;
  hospital_name: string;
  hospital_location: string;
  request_tier: string;
  created_at: string;
}

interface ActivityDonation {
  id: number;
  hospital_name: string;
  patient_first_name: string;
  status: string;
  created_at: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ActivityFeed({ profile }: { profile: NonNullable<ReturnType<typeof useProfile>["profile"]> }) {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<ActivityBloodRequest[]>([]);
  const [donations, setDonations] = useState<ActivityDonation[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      let userId: number | null = null;
      if (profile.phone) {
        try {
          const r = await fetch(`/api/users/lookup?phone=${encodeURIComponent(profile.phone)}`);
          if (r.ok) { const d = await r.json(); userId = d.user?.id ?? null; }
        } catch { /* silent */ }
      }

      const [reqRes, donRes] = await Promise.allSettled([
        fetch("/api/blood-requests?status=pending").then(r => r.json()),
        userId
          ? fetch(`/api/donation-confirmations?donor_user_id=${userId}`).then(r => r.json())
          : Promise.resolve([]),
      ]);

      if (cancelled) return;
      if (reqRes.status === "fulfilled") {
        setRequests(
          (reqRes.value as ActivityBloodRequest[])
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 3)
        );
      }
      if (donRes.status === "fulfilled") {
        setDonations(
          (donRes.value as ActivityDonation[])
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 2)
        );
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [profile.phone]);

  type ActivityItem =
    | { kind: "request"; data: ActivityBloodRequest }
    | { kind: "donation"; data: ActivityDonation };

  const items: ActivityItem[] = [
    ...requests.map(r => ({ kind: "request" as const, data: r })),
    ...donations.map(d => ({ kind: "donation" as const, data: d })),
  ].sort((a, b) => new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime());

  if (loading) {
    return (
      <section className="pb-2">
        <h2 className="text-base font-bold text-foreground mb-3">Recent Activity</h2>
        <div className="space-y-2.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-card border border-border rounded-2xl p-4 h-[72px] animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="pb-2">
        <h2 className="text-base font-bold text-foreground mb-3">Recent Activity</h2>
        <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center text-center gap-2">
          <Activity className="w-8 h-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">No recent activity</p>
        </div>
      </section>
    );
  }

  return (
    <section className="pb-2">
      <h2 className="text-base font-bold text-foreground mb-3">Recent Activity</h2>
      <div className="space-y-2.5">
        {items.map((item, i) => {
          if (item.kind === "request") {
            const req = item.data;
            const tierBadge =
              req.request_tier === "critical" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
              : req.request_tier === "urgent" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
              : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
            const tierLabel = req.request_tier === "critical" ? "Emergency" : req.request_tier === "urgent" ? "Urgent" : "Pending";
            return (
              <motion.div key={`req-${req.id}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                <Link href={`/requests/${req.id}`} className="block">
                  <div className="bg-card border border-border rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                    <div className="mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/10 text-primary">
                      <Droplet className="w-4 h-4 fill-primary/30" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug text-foreground">{req.patient_name.split(" ")[0]} needs {req.blood_group} blood</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{req.hospital_name} · {req.hospital_location}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(req.created_at)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tierBadge}`}>{tierLabel}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          }
          const don = item.data;
          const statusBadge =
            don.status === "confirmed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
            : don.status === "no_show" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
            : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
          const statusLabel = don.status === "confirmed" ? "Confirmed" : don.status === "no_show" ? "No Show" : "Awaiting";
          return (
            <motion.div key={`don-${don.id}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <Link href="/donate" className="block">
                <div className="bg-card border border-border rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                  <div className="mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-500/10 text-emerald-600">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug text-foreground">Your donation at {don.hospital_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">For {don.patient_first_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(don.created_at)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadge}`}>{statusLabel}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

// ── Community Events Preview ──────────────────────────────────────────────────

interface CommunityEvent {
  id: string;
  title: string;
  event_type: string;
  date: string;
  location: string;
}

const EVENT_TYPE_META: Record<string, { label: string; color: string }> = {
  blood_drive:  { label: "Blood Drive",   color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  health_camp:  { label: "Health Camp",   color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  ngo_campaign: { label: "NGO Campaign",  color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
};

function EventsPreview() {
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/events")
      .then(r => r.json())
      .then((data: CommunityEvent[]) => {
        const now = new Date();
        setEvents(data.filter(e => new Date(e.date) >= now).slice(0, 3));
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-foreground">Community Events</h2>
        <Link href="/events" className="text-xs font-semibold text-primary">See all</Link>
      </div>
      {loading ? (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {[1, 2].map(i => <div key={i} className="flex-shrink-0 w-52 h-28 bg-card border border-border rounded-2xl animate-pulse" />)}
        </div>
      ) : events.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-5 text-center">
          <p className="text-sm text-muted-foreground">No upcoming events</p>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {events.map(event => {
            const meta = EVENT_TYPE_META[event.event_type] ?? { label: event.event_type, color: "bg-muted text-muted-foreground" };
            const d = new Date(event.date);
            return (
              <Link key={event.id} href={`/events/${event.id}`} className="block flex-shrink-0 w-52">
                <div className="bg-card border border-border rounded-2xl p-4 h-full">
                  <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.color}`}>{meta.label}</span>
                  <p className="text-sm font-bold text-foreground mt-2 leading-tight line-clamp-2">{event.title}</p>
                  <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3 flex-shrink-0" />
                    {d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 flex-shrink-0" />{event.location}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function getProfileCompletion(profile: NonNullable<ReturnType<typeof useProfile>["profile"]>): number {
  const fields = [profile.name, profile.gender, profile.age !== "", profile.city, profile.bloodGroup, profile.donatedBefore !== null, profile.hasHealthIssues !== null, profile.phone];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

function useGeoCity() {
  const [city, setCity] = useState<string | null>(null);
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`);
          const data = await res.json();
          setCity(data.address?.city || data.address?.town || data.address?.village || null);
        } catch { setCity(null); }
      },
      () => setCity(null),
      { timeout: 5000 }
    );
  }, []);
  return city;
}

function useRequestsBadge(bloodGroup: string) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/blood-requests?status=pending");
        const data = await res.json();
        const seen = getSeenIds();
        const matching = (data as any[]).filter(
          (r) => r.blood_group === bloodGroup && !seen.includes(r.id)
        );
        setCount(matching.length);
      } catch { setCount(0); }
    }
    if (bloodGroup) load();
  }, [bloodGroup]);
  return count;
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { profile, isLoading } = useProfile();
  const geoCity = useGeoCity();
  const [adIndex, setAdIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Dynamic ad data
  const [liveAds, setLiveAds] = useState<LiveAd[]>([]);
  const [defaultBanners, setDefaultBanners] = useState<DefaultBanner[]>([]);
  const [adsLoaded, setAdsLoaded] = useState(false);
  const [regModalAdId, setRegModalAdId] = useState<string | null>(null);

  const totalAdCount = liveAds.length > 0 ? liveAds.length
    : defaultBanners.length > 0 ? defaultBanners.length
    : STATIC_FALLBACK.length;

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setAdIndex((i) => (i + 1) % totalAdCount), 4000);
  }, [totalAdCount]);

  useEffect(() => { resetTimer(); return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, [resetTimer]);
  useEffect(() => { if (!isLoading && !profile) setLocation("/onboarding"); }, [profile, isLoading, setLocation]);

  // Fetch live ads on mount
  useEffect(() => {
    fetch("/api/ads/live")
      .then(r => r.json())
      .then((data: { ads: LiveAd[]; default_banners: DefaultBanner[] }) => {
        setLiveAds(data.ads ?? []);
        setDefaultBanners(data.default_banners ?? []);
      })
      .catch(() => { /* fall through to static fallback */ })
      .finally(() => setAdsLoaded(true));
  }, []);

  // Fire impression when ad index changes (only for dynamic ads)
  useEffect(() => {
    if (!adsLoaded || liveAds.length === 0) return;
    const ad = liveAds[adIndex];
    if (!ad) return;
    fetch("/api/ad-analytics/impression", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ad_id: ad.id }),
    }).catch(() => { /* silent */ });
  }, [adIndex, adsLoaded, liveAds]);

  const handleAdCta = (ad: LiveAd) => {
    fetch("/api/ad-analytics/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ad_id: ad.id }),
    }).catch(() => { /* silent */ });

    if (ad.cta_type === "register_form") {
      setRegModalAdId(ad.id);
    } else if (ad.cta_type === "external_url" && ad.cta_url) {
      window.open(ad.cta_url, "_blank", "noopener,noreferrer");
    } else if (ad.cta_type === "in_app_page" && ad.cta_url) {
      setLocation(ad.cta_url);
    }
  };

  const requestsBadge = useRequestsBadge(profile?.bloodGroup ?? "");
  const { data: continuity, loading: continuityLoading } = useContinuity({ enabled: true });
  const { unreadCount: reminderCount } = useReminders(continuity);

  if (isLoading || !profile) return null;

  const firstName = profile.name.split(" ")[0];
  const displayCity = geoCity || profile.city;
  const donations = profile.donationCount ?? 0;
  const streak = profile.streakMonths ?? 0;
  const lives = donations * 3;
  const badge = getBadgeTier(donations);
  const completion = getProfileCompletion(profile);

  const goAd = (dir: 1 | -1) => { setAdIndex((i) => (i + dir + totalAdCount) % totalAdCount); resetTimer(); };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background pb-20 relative">

      {/* ── TOP HERO CARD ── */}
      <div className="relative bg-primary px-5 pt-12 pb-6 overflow-hidden rounded-b-[2.5rem] shadow-lg shadow-primary/20">
        <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/5 rounded-full" />
        <div className="absolute top-4 right-10 w-20 h-20 bg-white/5 rounded-full" />
        <div className="absolute -bottom-6 -left-6 w-28 h-28 bg-white/5 rounded-full" />

        <div className="relative z-10">
          {/* Greeting + badge tier */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <p className="text-white/70 text-sm font-medium">Good day,</p>
              <h1 className="text-3xl font-bold text-white mt-0.5 leading-tight">Hello, {firstName}! 👋</h1>
              <div className="flex items-center gap-1.5 mt-1.5">
                <MapPin className="w-3.5 h-3.5 text-white/60" />
                <span className="text-white/70 text-xs font-medium">{displayCity || "Detecting location…"}</span>
              </div>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${badge.color} border border-white/20 mt-1 flex-shrink-0`}>
              {badge.icon}
              {badge.label}
            </div>
            <a href="/notifications" className="relative mt-1 flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors">
                {reminderCount > 0 ? <BellRing className="w-5 h-5 text-white" /> : <Bell className="w-5 h-5 text-white/70" />}
              </div>
              {reminderCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-primary">
                  {reminderCount > 9 ? "9+" : reminderCount}
                </span>
              )}
            </a>
          </div>

          {/* Stats strip — always visible */}
          {donations > 0 ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="grid grid-cols-3 gap-2">
              {[
                { icon: <Droplet className="w-4 h-4 fill-current" />, value: donations, label: "Donations" },
                { icon: <Heart className="w-4 h-4 fill-current" />, value: lives, label: "Lives Impacted" },
                { icon: <Flame className="w-4 h-4" />, value: `${streak}mo`, label: "Streak" },
              ].map((stat) => (
                <div key={stat.label} className="bg-white/10 rounded-2xl px-3 py-3 flex flex-col items-center gap-1 border border-white/10">
                  <div className="text-white/70">{stat.icon}</div>
                  <span className="text-white font-bold text-lg leading-none">{stat.value}</span>
                  <span className="text-white/55 text-[10px] font-medium text-center leading-tight">{stat.label}</span>
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
              className="bg-white/10 rounded-2xl p-4 border border-white/15 flex items-center gap-4">
              <div className="flex-1">
                <p className="text-white font-semibold text-sm">Make your first donation</p>
                <p className="text-white/65 text-xs mt-1 leading-relaxed">Start your journey and save up to 3 lives.</p>
              </div>
              <Link href="/requests"
                className="flex items-center gap-1.5 bg-white text-primary rounded-xl px-3 py-2 text-xs font-bold flex-shrink-0">
                Find Request <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </motion.div>
          )}
        </div>
      </div>

      <CommitmentStrip />

      <div className="flex-1 overflow-y-auto">
        <div className="px-5 pt-5 space-y-6">

          {/* ── AD CAROUSEL ── */}
          <section>
            <div className="relative overflow-hidden rounded-2xl h-52 shadow-md">
              <AnimatePresence mode="wait">
                {/* Dynamic live ads */}
                {liveAds.length > 0 && (
                  <motion.div key={`live-${adIndex}`} initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }} transition={{ duration: 0.35 }}
                    className="absolute inset-0 bg-gray-900">
                    <img src={liveAds[adIndex % liveAds.length]?.banner_url}
                      alt={liveAds[adIndex % liveAds.length]?.title}
                      className="w-full h-full object-cover opacity-80" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-5 flex flex-col justify-end">
                      {liveAds[adIndex % liveAds.length]?.is_sponsored && (
                        <span className="text-white/60 text-[10px] uppercase tracking-widest font-bold mb-1">Sponsored</span>
                      )}
                      <h3 className="text-white font-bold text-xl leading-tight">
                        {liveAds[adIndex % liveAds.length]?.title}
                      </h3>
                      {liveAds[adIndex % liveAds.length]?.description && (
                        <p className="text-white/75 text-xs mt-1 line-clamp-1">
                          {liveAds[adIndex % liveAds.length]?.description}
                        </p>
                      )}
                      <button onClick={() => handleAdCta(liveAds[adIndex % liveAds.length]!)}
                        className="mt-3 self-start inline-flex items-center gap-1.5 px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/25 rounded-full">
                        <span className="text-white text-xs font-bold">
                          {liveAds[adIndex % liveAds.length]?.cta_type === "external_url" ? "Learn More"
                            : liveAds[adIndex % liveAds.length]?.cta_type === "register_form" ? "Register Free"
                            : "View"}
                        </span>
                        {liveAds[adIndex % liveAds.length]?.cta_type === "external_url" && <ExternalLink className="w-3 h-3 text-white/80" />}
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Default banners fallback */}
                {liveAds.length === 0 && defaultBanners.length > 0 && (
                  <motion.div key={`banner-${adIndex}`} initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }} transition={{ duration: 0.35 }}
                    className="absolute inset-0 bg-gray-900">
                    <img src={defaultBanners[adIndex % defaultBanners.length]?.image_url}
                      alt={defaultBanners[adIndex % defaultBanners.length]?.title}
                      className="w-full h-full object-cover opacity-80" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-5 flex flex-col justify-end">
                      <h3 className="text-white font-bold text-xl leading-tight">
                        {defaultBanners[adIndex % defaultBanners.length]?.title}
                      </h3>
                      {defaultBanners[adIndex % defaultBanners.length]?.description && (
                        <p className="text-white/75 text-xs mt-1 line-clamp-1">
                          {defaultBanners[adIndex % defaultBanners.length]?.description}
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Static fallback when both are empty */}
                {liveAds.length === 0 && defaultBanners.length === 0 && adsLoaded && (
                  <motion.div key={`static-${adIndex}`} initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }} transition={{ duration: 0.35 }}
                    className={`absolute inset-0 bg-gradient-to-br ${STATIC_FALLBACK[adIndex % STATIC_FALLBACK.length].bg} p-6 flex items-center justify-between`}>
                    <div className="flex-1 pr-4">
                      <span className="text-white/50 text-[10px] uppercase tracking-widest font-bold">
                        {STATIC_FALLBACK[adIndex % STATIC_FALLBACK.length].label}
                      </span>
                      <h3 className="text-white font-bold text-2xl mt-1 leading-tight">
                        {STATIC_FALLBACK[adIndex % STATIC_FALLBACK.length].title}
                      </h3>
                      <p className="text-white/75 text-sm mt-2 leading-relaxed max-w-[210px]">
                        {STATIC_FALLBACK[adIndex % STATIC_FALLBACK.length].sub}
                      </p>
                      <div className="mt-4 inline-flex items-center px-4 py-2 bg-white/20 rounded-full">
                        <span className="text-white text-xs font-bold">
                          {STATIC_FALLBACK[adIndex % STATIC_FALLBACK.length].cta}
                        </span>
                      </div>
                    </div>
                    <div className="opacity-100 flex-shrink-0 -mr-2">
                      {STATIC_FALLBACK[adIndex % STATIC_FALLBACK.length].icon}
                    </div>
                  </motion.div>
                )}

                {/* Loading skeleton */}
                {!adsLoaded && (
                  <div className="absolute inset-0 bg-primary/20 animate-pulse rounded-2xl" />
                )}
              </AnimatePresence>

              <button onClick={() => goAd(-1)} className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/25 hover:bg-black/40 rounded-full flex items-center justify-center text-white z-10 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => goAd(1)} className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/25 hover:bg-black/40 rounded-full flex items-center justify-center text-white z-10 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                {Array.from({ length: totalAdCount }).map((_, i) => (
                  <button key={i} onClick={() => { setAdIndex(i); resetTimer(); }}
                    className={`rounded-full transition-all duration-300 ${i === adIndex ? "w-6 h-2 bg-white" : "w-2 h-2 bg-white/45"}`} />
                ))}
              </div>
            </div>
          </section>

          {/* ── PROFILE COMPLETION (below carousel, only when incomplete) ── */}
          {completion < 100 && (
            <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-foreground">Complete your profile</p>
                  <span className="text-xs font-bold text-primary">{completion}%</span>
                </div>
                <div className="bg-muted rounded-full h-2 overflow-hidden mb-2">
                  <motion.div className="h-full bg-primary rounded-full" initial={{ width: 0 }} animate={{ width: `${completion}%` }} transition={{ duration: 0.8, ease: "easeOut" }} />
                </div>
                <p className="text-xs text-muted-foreground">A complete profile helps donors trust your requests.</p>
              </div>
            </motion.section>
          )}

          {/* ── ACTION GRID ── */}
          <section>
            <h2 className="text-base font-bold text-foreground mb-3">What do you need?</h2>
            <div className="grid grid-cols-2 gap-3">
              {ACTIONS.map((action) => {
                const inner = (
                  <motion.div whileTap={{ scale: 0.96 }}
                    className={`${action.color} p-4 rounded-2xl shadow-sm flex flex-col items-start gap-3 text-left w-full h-full transition-all`}>
                    <div className={`w-10 h-10 ${action.accent} rounded-xl flex items-center justify-center`}>{action.icon}</div>
                    <span className="text-sm font-semibold leading-tight">{action.label}</span>
                  </motion.div>
                );
                return action.href ? (
                  <Link key={action.label} href={action.href} className="block">{inner}</Link>
                ) : (
                  <button key={action.label} className="block">{inner}</button>
                );
              })}
            </div>
          </section>

          {/* ── HEALTH CONTINUITY ── */}
          {continuity && (continuity.appointments.length > 0 || continuity.consultations.length > 0) && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-foreground">My Health</h2>
                <a href="/health" className="text-xs font-semibold text-primary">Full timeline</a>
              </div>
              <ContinuitySummary continuity={continuity} loading={continuityLoading} />
              <div className="mt-3">
                <ContinuityTimeline continuity={continuity} loading={continuityLoading} compact initialLimit={3} />
              </div>
            </section>
          )}

          {/* ── REMINDER PREVIEW ── */}
          {reminderCount > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-foreground">Reminders</h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-white">{reminderCount}</span>
                </div>
                <a href="/notifications" className="text-xs font-semibold text-primary">View all</a>
              </div>
              <a href="/notifications" className="block bg-card border border-border rounded-2xl p-3.5 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <BellRing className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">{reminderCount} active reminder{reminderCount !== 1 ? "s" : ""}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Tap to view in notification center</p>
                  </div>
                </div>
              </a>
            </section>
          )}

          {/* ── ACTIVITY FEED ── */}
          <ActivityFeed profile={profile} />

          {/* ── COMMUNITY EVENTS ── */}
          <EventsPreview />
        </div>
      </div>

      {/* ── BOTTOM NAV ── */}
      <nav className="fixed bottom-0 w-full max-w-[430px] bg-card/95 backdrop-blur-md border-t border-border flex justify-around py-3 pb-safe z-50">
        <Link href="/home" className="flex flex-col items-center gap-1 text-primary">
          <Heart className="w-5 h-5 fill-primary" />
          <span className="text-[10px] font-semibold">Home</span>
        </Link>
        <Link href="/donate" className="flex flex-col items-center gap-1 text-muted-foreground">
          <Droplet className="w-5 h-5" />
          <span className="text-[10px] font-medium">Donate</span>
        </Link>
        <Link href="/requests" className="flex flex-col items-center gap-1 text-muted-foreground relative">
          <Activity className="w-5 h-5" />
          {requestsBadge > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">{requestsBadge}</span>
          )}
          <span className="text-[10px] font-medium">Requests</span>
        </Link>
        <Link href="/notifications" className="flex flex-col items-center gap-1 text-muted-foreground relative">
          <Bell className="w-5 h-5" />
          {reminderCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">{reminderCount > 99 ? "99+" : reminderCount}</span>
          )}
          <span className="text-[10px] font-medium">Alerts</span>
        </Link>
        <Link href="/profile" className="flex flex-col items-center gap-1 text-muted-foreground">
          <User className="w-5 h-5" />
          <span className="text-[10px] font-medium">Profile</span>
        </Link>
      </nav>
      <style dangerouslySetInnerHTML={{ __html: `.pb-safe { padding-bottom: calc(0.75rem + env(safe-area-inset-bottom)); }` }} />

      {/* Registration Modal */}
      <AnimatePresence>
        {regModalAdId && (
          <RegistrationModal
            adId={regModalAdId}
            prefillName={profile.name}
            prefillPhone={profile.phone}
            prefillBloodGroup={profile.bloodGroup}
            prefillCity={profile.city}
            onClose={() => setRegModalAdId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
