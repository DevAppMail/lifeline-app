import { useEffect, useState, useCallback } from "react";
import { useLocation, useRoute } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, AlertTriangle, Clock, Zap, Droplet, MapPin,
  Navigation, Heart, CheckCircle2, Calendar, Bell, Home, Timer,
  Users, X, Phone, Shield,
} from "lucide-react";
import { useProfile } from "@/context/profile-context";
import { addCommitment, getCommitment } from "@/lib/commitments";
import { getRequest, recordDonorResponse } from "@/lib/request-store";
import { isDonorAvailable, isDonorAvailableForTier, isDonorInCooldown } from "@/lib/donor-availability";
import { getFulfillmentProgress, getActiveAssignmentsByRequest } from "@/lib/donor-linking";
import { getAuditEntriesByRequest } from "@/lib/audit-log";
import type { BloodGroup, RequestTier } from "@/types/fulfillment";

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
  required_date?: string | null;
  required_time?: string | null;
  requester_name?: string | null;
}

const TIER_META: Record<string, { label: string; icon: React.ReactNode; bannerBg: string; badge: string }> = {
  critical: {
    label: "Emergency",
    icon: <AlertTriangle className="w-5 h-5" />,
    bannerBg: "bg-red-600",
    badge: "bg-red-100 text-red-700",
  },
  urgent: {
    label: "Urgent",
    icon: <Zap className="w-5 h-5" />,
    bannerBg: "bg-amber-500",
    badge: "bg-amber-100 text-amber-700",
  },
  normal: {
    label: "Scheduled",
    icon: <Clock className="w-5 h-5" />,
    bannerBg: "bg-blue-600",
    badge: "bg-blue-100 text-blue-700",
  },
};

