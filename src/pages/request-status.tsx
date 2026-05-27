// ── Request Status Dashboard ─────────────────────────────────────────
// Requester-side operational tracking.
// Calm, confidence-building UX with clear lifecycle visibility.

import { useState, useEffect, useCallback } from "react";
import { useLocation, useSearchParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Droplet, Heart, Clock, MapPin, Phone,
  CheckCircle2, XCircle, AlertCircle, Loader2, AlertTriangle,
  User, Hospital, Shield, UserCheck, RefreshCw, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/context/profile-context";
import {
  getRequest,
  getRequestsByRequester,
  cancelRequest,
  checkAutoExpiry,
  transitionRequestStatus,
} from "@/lib/request-store";
import { getCurrentStage, getEscalationStageLabel, isEscalationActive, shouldEscalate, triggerEscalation } from "@/lib/escalation";
import { getFulfillmentProgress } from "@/lib/donor-linking";
import { getAuditEntriesByRequest } from "@/lib/audit-log";
import type { BloodRequestFull, RequestLifecycleStatus, EscalationStage } from "@/types/fulfillment";

const STATUS_VIEW_CONFIG: Record<RequestLifecycleStatus, { icon: React.ReactNode; label: string; color: string; badge: string; pulse: boolean }> = {
  draft:               { icon: <Clock className="w-5 h-5" />, label: "Draft", color: "text-muted-foreground", badge: "bg-muted text-muted-foreground", pulse: false },
  active:              { icon: <Loader2 className="w-5 h-5" />, label: "Searching for Donors", color: "text-blue-600", badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", pulse: true },
  searching:           { icon: <Loader2 className="w-5 h-5" />, label: "Contacting Donors", color: "text-amber-600", badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", pulse: true },
  partially_fulfilled: { icon: <CheckCircle2 className="w-5 h-5" />, label: "Partially Fulfilled", color: "text-emerald-600", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", pulse: false },
  fulfilled:           { icon: <Heart className="w-5 h-5" />, label: "Fulfilled", color: "text-emerald-700", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", pulse: false },
  cancelled:           { icon: <XCircle className="w-5 h-5" />, label: "Cancelled", color: "text-gray-500", badge: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", pulse: false },
  expired:             { icon: <AlertCircle className="w-5 h-5" />, label: "Expired", color: "text-amber-600", badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", pulse: false },
  failed:              { icon: <AlertTriangle className="w-5 h-5" />, label: "Unfulfilled", color: "text-red-600", badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", pulse: false },
};

function TimeCounter({ deadline }: { deadline?: string }) {
  const [display, setDisplay] = useState("");

  useEffect(() => {
    if (!deadline) { setDisplay("No deadline set"); return; }

    const update = () => {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) { setDisplay("Deadline passed"); return; }

      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setDisplay(h > 0 ? `${h}h ${m}m remaining` : `${m}m remaining`);
    };

    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (!deadline) return null;
  return (
    <span className="text-sm font-medium text-foreground">{display}</span>
  );
}

export default function RequestStatus() {
  const [, setLocation] = useLocation();
  const [params] = useSearchParams();
  const { profile } = useProfile();

  const requestId = params.get("id");
  const [request, setRequest] = useState<BloodRequestFull | null>(null);
  const [allRequests, setAllRequests] = useState<BloodRequestFull[]>([]);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Load data
  const loadData = useCallback(() => {
    checkAutoExpiry();

    if (requestId) {
      setRequest(getRequest(requestId) ?? null);
    } else if (profile?.phone) {
      setAllRequests(getRequestsByRequester(profile.phone));
    }
  }, [requestId, profile?.phone]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh every 15s
  useEffect(() => {
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleCancel = async () => {
    if (!request) return;
    setCancelling(true);
    await new Promise((r) => setTimeout(r, 500));
    cancelRequest(request.id, "Cancelled by requester");
    setShowCancelConfirm(false);
    setCancelling(false);
    loadData();
  };

  // ── Single Request View ──────────────────────────────────────────
  if (requestId && request) {
    const cfg = STATUS_VIEW_CONFIG[request.status];
    const fulfilledCount = request.units_fulfilled;
    const showCancel = ["active", "searching", "partially_fulfilled"].includes(request.status);

    return (
      <div className="min-h-[100dvh] flex flex-col bg-background">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-12 pb-4 border-b border-border">
          <button onClick={() => setLocation("/requests?tab=mine")} className="w-10 h-10 rounded-full flex items-center justify-center bg-muted hover:bg-muted/80">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Request Status</h1>
            <p className="text-sm text-muted-foreground">{request.lifeline_id}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pt-5 space-y-5 pb-24">

          {/* Status Hero */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`rounded-3xl p-6 border-2 ${
              request.status === "fulfilled" ? "bg-emerald-50 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-700" :
              request.status === "failed" ? "bg-red-50 border-red-300 dark:bg-red-950/30 dark:border-red-800" :
              request.status === "cancelled" ? "bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-700" :
              "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800"
            }`}
          >
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                request.status === "fulfilled" ? "bg-emerald-100 dark:bg-emerald-900/40" :
                request.status === "failed" ? "bg-red-100 dark:bg-red-900/40" :
                "bg-blue-100 dark:bg-blue-900/40"
              }`}>
                <div className={cfg.color}>{cfg.icon}</div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground">{cfg.label}</h2>
                  {cfg.pulse && (
                    <motion.div
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-2.5 h-2.5 rounded-full bg-blue-500"
                    />
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {request.tier === "emergency" ? "Emergency" : request.tier === "urgent" ? "Urgent" : "Scheduled"}
                  {' · '}{request.blood_group}
                  {' · '}{request.units_needed} unit{request.units_needed > 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {/* Time remaining */}
            {["active", "searching", "partially_fulfilled"].includes(request.status) && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-white/50 dark:bg-black/20 rounded-xl px-4 py-2.5">
                <Clock className="w-4 h-4" />
                <TimeCounter deadline={request.fulfillment_deadline} />
              </div>
            )}
          </motion.div>

          {/* Donor Progress */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-sm font-bold text-foreground mb-4">Donor Progress</h3>

            <div className="space-y-3">
              <ProgressRow icon={<User className="w-4 h-4" />} label="Donors Contacted" value={request.donors_contacted} max={20} color="bg-blue-500" />
              <ProgressRow icon={<CheckCircle2 className="w-4 h-4" />} label="Donors Committed" value={request.donors_committed} max={request.units_needed} color="bg-amber-500" />
              <ProgressRow icon={<Heart className="w-4 h-4" />} label="Units Fulfilled" value={fulfilledCount} max={request.units_needed} color="bg-emerald-500" />
            </div>

            {/* Multi-donor detail */}
            <FulfillmentDetail requestId={request.lifeline_id} unitsNeeded={request.units_needed} status={request.status} />

            {/* Units remaining indicator */}
            {request.status !== "fulfilled" && request.status !== "cancelled" && request.status !== "failed" && (
              <div className="mt-4 bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
                <p className="text-sm font-semibold text-foreground">
                  {Math.max(0, request.units_needed - fulfilledCount)} more unit{Math.max(0, request.units_needed - fulfilledCount) > 1 ? "s" : ""} needed
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {request.donors_committed > 0
                    ? "Donors have committed — they will arrive at the hospital"
                    : "We are notifying eligible donors in your area"}
                </p>
              </div>
            )}
          </div>

          {/* Escalation Status */}
          {["active", "searching", "partially_fulfilled"].includes(request.status) && (
            <EscalationStatusCard requestId={request.lifeline_id} tier={request.tier} />
          )}

          {/* Patient Info */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-sm font-bold text-foreground mb-3">Patient Details</h3>
            <div className="space-y-2.5">
              <InfoRow icon={<User className="w-4 h-4" />} label="Patient" value={request.patient_name} />
              <InfoRow icon={<Droplet className="w-4 h-4" />} label="Blood Group" value={request.blood_group} />
              <InfoRow icon={<Heart className="w-4 h-4" />} label="Relationship" value={request.relationship === "self" ? "Self" : request.relationship} />
              {request.patient_age && <InfoRow icon={<User className="w-4 h-4" />} label="Age" value={`${request.patient_age} years`} />}
            </div>
          </div>

          {/* Hospital Info */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-sm font-bold text-foreground mb-3">Hospital</h3>
            <div className="space-y-2.5">
              <InfoRow icon={<Hospital className="w-4 h-4" />} label="Hospital" value={request.hospital_name} />
              <InfoRow icon={<MapPin className="w-4 h-4" />} label="City" value={request.hospital_city} />
              {request.required_date && (
                <InfoRow icon={<Clock className="w-4 h-4" />} label="Required By" value={`${request.required_date}${request.required_time ? ` at ${request.required_time}` : ""}`} />
              )}
            </div>
          </div>

          {/* Status Timeline */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-sm font-bold text-foreground mb-3">Status Timeline</h3>
            <div className="space-y-3">
              {request.status_history.map((entry, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full border-2 ${
                      i === request.status_history.length - 1
                        ? "bg-primary border-primary"
                        : "bg-muted border-border"
                    }`} />
                    {i < request.status_history.length - 1 && (
                      <div className="w-0.5 h-8 bg-border" />
                    )}
                  </div>
                  <div className="flex-1 pb-3">
                    <p className="text-sm font-medium text-foreground capitalize">{entry.from} → {entry.to}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleString("en-IN", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                    {entry.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5">{entry.notes}</p>
                    )}
                  </div>
                </div>
              ))}
              {request.status_history.length === 0 && (
                <p className="text-sm text-muted-foreground">No status changes recorded</p>
              )}
            </div>
          </div>

          {/* Cancel */}
          {showCancel && (
            <div className="border-t border-border pt-4">
              {!showCancelConfirm ? (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="w-full h-12 rounded-xl border-2 border-red-200 text-red-600 font-semibold text-sm flex items-center justify-center gap-2"
                >
                  <XCircle className="w-4 h-4" /> Cancel Request
                </button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl p-4 space-y-3"
                >
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                    Are you sure you want to cancel?
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-500 leading-relaxed">
                    This will notify any committed donors that the request has been cancelled. Processing fees already incurred may not be refundable.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowCancelConfirm(false)}
                      className="flex-1 h-11 rounded-xl border-2 border-border text-foreground font-medium text-sm"
                    >
                      Keep Request
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={cancelling}
                      className="flex-1 h-11 rounded-xl bg-red-600 text-white font-bold text-sm flex items-center justify-center gap-2"
                    >
                      {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      Yes, Cancel
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* Suggestion for unfulfilled */}
          {(request.status === "failed" || request.status === "expired") && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                    We were unable to find donors
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-1 leading-relaxed">
                    Please contact your hospital blood bank directly or visit the nearest government blood bank. You can also try submitting a new request with a longer timeframe.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── All Requests List ──────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <div className="flex items-center gap-3 px-5 pt-12 pb-4 border-b border-border">
        <button onClick={() => setLocation("/requests")} className="w-10 h-10 rounded-full flex items-center justify-center bg-muted hover:bg-muted/80">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">My Requests</h1>
          <p className="text-sm text-muted-foreground">Track your blood requests</p>
        </div>
        <button onClick={loadData} className="ml-auto w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-24 space-y-3">
        {allRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4">
              <Droplet className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-bold text-foreground">No Requests Yet</h2>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-xs leading-relaxed">
              When you request blood, you'll see the status here.
            </p>
            <Button onClick={() => setLocation("/request-blood")} className="mt-5 h-12 rounded-xl font-semibold">
              Request Blood Now
            </Button>
          </div>
        ) : (
          allRequests
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map((req) => {
              const cfg = STATUS_VIEW_CONFIG[req.status];
              return (
                <motion.button
                  key={req.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setLocation(`/request-status?id=${req.lifeline_id}`)}
                  className="w-full bg-card border border-border rounded-2xl p-4 text-left hover:border-primary/30 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      req.status === "fulfilled" ? "bg-emerald-50" :
                      req.status === "failed" || req.status === "cancelled" ? "bg-muted" :
                      "bg-primary/10"
                    }`}>
                      <div className={cfg.color}>{cfg.icon}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-foreground">{req.blood_group}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          req.tier === "emergency" ? "bg-primary/10 text-primary" :
                          req.tier === "urgent" ? "bg-amber-100 text-amber-700" :
                          "bg-blue-100 text-blue-700"
                        }`}>
                          {req.tier === "emergency" ? "Emergency" : req.tier === "urgent" ? "Urgent" : "Scheduled"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {req.patient_name} · {req.hospital_name}, {req.hospital_city}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {req.donors_committed > 0
                          ? `${req.donors_committed} donor${req.donors_committed > 1 ? "s" : ""} committed`
                          : req.status === "active" || req.status === "searching"
                          ? "Searching for donors..."
                          : req.status === "fulfilled"
                          ? "All donors confirmed"
                          : "No donors found"}
                        {' · '}{req.units_needed} unit{req.units_needed > 1 ? "s" : ""} needed
                      </p>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-muted-foreground rotate-180 flex-shrink-0" />
                  </div>
                </motion.button>
              );
            })
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function ProgressRow({ icon, label, value, max, color }: {
  icon: React.ReactNode; label: string; value: number; max: number; color: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <span className="text-sm font-semibold text-foreground">{value}{max > 0 ? `/${max}` : ""}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
        <div className="text-muted-foreground">{icon}</div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground truncate">{value || "—"}</p>
      </div>
    </div>
  );
}

// ── Sprint 2: Multi-Donor Fulfillment Detail ────────────────────────

function FulfillmentDetail({ requestId, unitsNeeded, status }: { requestId: string; unitsNeeded: number; status: string }) {
  const progress = (() => {
    try { return getFulfillmentProgress(requestId); } catch { return null; }
  })();

  if (!progress || (progress.assigned === 0 && progress.confirmed === 0)) return null;

  return (
    <div className="mt-4 border-t border-border pt-3">
      <p className="text-xs font-semibold text-muted-foreground mb-2">Per-Donor Status</p>
      <div className="space-y-1.5">
        {progress.confirmed > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-emerald-600 font-medium">{progress.confirmed} confirmed</span>
          </div>
        )}
        {progress.committed > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-amber-600 font-medium">{progress.committed} committed</span>
          </div>
        )}
        {progress.noShows > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-red-500 font-medium">{progress.noShows} no-show</span>
          </div>
        )}
        {progress.assigned > 0 && progress.remaining > 0 && status !== "fulfilled" && (
          <p className="text-xs text-muted-foreground mt-1">
            {progress.remaining} of {unitsNeeded} units still needed
          </p>
        )}
      </div>
    </div>
  );
}

// ── Sprint 2: Escalation Status Card ────────────────────────────────

function EscalationStatusCard({ requestId, tier }: { requestId: string; tier: string }) {
  const stage = getCurrentStage(requestId);
  const active = isEscalationActive(requestId);

  if (!stage) return null;

  const escalationCheck = shouldEscalate(requestId);
  const stageLabel = getEscalationStageLabel(stage);

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <h3 className="text-sm font-bold text-foreground mb-3">Search Progress</h3>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
          <Search className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{stageLabel}</p>
          <p className="text-xs text-muted-foreground">
            {active ? "Searching within current radius" : "Search stopped"}
          </p>
        </div>
      </div>

      {active && escalationCheck.needsEscalation && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
            {escalationCheck.suggestedAction}
          </p>
        </div>
      )}
    </div>
  );
}
