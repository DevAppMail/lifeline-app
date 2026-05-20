import { useEffect, useState, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Droplet, Heart, Activity, User, AlertTriangle, Clock, Zap,
  MapPin, Timer, ChevronRight, RefreshCw, CheckCircle2, XCircle,
  Bell, Plus,
} from "lucide-react";
import { useProfile } from "@/context/profile-context";
import { markAsSeen } from "@/lib/commitments";

interface BloodRequest {
  id: number;
  patient_name: string;
  blood_group: string;
  units_needed: number;
  hospital_name: string;
  hospital_location: string;
  request_tier: string;
  status: string;
  created_at: string;
  required_date?: string;
  required_time?: string;
  requester_id?: number;
}

interface DonationConfirmation {
  id: number;
  blood_request_id: number;
  donor_user_id: number;
  hospital_name: string;
  patient_first_name: string;
  donation_date?: string;
  donor_name: string;
  donor_confirmed_at: string;
  status: string;
}

const TIER_ORDER: Record<string, number> = { critical: 0, urgent: 1, normal: 2 };

const TIER_META: Record<string, { label: string; icon: React.ReactNode; badge: string; border: string }> = {
  critical: { label: "Emergency", icon: <AlertTriangle className="w-3.5 h-3.5" />, badge: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",    border: "border-red-300 dark:border-red-800" },
  urgent:   { label: "Urgent",    icon: <Zap className="w-3.5 h-3.5" />,           badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300", border: "border-amber-300 dark:border-amber-800" },
  normal:   { label: "Scheduled", icon: <Clock className="w-3.5 h-3.5" />,         badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",   border: "border-blue-300 dark:border-blue-800" },
};

const STATUS_META: Record<string, { label: string; badge: string }> = {
  pending:   { label: "Pending",     badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  active:    { label: "Donor Found", badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  fulfilled: { label: "Fulfilled",   badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  cancelled: { label: "Cancelled",   badge: "bg-muted text-muted-foreground" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const DISTANCES: Record<number, string> = {};
function simDistance(id: number): string {
  if (!DISTANCES[id]) DISTANCES[id] = `${(Math.random() * 12 + 0.5).toFixed(1)} km`;
  return DISTANCES[id];
}

export default function Requests() {
  const [, setLocation] = useLocation();
  const { profile } = useProfile();

  const initialTab = new URLSearchParams(window.location.search).get("tab") === "mine" ? "mine" : "donate";
  const [activeTab, setActiveTab] = useState<"donate" | "mine">(initialTab as "donate" | "mine");

  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRequests, setMyRequests] = useState<BloodRequest[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);
  const [pendingConfirmations, setPendingConfirmations] = useState<DonationConfirmation[]>([]);
  const [userId, setUserId] = useState<number | null>(null);
  const [respondingId, setRespondingId] = useState<number | null>(null);

  useEffect(() => {
    if (!profile?.phone) return;
    (async () => {
      try {
        const res = await fetch(`/api/users/lookup?phone=${encodeURIComponent(profile.phone)}`);
        if (res.ok) {
          const data = await res.json();
          setUserId(data.user?.id ?? null);
        }
      } catch { /* silent */ }
    })();
  }, [profile?.phone]);

  const loadConfirmations = useCallback(async (uid: number) => {
    try {
      const res = await fetch(`/api/donation-confirmations?requester_user_id=${uid}&status=awaiting_requester`);
      if (res.ok) setPendingConfirmations(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (userId) loadConfirmations(userId);
  }, [userId, loadConfirmations]);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/blood-requests?status=pending");
      const data: BloodRequest[] = await res.json();
      const bloodGroup = profile?.bloodGroup || "";
      const matching = data.filter((r) => !bloodGroup || r.blood_group === bloodGroup);
      matching.sort((a, b) => {
        const tierDiff = (TIER_ORDER[a.request_tier] ?? 9) - (TIER_ORDER[b.request_tier] ?? 9);
        if (tierDiff !== 0) return tierDiff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setRequests(matching);
      markAsSeen(matching.map((r) => r.id));
    } catch { setRequests([]); }
    finally { setLoading(false); }
  }, [profile?.bloodGroup]);

  const loadMyRequests = useCallback(async (uid: number) => {
    setLoadingMine(true);
    try {
      const res = await fetch(`/api/blood-requests?requester_id=${uid}`);
      if (res.ok) {
        const data: BloodRequest[] = await res.json();
        setMyRequests(data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      }
    } catch { setMyRequests([]); }
    finally { setLoadingMine(false); }
  }, []);

  useEffect(() => {
    if (!profile) { setLocation("/login"); return; }
    loadRequests();
  }, [profile, loadRequests]);

  useEffect(() => {
    if (userId && activeTab === "mine") loadMyRequests(userId);
  }, [userId, activeTab, loadMyRequests]);

  const handleRespond = async (confirmation: DonationConfirmation, response: "confirmed" | "no_show") => {
    setRespondingId(confirmation.id);
    try {
      await fetch(`/api/donation-confirmations/${confirmation.id}/respond`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response }),
      });
      setPendingConfirmations((prev) => prev.filter((c) => c.id !== confirmation.id));
      loadRequests();
    } catch { /* silent */ }
    finally { setRespondingId(null); }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background pb-24">
      {/* Header */}
      <div className="bg-primary px-5 pt-12 pb-5 rounded-b-[2rem] shadow-md shadow-primary/20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Blood Requests</h1>
            <p className="text-white/70 text-sm mt-0.5">
              {activeTab === "donate"
                ? (profile?.bloodGroup ? `Matching ${profile.bloodGroup} donors` : "All pending requests")
                : "Requests you've submitted"}
            </p>
          </div>
          <button
            onClick={() => activeTab === "donate" ? loadRequests() : userId && loadMyRequests(userId)}
            className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center text-white"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        {activeTab === "donate" && profile?.bloodGroup && (
          <div className="mt-3 flex items-center gap-2">
            <div className="bg-white rounded-xl px-3 py-1.5 flex items-center gap-1.5">
              <Droplet className="w-3.5 h-3.5 text-primary fill-primary" />
              <span className="text-primary font-bold text-sm">{profile.bloodGroup}</span>
            </div>
            <span className="text-white/60 text-xs">{requests.length} requests match your blood group</span>
          </div>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex px-4 pt-4 gap-2">
        {(["donate", "mine"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === tab
                ? "bg-primary text-white shadow-sm"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "donate" ? "Donate" : "My Requests"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-3 space-y-4">

        {/* ── DONATE TAB ── */}
        {activeTab === "donate" && (
          <>
            {pendingConfirmations.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Bell className="w-4 h-4 text-amber-600" />
                  <h2 className="text-base font-bold text-foreground">Action Required</h2>
                  <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-xs font-bold px-2 py-0.5 rounded-full">
                    {pendingConfirmations.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {pendingConfirmations.map((conf) => (
                    <motion.div key={conf.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-300 dark:border-amber-700 rounded-2xl p-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-2">Donor Confirmation Needed</p>
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Heart className="w-5 h-5 text-amber-600 fill-amber-200" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground">
                            <span className="text-amber-700 dark:text-amber-300">{conf.donor_name || "A donor"}</span> says they donated
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{conf.hospital_name}</p>
                          {conf.donation_date && <p className="text-xs text-muted-foreground">{conf.donation_date}</p>}
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Marked at {new Date(conf.donor_confirmed_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })},{" "}
                            {new Date(conf.donor_confirmed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-amber-700 dark:text-amber-400 mb-3 leading-relaxed">
                        Did this donor come and donate blood? Your confirmation updates their donor stats and triggers their reward.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleRespond(conf, "confirmed")}
                          disabled={respondingId === conf.id}
                          className="h-11 bg-emerald-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Yes, Came
                        </button>
                        <button
                          onClick={() => handleRespond(conf, "no_show")}
                          disabled={respondingId === conf.id}
                          className="h-11 bg-card border-2 border-border text-muted-foreground rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60"
                        >
                          <XCircle className="w-4 h-4" /> Did Not Show
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            <section>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-card border border-border rounded-2xl p-4 animate-pulse h-32 mb-3" />
                ))
              ) : requests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                  <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4">
                    <Droplet className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-base font-semibold text-foreground">No matching requests</p>
                  <p className="text-sm text-muted-foreground mt-1.5">
                    {profile?.bloodGroup
                      ? `No pending requests need ${profile.bloodGroup} blood right now. Check back soon.`
                      : "No pending blood requests at the moment."}
                  </p>
                </div>
              ) : (
                <AnimatePresence>
                  {requests.map((req, i) => {
                    const meta = TIER_META[req.request_tier] ?? TIER_META.normal;
                    const isCritical = req.request_tier === "critical";
                    const firstName = req.patient_name.split(" ")[0];
                    const dist = simDistance(req.id);
                    return (
                      <motion.div key={req.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                        className={`relative bg-card rounded-2xl border-2 overflow-hidden mb-3 ${isCritical ? meta.border : "border-border"}`}>
                        {isCritical && (
                          <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.8, repeat: Infinity }}
                            className="absolute inset-0 rounded-2xl border-2 border-red-400 pointer-events-none" />
                        )}
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${meta.badge}`}>
                              {meta.icon} {meta.label}
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{dist}</span>
                              <span className="text-xs text-muted-foreground flex items-center gap-1"><Timer className="w-3 h-3" />{timeAgo(req.created_at)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                              <span className="text-primary font-bold text-sm">{req.blood_group}</span>
                            </div>
                            <div>
                              <p className="font-bold text-foreground text-base">{firstName} needs blood</p>
                              <p className="text-xs text-muted-foreground">{req.units_needed} unit{req.units_needed > 1 ? "s" : ""} of {req.blood_group}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{req.hospital_name} · {req.hospital_location}</span>
                          </div>
                          <div className="flex gap-2">
                            <Link href={`/requests/${req.id}`}
                              className="flex-1 h-10 rounded-xl border-2 border-border text-sm font-semibold text-foreground flex items-center justify-center gap-1.5">
                              View Details <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                            <Link href={`/requests/${req.id}?action=accept`}
                              className="flex-1 h-10 rounded-xl bg-primary text-white text-sm font-bold flex items-center justify-center gap-1.5">
                              <Heart className="w-3.5 h-3.5" /> Accept
                            </Link>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </section>
          </>
        )}

        {/* ── MY REQUESTS TAB ── */}
        {activeTab === "mine" && (
          <section>
            {loadingMine ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-4 animate-pulse h-28 mb-3" />
              ))
            ) : myRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4">
                  <Droplet className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-base font-semibold text-foreground">No requests yet</p>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                  Request blood when needed. Your requests will appear here.
                </p>
                <Link
                  href="/request-blood"
                  className="mt-4 inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-bold"
                >
                  <Plus className="w-4 h-4" /> Request Blood
                </Link>
              </div>
            ) : (
              <AnimatePresence>
                {myRequests.map((req, i) => {
                  const tierInfo = TIER_META[req.request_tier] ?? TIER_META.normal;
                  const statusInfo = STATUS_META[req.status] ?? { label: req.status, badge: "bg-muted text-muted-foreground" };
                  return (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-card rounded-2xl border border-border mb-3 overflow-hidden"
                    >
                      <Link href={`/requests/${req.id}`} className="block p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                              <span className="text-primary font-bold text-sm">{req.blood_group}</span>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-foreground">{req.patient_name.split(" ")[0]} needs blood</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{req.units_needed} unit{req.units_needed > 1 ? "s" : ""} · {req.blood_group}</p>
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${statusInfo.badge}`}>
                            {statusInfo.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1 truncate min-w-0">
                            <MapPin className="w-3 h-3 flex-shrink-0" />{req.hospital_name}
                          </span>
                          <span className="flex items-center gap-1 flex-shrink-0">
                            <Clock className="w-3 h-3" />{timeAgo(req.created_at)}
                          </span>
                        </div>
                        <div className="mt-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${tierInfo.badge}`}>
                            {tierInfo.icon} {tierInfo.label}
                          </span>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </section>
        )}
      </div>

      <nav className="fixed bottom-0 w-full max-w-[430px] bg-card/95 backdrop-blur-md border-t border-border flex justify-around py-3 pb-safe z-50">
        <Link href="/home" className="flex flex-col items-center gap-1 text-muted-foreground"><Heart className="w-5 h-5" /><span className="text-[10px] font-medium">Home</span></Link>
        <Link href="/donate" className="flex flex-col items-center gap-1 text-muted-foreground"><Droplet className="w-5 h-5" /><span className="text-[10px] font-medium">Donate</span></Link>
        <Link href="/requests" className="flex flex-col items-center gap-1 text-primary relative"><Activity className="w-5 h-5" /><span className="text-[10px] font-semibold">Requests</span></Link>
        <Link href="/profile" className="flex flex-col items-center gap-1 text-muted-foreground"><User className="w-5 h-5" /><span className="text-[10px] font-medium">Profile</span></Link>
      </nav>
      <style dangerouslySetInnerHTML={{ __html: `.pb-safe { padding-bottom: calc(0.75rem + env(safe-area-inset-bottom)); }` }} />
    </div>
  );
}
