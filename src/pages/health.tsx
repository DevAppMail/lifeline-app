import { useState, useEffect, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import {
  ChevronLeft, Droplet, Heart, Activity, User,
  Timer, CheckCircle2, Flame, Sparkles, TrendingUp, Star, Trophy,
  XCircle, Save,
} from "lucide-react";
import { useProfile } from "@/context/profile-context";

function calcEligibility(lastDonationDate?: string): { eligible: boolean; daysRemaining: number; nextDate: string } {
  if (!lastDonationDate) return { eligible: true, daysRemaining: 0, nextDate: "" };
  const last = new Date(lastDonationDate).getTime();
  const nextEligible = last + 90 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  if (now >= nextEligible) return { eligible: true, daysRemaining: 0, nextDate: "" };
  const daysRemaining = Math.ceil((nextEligible - now) / (24 * 60 * 60 * 1000));
  const nextDate = new Date(nextEligible).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return { eligible: false, daysRemaining, nextDate };
}

function getDonorBadge(count: number) {
  if (count === 0)  return { label: "New Donor",      color: "bg-white/20 text-white border-white/25", icon: <Sparkles className="w-3.5 h-3.5" /> };
  if (count <= 3)   return { label: "Active Donor",   color: "bg-white/20 text-white border-white/25", icon: <TrendingUp className="w-3.5 h-3.5" /> };
  if (count <= 10)  return { label: "Verified Hero",  color: "bg-white/20 text-white border-white/25", icon: <Star className="w-3.5 h-3.5" /> };
  return               { label: "Lifesaver Elite", color: "bg-white/20 text-white border-white/25", icon: <Trophy className="w-3.5 h-3.5" /> };
}

interface DonationRecord {
  id: number;
  hospital_name: string;
  patient_first_name: string;
  donation_date?: string;
  status: string;
  created_at: string;
}

export default function Health() {
  const [, setLocation] = useLocation();
  const { profile, updateProfile } = useProfile();

  const [userId, setUserId] = useState<number | null>(null);
  const [donations, setDonations] = useState<DonationRecord[]>([]);
  const [loadingDonations, setLoadingDonations] = useState(true);
  const [healthNotes, setHealthNotes] = useState(profile?.healthNotes ?? "");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  // Resolve user ID and load health_notes from backend
  useEffect(() => {
    if (!profile?.phone) return;
    (async () => {
      try {
        const res = await fetch(`/api/users/lookup?phone=${encodeURIComponent(profile.phone)}`);
        if (!res.ok) return;
        const data = await res.json();
        setUserId(data.user?.id ?? null);
        if (data.user?.health_notes != null) {
          setHealthNotes(data.user.health_notes);
          updateProfile({ healthNotes: data.user.health_notes });
        }
      } catch { /* silent */ }
    })();
  }, [profile?.phone]);

  // Load donation history once userId is known
  useEffect(() => {
    if (!userId) { setLoadingDonations(false); return; }
    (async () => {
      try {
        const res = await fetch(`/api/donation-confirmations?donor_user_id=${userId}`);
        if (res.ok) {
          const data: DonationRecord[] = await res.json();
          setDonations(data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
        }
      } catch { /* silent */ }
      setLoadingDonations(false);
    })();
  }, [userId]);

  const handleSaveNotes = useCallback(async () => {
    setNotesSaving(true);
    try {
      if (userId) {
        await fetch(`/api/users/${userId}/health-notes`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ health_notes: healthNotes }),
        });
      }
      updateProfile({ healthNotes });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } catch { /* silent */ }
    setNotesSaving(false);
  }, [userId, healthNotes, updateProfile]);

  if (!profile) return null;

  const donationCount = profile.donationCount ?? 0;
  const lives = donationCount * 3;
  const badge = getDonorBadge(donationCount);
  const eligibility = calcEligibility(profile.lastDonationDate);
  const lastDonationDisplay = profile.lastDonationDate
    ? new Date(profile.lastDonationDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "Never";

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-5 border-b border-border">
        <button onClick={() => setLocation("/home")} className="w-10 h-10 rounded-full flex items-center justify-center bg-muted hover:bg-muted/80">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">My Health</h1>
          <p className="text-sm text-muted-foreground">Your donor profile</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-5 space-y-5">

        {/* Hero Card */}
        <div className="bg-primary rounded-2xl p-5 relative overflow-hidden shadow-lg shadow-primary/20">
          <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/5 rounded-full" />
          <div className="absolute top-8 right-8 w-16 h-16 bg-white/5 rounded-full" />
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center border border-white/30 flex-shrink-0">
                <Droplet className="w-7 h-7 text-white fill-white/60" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-white truncate">{profile.name}</h2>
                <p className="text-white/70 text-sm mt-0.5">{profile.city || "—"}</p>
              </div>
              <div className="bg-white/20 border border-white/30 rounded-xl px-3 py-2 text-center flex-shrink-0">
                <span className="text-white font-bold text-2xl leading-none">{profile.bloodGroup || "?"}</span>
              </div>
            </div>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${badge.color}`}>
              {badge.icon}
              {badge.label}
            </div>
          </div>
        </div>

        {/* Eligibility */}
        <div className={`rounded-2xl p-4 border-2 flex items-center gap-4 ${
          eligibility.eligible
            ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-700"
            : "border-border bg-card"
        }`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            eligibility.eligible ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-muted"
          }`}>
            {eligibility.eligible
              ? <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2, repeat: Infinity }} className="w-4 h-4 rounded-full bg-emerald-500" />
              : <Timer className="w-5 h-5 text-muted-foreground" />}
          </div>
          <div>
            <p className={`font-bold text-sm ${eligibility.eligible ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"}`}>
              {eligibility.eligible ? "Eligible to donate today" : `Next eligible: ${eligibility.nextDate}`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {eligibility.eligible
                ? "You can safely donate blood right now."
                : `${eligibility.daysRemaining} days remaining — 90-day gap required by medical guidelines.`}
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <Droplet className="w-5 h-5 text-primary fill-primary/40" />, value: String(donationCount), label: "Donations" },
            { icon: <Heart className="w-5 h-5 text-rose-500 fill-rose-200" />,    value: String(lives),         label: "Lives Impacted" },
            { icon: <Flame className="w-5 h-5 text-orange-500" />,               value: lastDonationDisplay,   label: "Last Donation", small: true },
          ].map(stat => (
            <div key={stat.label} className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center gap-1.5">
              {stat.icon}
              <span className={`font-bold text-foreground text-center leading-tight ${stat.small ? "text-xs" : "text-2xl"}`}>{stat.value}</span>
              <span className="text-[10px] text-muted-foreground text-center leading-tight">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Health Notes */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Health Notes</p>
          <textarea
            value={healthNotes}
            onChange={e => { setHealthNotes(e.target.value); setNotesSaved(false); }}
            placeholder="Add health conditions, medications, allergies, or notes for medical staff..."
            rows={4}
            className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
          />
          <button
            onClick={handleSaveNotes}
            disabled={notesSaving}
            className={`mt-3 w-full h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60 ${
              notesSaved ? "bg-emerald-500 text-white" : "bg-primary text-white"
            }`}
          >
            {notesSaving
              ? <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              : notesSaved
              ? <><CheckCircle2 className="w-4 h-4" /> Saved</>
              : <><Save className="w-4 h-4" /> Save Notes</>}
          </button>
        </div>

        {/* Donation History Timeline */}
        <div className="pb-2">
          <h2 className="text-base font-bold text-foreground mb-3">Donation History</h2>
          {loadingDonations ? (
            <div className="space-y-2.5">
              {[1, 2].map(i => <div key={i} className="bg-card border border-border rounded-2xl p-4 h-16 animate-pulse" />)}
            </div>
          ) : donations.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center mb-1">
                <Droplet className="w-6 h-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-semibold text-foreground">No donations recorded</p>
              <p className="text-xs text-muted-foreground leading-relaxed">Confirmed donations via LifeLine will appear here.</p>
              <Link href="/requests" className="mt-2 inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-bold">
                Find a Request
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5 relative">
              <div className="absolute left-[19px] top-5 bottom-5 w-0.5 bg-border" />
              {donations.map((d, i) => {
                const isConfirmed = d.status === "confirmed";
                const isNoShow = d.status === "no_show";
                const dateDisplay = d.donation_date
                  ? new Date(d.donation_date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                  : new Date(d.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
                return (
                  <motion.div key={d.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
                    className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 z-10 ${
                      isConfirmed ? "bg-emerald-100 dark:bg-emerald-900/40"
                      : isNoShow  ? "bg-muted"
                      : "bg-amber-100 dark:bg-amber-900/30"
                    }`}>
                      {isConfirmed
                        ? <Heart className="w-5 h-5 text-emerald-600 fill-emerald-200" />
                        : isNoShow
                        ? <XCircle className="w-5 h-5 text-muted-foreground" />
                        : <Timer className="w-5 h-5 text-amber-600" />}
                    </div>
                    <div className="flex-1 bg-card border border-border rounded-2xl p-3.5 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{d.hospital_name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">For {d.patient_first_name} · {dateDisplay}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                          isConfirmed ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : isNoShow  ? "bg-muted text-muted-foreground"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                        }`}>
                          {isConfirmed ? "Confirmed" : isNoShow ? "No Show" : "Pending"}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 w-full max-w-[430px] bg-card/95 backdrop-blur-md border-t border-border flex justify-around py-3 pb-safe z-50">
        <Link href="/home" className="flex flex-col items-center gap-1 text-muted-foreground"><Heart className="w-5 h-5" /><span className="text-[10px] font-medium">Home</span></Link>
        <Link href="/donate" className="flex flex-col items-center gap-1 text-muted-foreground"><Droplet className="w-5 h-5" /><span className="text-[10px] font-medium">Donate</span></Link>
        <Link href="/requests" className="flex flex-col items-center gap-1 text-muted-foreground"><Activity className="w-5 h-5" /><span className="text-[10px] font-medium">Requests</span></Link>
        <Link href="/profile" className="flex flex-col items-center gap-1 text-muted-foreground"><User className="w-5 h-5" /><span className="text-[10px] font-medium">Profile</span></Link>
      </nav>
      <style dangerouslySetInnerHTML={{ __html: `.pb-safe { padding-bottom: calc(0.75rem + env(safe-area-inset-bottom)); }` }} />
    </div>
  );
}
