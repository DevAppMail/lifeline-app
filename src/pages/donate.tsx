import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Heart, Droplet, Activity, User,
  Trophy, Star, Clock, Flame, TrendingUp, Sparkles,
  CheckCircle2, XCircle, Share2, Calendar, Timer,
  Pill, FlaskConical, AlertCircle,
} from "lucide-react";
import { useProfile } from "@/context/profile-context";
import {
  getCommitments, updateCommitmentStatus, addPendingCelebration,
  getPendingCelebrations, removePendingCelebration, type Commitment,
} from "@/lib/commitments";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDonorBadge(count: number) {
  if (count === 0)  return { label: "New Donor",      color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",    icon: <Sparkles className="w-4 h-4" /> };
  if (count <= 3)   return { label: "Active Donor",   color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",     icon: <TrendingUp className="w-4 h-4" /> };
  if (count <= 10)  return { label: "Verified Hero",  color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", icon: <Star className="w-4 h-4" /> };
  return               { label: "Lifesaver Elite", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",   icon: <Trophy className="w-4 h-4" /> };
}

function calcEligibility(lastDonationDate?: string): { eligible: boolean; daysRemaining: number; label: string } {
  if (!lastDonationDate) return { eligible: true, daysRemaining: 0, label: "Eligible to donate today" };
  const last = new Date(lastDonationDate).getTime();
  const nextEligible = last + 90 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  if (now >= nextEligible) return { eligible: true, daysRemaining: 0, label: "Eligible to donate today" };
  const daysRemaining = Math.ceil((nextEligible - now) / (24 * 60 * 60 * 1000));
  return { eligible: false, daysRemaining, label: `${daysRemaining} days until eligible` };
}

const COUPONS = [
  { icon: <Pill className="w-5 h-5" />, title: "Pharmacy Discount", sub: "20% off at MedPlus & Apollo Pharmacy", code: "LIFELINE20", color: "bg-blue-50 border-blue-200 text-blue-700" },
  { icon: <FlaskConical className="w-5 h-5" />, title: "Lab Test Discount", sub: "₹200 off on any Thyrocare test", code: "LLLAB200", color: "bg-purple-50 border-purple-200 text-purple-700" },
  { icon: <Droplet className="w-5 h-5" />, title: "Health Drink Offer", sub: "Free Glucon-D with next donation", code: "LLDRINK", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
];

type DonorRecord = { id: number; availability_toggle: boolean; last_donation_date: string | null; lifeline_donations: number; pre_lifeline_donations: number; donor_score: number };
type PostState = "idle" | "confirm-prompt" | "awaiting" | "celebration" | "missed";

// ── Component ─────────────────────────────────────────────────────────────────

export default function Donate() {
  const [, setLocation] = useLocation();
  const { profile, updateProfile } = useProfile();

  const [isAvailable, setIsAvailable] = useState(false);
  const [donorRecord, setDonorRecord] = useState<DonorRecord | null>(null);
  const [loadingToggle, setLoadingToggle] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [postState, setPostState] = useState<PostState>("idle");
  const [activeCommitment, setActiveCommitment] = useState<Commitment | null>(null);
  const [celebrationData, setCelebrationData] = useState<{ newCount: number; newLives: number; newStreak: number } | null>(null);

  const donorIdRef = useRef<number | null>(null);

  // Load donor record from DB (for toggle persistence + stats sync)
  // Also re-fetches whenever the tab becomes visible (fixes reset-on-tab-switch)
  useEffect(() => {
    if (!profile?.phone) return;

    const fetchDonorData = async () => {
      try {
        const res = await fetch(`/api/users/lookup?phone=${encodeURIComponent(profile.phone)}`);
        if (!res.ok) { setSyncError(true); return; }
        const { donor } = await res.json() as { donor: DonorRecord | null };
        if (donor) {
          setSyncError(false);
          setDonorRecord(donor);
          setIsAvailable(donor.availability_toggle);
          donorIdRef.current = donor.id;
          updateProfile({
            donationCount: donor.lifeline_donations,
            preLifelineDonations: donor.pre_lifeline_donations,
            lastDonationDate: donor.last_donation_date ?? undefined,
          });
        } else {
          setSyncError(true);
        }
      } catch { setSyncError(true); }
    };

    fetchDonorData();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchDonorData();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [profile?.phone]);

  // Load commitments
  useEffect(() => {
    setCommitments(getCommitments());
    checkPendingCelebrations();
  }, []);

  // Check if any awaiting_confirmation commitments have been confirmed by requester
  const checkPendingCelebrations = useCallback(async () => {
    const pending = getPendingCelebrations();
    const ids = Object.keys(pending).map(Number);
    if (ids.length === 0) return;

    for (const confirmationId of ids) {
      try {
        const res = await fetch(`/api/donation-confirmations/${confirmationId}`);
        if (!res.ok) continue;
        const data = await res.json();
        if (data.status === "confirmed") {
          const requestId = pending[confirmationId];
          updateCommitmentStatus(requestId, "completed");
          removePendingCelebration(confirmationId);
          const newCount = (profile?.donationCount ?? 0) + 1;
          const newStreak = (profile?.streakMonths ?? 0) + 1;
          updateProfile({ donationCount: newCount, streakMonths: newStreak, lastDonationDate: new Date().toISOString().split("T")[0] });
          setCelebrationData({ newCount, newLives: newCount * 3, newStreak });
          setPostState("celebration");
          setCommitments(getCommitments());
          return;
        }
      } catch { /* continue */ }
    }
  }, [profile]);

  // Toggle persistence
  const handleToggle = useCallback(async () => {
    const next = !isAvailable;
    setIsAvailable(next);
    if (donorIdRef.current) {
      setLoadingToggle(true);
      try {
        await fetch(`/api/donors/${donorIdRef.current}/toggle`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ availability_toggle: next }),
        });
      } catch { /* silent */ }
      setLoadingToggle(false);
    }
  }, [isAvailable]);

  // Mark as donated → awaiting confirmation
  const handleConfirmDonated = useCallback(async () => {
    if (!activeCommitment || !profile) return;

    // Need requester info — fetch blood request to get requester_id
    let requesterUserId = activeCommitment.requesterUserId ?? 0;
    let donorId = donorRecord?.id ?? donorIdRef.current ?? 0;

    if (!requesterUserId) {
      try {
        const res = await fetch(`/api/blood-requests/${activeCommitment.requestId}`);
        if (res.ok) {
          const data = await res.json();
          requesterUserId = data.requester_id;
        }
      } catch { /* fallback */ }
    }

    // Look up donor user_id
    let donorUserId = 0;
    if (profile.phone) {
      try {
        const res = await fetch(`/api/users/lookup?phone=${encodeURIComponent(profile.phone)}`);
        if (res.ok) {
          const data = await res.json();
          donorUserId = data.user?.id ?? 0;
          if (!donorId && data.donor?.id) donorId = data.donor.id;
        }
      } catch { /* fallback */ }
    }

    // POST donation confirmation to DB
    let confirmationId: number | undefined;
    if (donorUserId && requesterUserId) {
      try {
        const res = await fetch("/api/donation-confirmations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blood_request_id: activeCommitment.requestId,
            donor_id: donorId,
            donor_user_id: donorUserId,
            requester_user_id: requesterUserId,
            hospital_name: activeCommitment.hospitalName,
            patient_first_name: activeCommitment.patientFirstName,
            donation_date: activeCommitment.requiredDate || new Date().toISOString().split("T")[0],
            donor_name: profile.name.split(" ")[0],
          }),
        });
        if (res.ok) {
          const data = await res.json();
          confirmationId = data.id;
        }
      } catch { /* fallback */ }
    }

    // Update local commitment status
    updateCommitmentStatus(activeCommitment.requestId, "awaiting_confirmation", { confirmationId });
    if (confirmationId) {
      addPendingCelebration(confirmationId, activeCommitment.requestId);
    }

    setCommitments(getCommitments());
    setPostState("awaiting");
  }, [activeCommitment, profile, donorRecord]);

  // Missed
  const handleMissed = useCallback(() => {
    if (!activeCommitment) return;
    updateCommitmentStatus(activeCommitment.requestId, "missed");
    setCommitments(getCommitments());
    setPostState("missed");
  }, [activeCommitment]);

  if (!profile) return null;

  const lifelineDonations = profile.donationCount ?? 0;
  const preLifelineDonations = profile.preLifelineDonations ?? 0;
  const streak = profile.streakMonths ?? 0;
  const lives = lifelineDonations * 3;
  const badge = getDonorBadge(lifelineDonations);
  const eligibility = calcEligibility(profile.lastDonationDate);

  const committedItems = commitments.filter((c) => c.status === "committed" || c.status === "awaiting_confirmation");
  const historyItems = commitments.filter((c) => c.status === "completed" || c.status === "missed");

  // ── CELEBRATION SCREEN ────────────────────────────────────────────────────
  if (postState === "celebration" && celebrationData) {
    const { newCount, newLives, newStreak } = celebrationData;
    const newBadge = getDonorBadge(newCount);
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background overflow-hidden relative">
        {[...Array(8)].map((_, i) => (
          <motion.div key={i} className="absolute w-3 h-3 rounded-full pointer-events-none"
            style={{ background: ["#e11d48","#f59e0b","#10b981","#3b82f6"][i % 4] }}
            initial={{ x: Math.random() * 340 + 40, y: -20, scale: 0 }}
            animate={{ y: 900, scale: [0, 1, 0.5], opacity: [1, 1, 0], rotate: 360 }}
            transition={{ duration: 2.5 + Math.random(), delay: Math.random() * 0.8, repeat: Infinity, repeatDelay: Math.random() * 3 }} />
        ))}
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center py-8 overflow-y-auto">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 15 }} className="relative mb-5">
            <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 2, repeat: Infinity }} className="absolute inset-0 bg-primary/20 rounded-full" />
            <motion.div animate={{ scale: [1, 2, 1] }} transition={{ duration: 2, repeat: Infinity, delay: 0.3 }} className="absolute inset-0 bg-primary/10 rounded-full" />
            <div className="relative w-24 h-24 bg-primary rounded-full flex items-center justify-center">
              <Heart className="w-12 h-12 text-white fill-white" />
            </div>
          </motion.div>
          <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-2xl font-bold text-foreground">Thank you for donating!</motion.h2>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="text-muted-foreground mt-2 text-sm max-w-xs">Your donation may save up to <strong className="text-primary">3 lives</strong>. You are a hero.</motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="mt-5 w-full grid grid-cols-3 gap-3">
            {[{ label: "Via LifeLine", value: newCount, icon: <Droplet className="w-4 h-4" /> }, { label: "Lives Impacted", value: newLives, icon: <Heart className="w-4 h-4" /> }, { label: "Streak", value: `${newStreak}mo`, icon: <Flame className="w-4 h-4" /> }].map((s) => (
              <div key={s.label} className="bg-primary/5 border border-primary/20 rounded-2xl p-3 flex flex-col items-center gap-1">
                <div className="text-primary">{s.icon}</div>
                <span className="font-bold text-xl text-foreground">{s.value}</span>
                <span className="text-[10px] text-muted-foreground text-center leading-tight">{s.label}</span>
              </div>
            ))}
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.9 }} className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${newBadge.color}`}>
            {newBadge.icon} {newBadge.label}
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 }} className="mt-5 w-full space-y-2">
            <p className="text-sm font-bold text-foreground text-left mb-2">🎁 Your rewards</p>
            {COUPONS.map((c) => (
              <div key={c.code} className={`flex items-center gap-3 p-3 rounded-xl border ${c.color}`}>
                <div className="flex-shrink-0">{c.icon}</div>
                <div className="flex-1 text-left"><p className="text-sm font-bold">{c.title}</p><p className="text-xs opacity-80">{c.sub}</p></div>
                <span className="text-xs font-mono font-bold bg-white/50 px-2 py-0.5 rounded-lg">{c.code}</span>
              </div>
            ))}
          </motion.div>
          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }}
            onClick={() => { if (navigator.share) navigator.share({ title: "I just donated blood!", text: "I donated blood via LifeLine and may have saved 3 lives! 🩸❤️", url: window.location.origin }); }}
            className="mt-4 w-full h-12 border-2 border-primary text-primary rounded-xl font-semibold text-sm flex items-center justify-center gap-2">
            <Share2 className="w-4 h-4" /> Share — I just saved a life
          </motion.button>
          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
            onClick={() => { setPostState("idle"); setActiveCommitment(null); setCelebrationData(null); }}
            className="mt-3 w-full h-12 bg-primary text-white rounded-xl font-bold">Done</motion.button>
        </div>
      </div>
    );
  }

  // ── AWAITING REQUESTER SCREEN ─────────────────────────────────────────────
  if (postState === "awaiting") {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-6 text-center">
        <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full mb-5" />
        <h2 className="text-xl font-bold text-foreground">Awaiting Confirmation</h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-xs">
          Your donation has been recorded. The requester will confirm whether you showed up. You'll see your rewards once confirmed.
        </p>
        <div className="mt-4 w-full bg-amber-50 border border-amber-200 rounded-xl p-4 text-left">
          <p className="text-xs font-semibold text-amber-700 mb-1">What happens next?</p>
          <p className="text-xs text-amber-600 leading-relaxed">The requester sees a confirmation prompt. Once they confirm, your donation count updates and your rewards are unlocked. If they don't respond within 24 hours, the case is flagged for admin review.</p>
        </div>
        <button onClick={() => { setPostState("idle"); setActiveCommitment(null); }} className="mt-5 w-full h-12 bg-primary text-white rounded-xl font-bold">Back to Donate Hub</button>
      </div>
    );
  }

  // ── MISSED SCREEN ─────────────────────────────────────────────────────────
  if (postState === "missed") {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-6 text-center">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-5"><XCircle className="w-8 h-8 text-muted-foreground" /></div>
        <h2 className="text-xl font-bold text-foreground">Thank you for being honest</h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-xs">We have notified the requester to find another donor. No penalty for your first missed commitment.</p>
        <div className="mt-4 w-full bg-amber-50 border border-amber-200 rounded-xl p-4 text-left">
          <p className="text-xs font-semibold text-amber-700 mb-1">Strike Policy</p>
          <p className="text-xs text-amber-600">The strike system activates from the second missed commitment. Two strikes will temporarily suspend your donor account.</p>
        </div>
        <button onClick={() => { setPostState("idle"); setActiveCommitment(null); }} className="mt-5 w-full h-12 bg-primary text-white rounded-xl font-bold">OK, Understood</button>
      </div>
    );
  }

  // ── CONFIRM PROMPT ────────────────────────────────────────────────────────
  if (postState === "confirm-prompt" && activeCommitment) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-5"><Droplet className="w-7 h-7 text-primary fill-primary/30" /></div>
          <h2 className="text-xl font-bold text-foreground text-center">Confirm Donation</h2>
          <p className="text-sm text-muted-foreground text-center mt-2 mb-6 leading-relaxed">
            Did you complete your donation at <strong className="text-foreground">{activeCommitment.hospitalName}</strong>?
          </p>
          <div className="space-y-3">
            <button onClick={handleConfirmDonated} className="w-full h-13 bg-primary text-white rounded-xl font-bold flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> Yes, I Donated
            </button>
            <button onClick={handleMissed} className="w-full h-12 border-2 border-border text-muted-foreground rounded-xl font-semibold flex items-center justify-center gap-2">
              <XCircle className="w-5 h-5" /> No, I Could Not Make It
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN PAGE ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background pb-24">
      <div className="flex items-center gap-3 px-5 pt-12 pb-5 border-b border-border">
        <button onClick={() => setLocation("/home")} className="w-10 h-10 rounded-full flex items-center justify-center bg-muted hover:bg-muted/80">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">Donate Blood</h1>
          <p className="text-sm text-muted-foreground">Your donor hub</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-5 space-y-5">

        {/* ── AVAILABILITY TOGGLE ── */}
        <div className={`rounded-2xl p-5 border-2 transition-all duration-300 ${isAvailable ? "bg-emerald-50 border-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-700" : "bg-card border-border"}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <p className="font-bold text-lg text-foreground">{isAvailable ? "You are active" : "Set availability"}</p>
              <p className={`text-sm mt-0.5 leading-snug ${isAvailable ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                {isAvailable ? "Matching requests will notify you this week." : "Toggle on to receive donation requests this week."}
              </p>
            </div>
            <button onClick={handleToggle} disabled={loadingToggle}
              className={`relative w-16 h-9 rounded-full transition-colors duration-300 flex-shrink-0 ml-4 ${isAvailable ? "bg-emerald-500" : "bg-muted"} ${loadingToggle ? "opacity-60" : ""}`}>
              <motion.div animate={{ x: isAvailable ? 28 : 4 }} transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="absolute top-1.5 w-6 h-6 bg-white rounded-full shadow-md" />
            </button>
          </div>
          <AnimatePresence>
            {isAvailable && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 bg-emerald-500/10 rounded-xl p-3">
                <motion.div animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 2, repeat: Infinity }} className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Active — broadcasting your availability</span>
              </motion.div>
            )}
            {syncError && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 mt-2">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Availability sync unavailable — toggle state will not be saved</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── ELIGIBILITY COUNTDOWN ── */}
        <div className={`rounded-2xl p-4 border-2 flex items-center gap-4 ${eligibility.eligible ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-700" : "border-border bg-card"}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${eligibility.eligible ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-muted"}`}>
            {eligibility.eligible
              ? <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2, repeat: Infinity }} className="w-4 h-4 rounded-full bg-emerald-500" />
              : <Timer className="w-5 h-5 text-muted-foreground" />}
          </div>
          <div>
            <p className={`font-bold text-sm ${eligibility.eligible ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"}`}>
              {eligibility.eligible ? "Eligible to donate today" : `${eligibility.daysRemaining} days remaining`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {eligibility.eligible ? "You can safely donate blood right now." : "90-day gap between donations required by medical guidelines."}
            </p>
          </div>
        </div>

        {/* ── DONATION STATS ── */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Donation Summary</p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Before LifeLine</p>
              <p className="text-2xl font-bold text-foreground">{preLifelineDonations}</p>
              <p className="text-xs text-muted-foreground">Declared at signup</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Via LifeLine</p>
              <p className="text-2xl font-bold text-primary">{lifelineDonations}</p>
              <p className="text-xs text-muted-foreground">Platform confirmed</p>
            </div>
          </div>
          <div className="border-t border-border pt-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Lives Impacted</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Heart className="w-4 h-4 text-primary fill-primary/50" />
                <span className="text-xl font-bold text-foreground">{lives}</span>
              </div>
            </div>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${badge.color}`}>
              {badge.icon} {badge.label}
            </div>
          </div>
        </div>

        {/* ── UPCOMING COMMITMENTS ── */}
        {committedItems.length > 0 && (
          <div>
            <h2 className="text-base font-bold text-foreground mb-3">Upcoming Commitments</h2>
            <div className="space-y-2.5">
              {committedItems.map((c) => (
                <motion.div key={c.requestId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className={`bg-card rounded-2xl p-4 border-2 ${c.status === "awaiting_confirmation" ? "border-amber-300 dark:border-amber-700" : "border-primary/30"}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Droplet className="w-5 h-5 text-primary fill-primary/40" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground">{c.hospitalName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{c.hospitalLocation}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">For <span className="font-semibold text-foreground">{c.patientFirstName}</span> · {c.bloodGroup}{c.requiredDate && ` · ${c.requiredDate}`}</p>
                    </div>
                    {c.status === "awaiting_confirmation" ? (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-xs font-bold rounded-full flex-shrink-0 flex items-center gap-1">
                        <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Awaiting
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-bold rounded-full flex-shrink-0">Committed</span>
                    )}
                  </div>
                  {c.status === "committed" && (
                    <button onClick={() => { setActiveCommitment(c); setPostState("confirm-prompt"); }}
                      className="w-full h-10 bg-primary text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Mark as Donated
                    </button>
                  )}
                  {c.status === "awaiting_confirmation" && (
                    <button onClick={checkPendingCelebrations}
                      className="w-full h-10 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2">
                      <AlertCircle className="w-4 h-4" /> Waiting for requester to confirm — tap to refresh
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* ── DONATION HISTORY ── */}
        <div className="pb-2">
          <h2 className="text-base font-bold text-foreground mb-3">Donation History</h2>
          {historyItems.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-3"><Droplet className="w-6 h-6 text-muted-foreground" /></div>
              <p className="text-sm font-semibold text-foreground">No donations yet</p>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">Your first donation could save a life today.</p>
              <Link href="/requests" className="mt-4 inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-bold">Find a Request</Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {historyItems.map((item, i) => (
                <motion.div key={item.requestId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                  className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${item.status === "completed" ? "bg-emerald-50" : "bg-muted"}`}>
                    {item.status === "completed" ? <Heart className="w-5 h-5 text-emerald-600 fill-emerald-200" /> : <XCircle className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{item.hospitalName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.patientFirstName} · {item.bloodGroup} · {new Date(item.committedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${item.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                    {item.status === "completed" ? "Completed" : "Missed"}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-[10px] text-muted-foreground/50 pb-2 leading-relaxed px-4">
        LifeLine is a voluntary donor matching platform — not a blood bank or medical service provider.
      </p>

      <nav className="fixed bottom-0 w-full max-w-[430px] bg-card/95 backdrop-blur-md border-t border-border flex justify-around py-3 pb-safe z-50">
        <Link href="/home" className="flex flex-col items-center gap-1 text-muted-foreground"><Heart className="w-5 h-5" /><span className="text-[10px] font-medium">Home</span></Link>
        <button className="flex flex-col items-center gap-1 text-primary"><Droplet className="w-5 h-5 fill-primary/40" /><span className="text-[10px] font-semibold">Donate</span></button>
        <Link href="/requests" className="flex flex-col items-center gap-1 text-muted-foreground"><Activity className="w-5 h-5" /><span className="text-[10px] font-medium">Requests</span></Link>
        <Link href="/profile" className="flex flex-col items-center gap-1 text-muted-foreground"><User className="w-5 h-5" /><span className="text-[10px] font-medium">Profile</span></Link>
      </nav>
      <style dangerouslySetInnerHTML={{ __html: `.pb-safe { padding-bottom: calc(0.75rem + env(safe-area-inset-bottom)); }` }} />
    </div>
  );
}
