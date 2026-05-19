import { useEffect, useState, useRef } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Droplet, Heart, Activity, User, MapPin,
  Stethoscope, HeartPulse, AlertCircle, ChevronLeft, ChevronRight,
  Building2, CheckCircle2, Flame, Star, Trophy, Sparkles, TrendingUp, ArrowRight,
} from "lucide-react";
import { useProfile } from "@/context/profile-context";
import { getSeenIds } from "@/lib/commitments";

const MOCK_ACTIVITY = [
  { id: 1, title: "Urgent O+ needed at Apollo Hospital, Juhu", time: "10 mins ago", type: "urgent" },
  { id: 2, title: "Blood drive this Saturday at Shivaji Park, Mumbai", time: "2 hours ago", type: "info" },
  { id: 3, title: "Free health camp at KEM Hospital tomorrow", time: "Yesterday", type: "success" },
];

const ADS = [
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

const ACTIONS = [
  { label: "Request Blood", icon: <Droplet className="w-6 h-6" />, color: "bg-primary text-white", accent: "bg-white/20", href: "/request-blood" },
  { label: "I'm Available to Donate", icon: <Heart className="w-6 h-6 fill-current" />, color: "bg-rose-100 text-primary dark:bg-primary/20", accent: "bg-primary/10", href: "/donate" },
  { label: "Book Doctor", icon: <Stethoscope className="w-6 h-6" />, color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200", accent: "bg-slate-200/50", href: "/book-doctor" },
  { label: "My Health", icon: <HeartPulse className="w-6 h-6" />, color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", accent: "bg-emerald-100/50", href: null },
];

type BadgeTier = { label: string; color: string; icon: React.ReactNode };
function getBadgeTier(count: number): BadgeTier {
  if (count === 0)  return { label: "New Donor",      color: "bg-white/15 text-white/90",       icon: <Sparkles className="w-3 h-3" /> };
  if (count <= 3)   return { label: "Active Donor",   color: "bg-blue-400/25 text-blue-100",    icon: <TrendingUp className="w-3 h-3" /> };
  if (count <= 10)  return { label: "Verified Hero",  color: "bg-emerald-400/25 text-emerald-100", icon: <Star className="w-3 h-3" /> };
  return               { label: "Lifesaver Elite", color: "bg-amber-400/25 text-amber-100",  icon: <Trophy className="w-3 h-3" /> };
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

  const resetTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setAdIndex((i) => (i + 1) % ADS.length), 4000);
  };

  useEffect(() => { resetTimer(); return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, []);
  useEffect(() => { if (!isLoading && !profile) setLocation("/onboarding"); }, [profile, isLoading, setLocation]);

  if (isLoading || !profile) return null;

  const firstName = profile.name.split(" ")[0];
  const displayCity = geoCity || profile.city;
  const donations = profile.donationCount ?? 0;
  const streak = profile.streakMonths ?? 0;
  const lives = donations * 3;
  const badge = getBadgeTier(donations);
  const completion = getProfileCompletion(profile);
  const requestsBadge = useRequestsBadge(profile.bloodGroup);

  const goAd = (dir: 1 | -1) => { setAdIndex((i) => (i + dir + ADS.length) % ADS.length); resetTimer(); };

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

      <div className="flex-1 overflow-y-auto">
        <div className="px-5 pt-5 space-y-6">

          {/* ── AD CAROUSEL ── */}
          <section>
            <div className="relative overflow-hidden rounded-2xl h-52 shadow-md">
              <AnimatePresence mode="wait">
                <motion.div key={adIndex} initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }} transition={{ duration: 0.35 }}
                  className={`absolute inset-0 bg-gradient-to-br ${ADS[adIndex].bg} p-6 flex items-center justify-between`}>
                  <div className="flex-1 pr-4">
                    <span className="text-white/50 text-[10px] uppercase tracking-widest font-bold">{ADS[adIndex].label}</span>
                    <h3 className="text-white font-bold text-2xl mt-1 leading-tight">{ADS[adIndex].title}</h3>
                    <p className="text-white/75 text-sm mt-2 leading-relaxed max-w-[210px]">{ADS[adIndex].sub}</p>
                    <div className="mt-4 inline-flex items-center px-4 py-2 bg-white/20 rounded-full">
                      <span className="text-white text-xs font-bold">{ADS[adIndex].cta}</span>
                    </div>
                  </div>
                  <div className="opacity-100 flex-shrink-0 -mr-2">{ADS[adIndex].icon}</div>
                </motion.div>
              </AnimatePresence>
              <button onClick={() => goAd(-1)} className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/25 hover:bg-black/40 rounded-full flex items-center justify-center text-white z-10 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => goAd(1)} className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/25 hover:bg-black/40 rounded-full flex items-center justify-center text-white z-10 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                {ADS.map((_, i) => (
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

          {/* ── ACTIVITY FEED ── */}
          <section className="pb-2">
            <h2 className="text-base font-bold text-foreground mb-3">Recent Activity</h2>
            <div className="space-y-2.5">
              {MOCK_ACTIVITY.map((item, i) => (
                <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                  className="bg-card border border-border rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                  <div className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${item.type === "urgent" ? "bg-destructive/10 text-destructive" : item.type === "success" ? "bg-emerald-500/10 text-emerald-600" : "bg-blue-500/10 text-blue-600"}`}>
                    {item.type === "urgent" && <AlertCircle className="w-4 h-4" />}
                    {item.type === "success" && <CheckCircle2 className="w-4 h-4" />}
                    {item.type === "info" && <Activity className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug text-foreground">{item.title}</p>
                    <span className="text-xs text-muted-foreground mt-0.5 block">{item.time}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
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
        <Link href="/profile" className="flex flex-col items-center gap-1 text-muted-foreground">
          <User className="w-5 h-5" />
          <span className="text-[10px] font-medium">Profile</span>
        </Link>
      </nav>
      <style dangerouslySetInnerHTML={{ __html: `.pb-safe { padding-bottom: calc(0.75rem + env(safe-area-inset-bottom)); }` }} />
    </div>
  );
}
