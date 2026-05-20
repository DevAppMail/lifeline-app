import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  CheckCircle2, Droplet, Heart, Activity, User,
  AlertTriangle, Clock, Zap, ArrowRight,
} from "lucide-react";

const URGENCY_META: Record<string, { label: string; icon: React.ReactNode; badge: string }> = {
  emergency: {
    label: "Emergency",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  urgent: {
    label: "Urgent",
    icon: <Zap className="w-3.5 h-3.5" />,
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  scheduled: {
    label: "Scheduled",
    icon: <Clock className="w-3.5 h-3.5" />,
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
};

export default function RequestConfirmation() {
  const params = new URLSearchParams(window.location.search);
  const bloodGroup = params.get("bg") || "—";
  const urgency = params.get("urgency") || "scheduled";
  const hospital = params.get("hospital") || "—";
  const city = params.get("city") || "—";
  const units = params.get("units") || "1";

  const MATCH_TIME: Record<string, string> = { emergency: "2–4 hours", urgent: "24–48 hours" };
  const estimatedMatch = MATCH_TIME[urgency] ?? "1–3 days";

  const displayRequestId = params.get("rid") || "LL-" + Math.random().toString(36).substr(2, 6).toUpperCase();

  const rawConsent = localStorage.getItem("lifeline_consent_timestamp");
  const consentLogged = rawConsent
    ? new Date(rawConsent).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

  const rawIdentity = localStorage.getItem("lifeline_identity_verified");
  const identityStatus = rawIdentity === "true" ? "✓ Verified" : rawIdentity === "skipped" ? "Skipped (Emergency)" : "—";

  const meta = URGENCY_META[urgency] ?? URGENCY_META.scheduled;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background pb-24">
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center py-10">

        {/* Animated checkmark */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="relative mb-6"
        >
          <motion.div
            animate={{ scale: [1, 1.25, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 bg-emerald-500/20 rounded-full"
          />
          <motion.div
            animate={{ scale: [1, 1.5, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
            className="absolute inset-0 bg-emerald-500/10 rounded-full"
          />
          <div className="relative w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-12 h-12 text-white" />
          </div>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-bold text-foreground"
        >
          Request Submitted!
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-muted-foreground mt-2 text-sm max-w-xs leading-relaxed"
        >
          We are notifying eligible donors near you.
        </motion.p>

        {/* Summary card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-6 w-full bg-card border border-border rounded-2xl p-5 text-left space-y-3"
        >
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Request ID</span>
            <span className="text-sm font-bold text-primary">#{displayRequestId}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Blood Group</span>
            <div className="flex items-center gap-1.5">
              <Droplet className="w-3.5 h-3.5 text-primary fill-primary/50" />
              <span className="text-sm font-bold text-foreground">{bloodGroup}</span>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Urgency</span>
            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${meta.badge}`}>
              {meta.icon} {meta.label}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Hospital</span>
            <span className="text-sm font-semibold text-foreground text-right max-w-[55%] truncate">{hospital}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">City</span>
            <span className="text-sm font-semibold text-foreground">{city}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Units Needed</span>
            <span className="text-sm font-semibold text-foreground">{units}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Estimated Match</span>
            <span className="text-sm font-semibold text-primary">{estimatedMatch}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Consent Logged</span>
            <span className="text-sm font-semibold text-foreground">{consentLogged}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Identity</span>
            <span className="text-sm font-semibold text-foreground">{identityStatus}</span>
          </div>
        </motion.div>

        {/* Broadcasting pulse */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="mt-4 w-full px-4 py-3 bg-primary/10 rounded-xl"
        >
          <motion.div
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex items-center gap-2 justify-center"
          >
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm font-medium text-primary">Broadcasting to donors nearby…</span>
          </motion.div>
        </motion.div>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          className="mt-6 w-full space-y-3"
        >
          <Link
            href="/requests?tab=mine"
            className="flex w-full h-12 bg-primary text-white rounded-xl font-bold text-sm items-center justify-center gap-2"
          >
            <Activity className="w-4 h-4" /> View My Requests <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/home"
            className="flex w-full h-12 border-2 border-border text-foreground rounded-xl font-semibold text-sm items-center justify-center gap-2"
          >
            <Heart className="w-4 h-4" /> Go Home
          </Link>
        </motion.div>

        <p className="text-xs text-muted-foreground/60 mt-6 text-center leading-relaxed">
          You will be notified when a donor accepts your request
        </p>
      </div>

      <nav className="fixed bottom-0 w-full max-w-[430px] bg-card/95 backdrop-blur-md border-t border-border flex justify-around py-3 pb-safe z-50">
        <Link href="/home" className="flex flex-col items-center gap-1 text-muted-foreground">
          <Heart className="w-5 h-5" /><span className="text-[10px] font-medium">Home</span>
        </Link>
        <Link href="/donate" className="flex flex-col items-center gap-1 text-muted-foreground">
          <Droplet className="w-5 h-5" /><span className="text-[10px] font-medium">Donate</span>
        </Link>
        <Link href="/requests" className="flex flex-col items-center gap-1 text-muted-foreground">
          <Activity className="w-5 h-5" /><span className="text-[10px] font-medium">Requests</span>
        </Link>
        <Link href="/profile" className="flex flex-col items-center gap-1 text-muted-foreground">
          <User className="w-5 h-5" /><span className="text-[10px] font-medium">Profile</span>
        </Link>
      </nav>
      <style dangerouslySetInnerHTML={{ __html: `.pb-safe { padding-bottom: calc(0.75rem + env(safe-area-inset-bottom)); }` }} />
    </div>
  );
}