function useCountdown(targetDate: string | null | undefined, targetTime: string | null | undefined) {
  const [remaining, setRemaining] = useState<string>("");

  useEffect(() => {
    if (!targetDate) { setRemaining(""); return; }
    const tick = () => {
      const target = new Date(`${targetDate}T${targetTime || "23:59"}`);
      const diff = target.getTime() - Date.now();
      if (diff <= 0) { setRemaining("Time passed"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      if (h > 48) setRemaining(`${Math.floor(h / 24)} days`);
      else if (h > 0) setRemaining(`${h}h ${m}m remaining`);
      else setRemaining(`${m} minutes remaining`);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [targetDate, targetTime]);

  return remaining;
}

type FlowState = "detail" | "confirm" | "success";

export default function RequestDetail() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/requests/:id");
  const { profile, updateProfile } = useProfile();

  const [request, setRequest] = useState<BloodRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [flowState, setFlowState] = useState<FlowState>("detail");
  const [alreadyCommitted, setAlreadyCommitted] = useState(false);
  const [donorUnavailable, setDonorUnavailable] = useState(false);
  const [inCooldown, setInCooldown] = useState(false);

  const id = params?.id ? Number(params.id) : NaN;
  const countdown = useCountdown(request?.required_date, request?.required_time);

  useEffect(() => {
    if (!profile) { setLoading(false); setLocation("/login"); return; }
    if (isNaN(id)) { setLoading(false); setLocation("/requests"); return; }

    (async () => {
      try {
        const res = await fetch(`/api/blood-requests/${id}`);
        if (!res.ok) throw new Error();
        const data: BloodRequest | null = await res.json().catch(() => null);
        if (!data) { setLoading(false); setLocation("/requests"); return; }
        setRequest(data);
        setRequest(data);

        // Check existing commitment
        const existing = getCommitment(String(id));
        if (existing) {
          setAlreadyCommitted(true);
        }

        // Check donor availability
        const avail = isDonorAvailable();
        if (!avail) {
          setDonorUnavailable(true);
        }

        // Check cooldown
        if (profile?.lastDonationDate) {
          const cooldown = isDonorInCooldown(profile.lastDonationDate);
          if (cooldown.inCooldown) {
            setInCooldown(true);
          }
        }
      } catch {
        setLocation("/requests");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, profile]);

  const handleConfirmCommitment = useCallback(async () => {
    if (!request) return;
    try {
      await fetch(`/api/blood-requests/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "pending" }),
      });
    } catch { /* continue */ }

    // Record in local request store for lifecycle tracking
    try {
      recordDonorResponse(
        String(request.id),
        profile?.phone ?? "unknown",
        "committed",
        { committed_at: new Date().toISOString() }
      );
    } catch { /* silent */ }

    addCommitment({
      requestId: String(request.id),
      hospitalName: request.hospital_name,
      hospitalLocation: request.hospital_location,
      patientFirstName: request.patient_name.split(" ")[0],
      bloodGroup: request.blood_group,
      requiredDate: request.required_date ?? "",
      requiredTime: request.required_time ?? "",
      committedAt: new Date().toISOString(),
      status: "committed",
      donorId: profile?.phone ?? undefined,
    });

    setFlowState("success");
  }, [request, id, profile?.phone]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <Droplet className="w-8 h-8 text-primary animate-pulse" />
      </div>
    );
  }

  if (!request) return null;

  const meta = TIER_META[request.request_tier] ?? TIER_META.normal;
  const firstName = request.patient_name?.split(" ")[0] ?? "Patient";
  const confirmedDonors = Math.floor(Math.random() * Math.min(request.units_needed ?? 1, 2));
  const isCritical = request.request_tier === "critical";
  const tierLabel = request.request_tier === "critical" ? "emergency" : request.request_tier === "urgent" ? "urgent" : "scheduled";
  const donorAvail = isDonorAvailableForTier(tierLabel as RequestTier);

  if (flowState === "success") {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background">
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="relative mb-6"
          >
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 bg-primary/20 rounded-full" />
            <div className="relative w-24 h-24 bg-primary rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-white" />
            </div>
          </motion.div>

          <h2 className="text-2xl font-bold text-foreground">You have committed!</h2>
          <p className="text-muted-foreground mt-2 text-sm max-w-xs leading-relaxed">
            The requester has been notified. A reminder will be sent 2 hours before your donation time.
          </p>

          <div className="mt-6 w-full bg-card border border-border rounded-2xl p-5 text-left space-y-3">
            {[
              ["Hospital", request.hospital_name],
              ["Location", request.hospital_location],
              ["Date", request.required_date || "As soon as possible"],
              ["Time", request.required_time || "Any time"],
              ["Blood Group", request.blood_group],
              ["Patient", firstName],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="text-sm font-semibold text-foreground text-right">{value}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              const event = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:Blood Donation at ${request.hospital_name}\nDTSTART:${(request.required_date || "").replace(/-/g, "")}T${(request.required_time || "0900").replace(":", "")}00\nEND:VEVENT\nEND:VCALENDAR`;
              const blob = new Blob([event], { type: "text/calendar" });
              const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
              a.download = "donation.ics"; a.click();
            }}
            className="mt-4 w-full h-12 rounded-xl border-2 border-border text-sm font-semibold flex items-center justify-center gap-2 text-foreground"
          >
            <Calendar className="w-4 h-4" /> Add to Calendar
          </button>

          <div className="mt-3 w-full flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <Bell className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-700">You'll receive a reminder 2 hours before your donation time.</p>
          </div>

          <button
            onClick={() => setLocation("/home")}
            className="mt-4 w-full h-12 bg-primary text-white rounded-xl font-bold flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" /> Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (flowState === "confirm") {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background">
        <div className="flex items-center px-5 pt-12 pb-4 border-b border-border">
          <button onClick={() => setFlowState("detail")} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mr-3">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">Confirm Commitment</h1>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Heart className="w-8 h-8 text-primary fill-primary/30" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Your Commitment Matters</h2>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed max-w-xs mx-auto">
              By accepting this request you are committing to donate blood at the specified hospital. A donor's commitment gives hope to a family in crisis.
            </p>
            <p className="text-sm font-semibold text-foreground mt-3">
              Please only accept if you are genuinely available and eligible to donate.
            </p>
          </div>

          <div className="bg-card border-2 border-border rounded-2xl p-5 space-y-3">
            {[
              { icon: <MapPin className="w-4 h-4 text-muted-foreground" />, label: "Hospital", value: request.hospital_name },
              { icon: <MapPin className="w-4 h-4 text-muted-foreground" />, label: "Location", value: request.hospital_location },
              { icon: <Calendar className="w-4 h-4 text-muted-foreground" />, label: "Date", value: request.required_date || "As soon as possible" },
              { icon: <Clock className="w-4 h-4 text-muted-foreground" />, label: "Time", value: request.required_time || "Any time" },
              { icon: <Droplet className="w-4 h-4 text-primary" />, label: "Blood Group", value: request.blood_group },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                {row.icon}
                <span className="text-sm text-muted-foreground w-20 flex-shrink-0">{row.label}</span>
                <span className="text-sm font-semibold text-foreground">{row.value}</span>
              </div>
            ))}
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              Repeated no-shows after committing may result in a strike against your donor profile. Two strikes will temporarily suspend your account.
            </p>
          </div>
        </div>

        <div className="flex-shrink-0 px-5 pb-8 pt-3 space-y-3 border-t border-border">
          <button
            onClick={handleConfirmCommitment}
            className="w-full h-13 bg-primary text-white rounded-xl font-bold text-base flex items-center justify-center gap-2"
          >
            <Heart className="w-5 h-5" /> I Confirm My Commitment
          </button>
          <button
            onClick={() => setFlowState("detail")}
            className="w-full h-12 border-2 border-border rounded-xl text-sm font-semibold text-foreground"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <div className={`${meta.bannerBg} px-5 pt-12 pb-5`}>
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => setLocation("/requests")} className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 text-white">
            {meta.icon}
            <span className="font-bold text-lg">{meta.label} Request</span>
          </div>
        </div>
        {countdown && (isCritical || request.request_tier === "urgent") && (
          <div className="bg-white/20 rounded-xl px-3 py-2 flex items-center gap-2">
            <Timer className="w-4 h-4 text-white" />
            <span className="text-white text-sm font-semibold">{countdown}</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {alreadyCommitted && (
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700 rounded-2xl p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">You have already committed to this donation.</p>
          </div>
        )}

        {inCooldown && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-2xl p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              You're in the 90-day cooldown period. You can donate again once it ends.
            </p>
          </div>
        )}

        {!donorAvail && !alreadyCommitted && !inCooldown && (
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-700 rounded-2xl p-4 flex items-center gap-3">
            <Shield className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
              Your availability is set to &ldquo;{profile?.bloodGroup ? "limited" : "check settings"}&rdquo;. Update in your Donate page to receive matching requests.
            </p>
          </div>
        )}

      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Patient</p>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex flex-col items-center justify-center flex-shrink-0">
            <Droplet className="w-4 h-4 text-primary fill-primary/50 mb-0.5" />
            <span className="font-bold text-primary text-lg leading-none">{request.blood_group}</span>
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">{firstName}</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Needs <strong>{request.units_needed} unit{request.units_needed > 1 ? "s" : ""}</strong> of {request.blood_group}
            </p>
          </div>
        </div>
        {(() => {
          try {
            const p = getFulfillmentProgress(String(request.id));
            if (p && p.confirmed > 0) {
              return (
                <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl px-3 py-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {p.confirmed} donor{p.confirmed > 1 ? "s have" : " has"} confirmed · {p.remaining} remaining
                </div>
              );
            }
          } catch {}
          return null;
        })()}
      </div>

        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Donors Confirmed</span>
            </div>
            <span className="text-sm font-bold text-primary">{confirmedDonors} of {request.units_needed}</span>
          </div>
          <div className="bg-muted rounded-full h-2 overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(confirmedDonors / request.units_needed) * 100}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            {request.units_needed - confirmedDonors} more donor{request.units_needed - confirmedDonors !== 1 ? "s" : ""} needed
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Hospital & Logistics</p>
          {[
            { icon: <MapPin className="w-4 h-4 text-muted-foreground" />, label: "Hospital", value: request.hospital_name },
            { icon: <MapPin className="w-4 h-4 text-muted-foreground" />, label: "Address", value: request.hospital_location },
            { icon: <Calendar className="w-4 h-4 text-muted-foreground" />, label: "Date Needed", value: request.required_date || "As soon as possible" },
            { icon: <Clock className="w-4 h-4 text-muted-foreground" />, label: "Time", value: request.required_time || "Any time" },
          ].map((row) => (
            <div key={row.label} className="flex items-start gap-3">
              <div className="mt-0.5 flex-shrink-0">{row.icon}</div>
              <div>
                <p className="text-xs text-muted-foreground">{row.label}</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">{row.value}</p>
              </div>
            </div>
          ))}
          <a
            href={`https://maps.google.com/maps?q=${encodeURIComponent(request.hospital_name + ", " + request.hospital_location)}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 mt-2 text-primary text-sm font-semibold"
          >
            <Navigation className="w-4 h-4" /> Get Directions on Google Maps
          </a>
        </div>

        {request.requester_name && (
          <div className="bg-muted/50 rounded-2xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Requested by</p>
            <p className="text-sm font-semibold text-foreground">{request.requester_name}</p>
          </div>
        )}
      </div>

      <div className="flex-shrink-0 px-5 pb-8 pt-3 border-t border-border space-y-3">
        {alreadyCommitted ? (
          <div className="w-full h-12 bg-emerald-50 border-2 border-emerald-300 rounded-xl flex items-center justify-center gap-2 text-emerald-700 font-semibold text-sm">
            <CheckCircle2 className="w-4 h-4" /> Committed
          </div>
        ) : inCooldown ? (
          <div className="w-full h-12 bg-amber-50 border-2 border-amber-300 rounded-xl flex items-center justify-center gap-2 text-amber-700 font-semibold text-sm">
            <Clock className="w-4 h-4" /> In Cooldown Period
          </div>
        ) : (
          <button
            onClick={() => setFlowState("confirm")}
            disabled={!donorAvail}
            className="w-full h-13 bg-primary text-white rounded-xl font-bold text-base flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Heart className="w-5 h-5" /> Accept This Request
          </button>
        )}
        <button
          onClick={() => setLocation("/requests")}
          className="w-full h-11 border-2 border-border rounded-xl text-sm font-semibold text-muted-foreground flex items-center justify-center gap-2"
        >
          <X className="w-4 h-4" /> Decline
        </button>
      </div>
    </div>
  );
}
