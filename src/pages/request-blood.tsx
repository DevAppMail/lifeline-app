import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Clock, Zap, AlertTriangle, Droplet,
  Upload, FileText, CheckCircle2, Loader2, ArrowRight, X,
  Camera, MapPin, ShieldCheck, AlertCircle, ChevronDown,
  Shield, BookOpen, UserCheck, ExternalLink, ImagePlus, Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/context/profile-context";
import { createRequest } from "@/lib/request-store";

type Tier = "scheduled" | "urgent" | "emergency" | null;
type BloodGroup = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";

const BLOOD_GROUPS: BloodGroup[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const TIERS = [
  {
    id: "scheduled" as Tier,
    icon: <Clock className="w-6 h-6" />,
    label: "Scheduled",
    time: "3–7 days",
    fee: "₹99",
    feeNote: "Service fee",
    desc: "Best for planned procedures. We verify & match donors in advance.",
    color: "border-blue-300 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800",
    activeColor: "border-blue-500 bg-blue-50 dark:bg-blue-950/50",
    iconColor: "text-blue-600",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  },
  {
    id: "urgent" as Tier,
    icon: <Zap className="w-6 h-6" />,
    label: "Urgent",
    time: "48–72 hours",
    fee: "₹299",
    feeNote: "Deposit held",
    desc: "For time-sensitive needs. Priority matching with verified donors.",
    color: "border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800",
    activeColor: "border-amber-500 bg-amber-50 dark:bg-amber-950/50",
    iconColor: "text-amber-600",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  },
  {
    id: "emergency" as Tier,
    icon: <AlertTriangle className="w-6 h-6" />,
    label: "Emergency",
    time: "2–4 hours",
    fee: "₹499",
    feeNote: "Priority deposit",
    desc: "Critical situations. Broadcast to all available donors in your city.",
    color: "border-primary/30 bg-primary/5",
    activeColor: "border-primary bg-primary/10",
    iconColor: "text-primary",
    badge: "bg-primary/10 text-primary",
  },
];

const RELATIONSHIPS = ["Myself", "Spouse", "Parent", "Child", "Sibling", "Friend", "Other"];

function genRequestId() {
  return "LL-" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ─── FULL TERMS MODAL ─────────────────────────────────────────────────────────

function FullTermsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl max-h-[85dvh] flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-bold text-gray-900">Full Terms & Conditions</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-5 text-sm text-gray-700">
          {[
            {
              title: "About This Platform",
              body: "LifeLine is a technology platform that connects individuals who require blood with voluntary blood donors. We do not buy, sell, store, or supply blood. All donations facilitated through this platform are entirely voluntary in nature.",
            },
            {
              title: "Legal Compliance",
              body: "The sale or purchase of human blood is strictly prohibited under the Drugs and Cosmetics Act, 1940 and the Drug and Cosmetics Rules, 1945 as amended. The amount collected by LifeLine is solely a Platform Access and Technology Fee charged for providing matching infrastructure, notification services, verification systems, and technical coordination. This fee is in no way a payment for blood or blood products.",
            },
            {
              title: "Platform Role and Limitations",
              body: "LifeLine acts solely as a technology intermediary. We do not guarantee that any donor will accept your request, that any donor who accepts will be medically eligible to donate, that the donor will arrive at the designated location, that the required units will be fulfilled partially or completely, or that the platform will find a match within the requested timeframe. Donor availability depends on multiple factors beyond our control.",
            },
            {
              title: "Refund Policy",
              body: "The Platform Access Fee is non-refundable once donors have been notified and the matching process has been initiated. A full refund of the deposit will be processed only in the event that no donors are identified or notified for your request. In cases of partial fulfillment the fee will not be reversed.",
            },
            {
              title: "Your Responsibility",
              body: "By submitting a blood request on this platform, you acknowledge that LifeLine is one of several channels available to source blood and must not be treated as the sole or primary means of fulfilling your medical requirement. You are strongly advised to simultaneously contact your treating hospital's blood bank, the nearest government blood bank, licensed blood banks in your city, and relevant NGOs or voluntary blood donation organizations.",
            },
            {
              title: "Voluntary Nature of Donation",
              body: "Blood donation is a voluntary, humanitarian act. LifeLine does not and cannot compel, incentivize with monetary compensation, or coerce any donor to donate blood. Any donor retains the absolute right to decline, withdraw, or change their decision at any point without consequence.",
            },
            {
              title: "Medical Disclaimer",
              body: "LifeLine does not provide medical advice. All medical decisions remain the sole responsibility of the treating physician and the patient's family.",
            },
          ].map((s) => (
            <div key={s.title}>
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1.5">{s.title}</p>
              <p className="leading-relaxed text-gray-600">{s.body}</p>
            </div>
          ))}
        </div>
        <div className="flex-shrink-0 px-5 pb-6 pt-3 border-t border-gray-100">
          <Button className="w-full h-12 rounded-xl" onClick={onClose}>Done</Button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── LEGAL CONSENT OVERLAY ────────────────────────────────────────────────────

const CONSENT_VERSION = "1.0";

const ACCORDION_SECTIONS = [
  {
    icon: <Shield className="w-5 h-5" />,
    title: "Platform Role and Legal Compliance",
    summary: "What LifeLine is, and the law governing blood donation in India.",
    content: (
      <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
        <p>LifeLine is a <strong className="text-gray-800">technology intermediary</strong> — we connect blood requesters with voluntary donors. We do not buy, sell, store, or supply blood.</p>
        <p>The amount you pay is solely a <strong className="text-gray-800">Platform Access and Technology Fee</strong> for our matching and notification infrastructure. This is expressly not a payment for blood or any blood product, in compliance with the Drugs and Cosmetics Act, 1940.</p>
        <p>Blood donation in India is entirely voluntary and protected under Indian law.</p>
      </div>
    ),
  },
  {
    icon: <AlertCircle className="w-5 h-5" />,
    title: "What We Cannot Guarantee",
    summary: "Platform limitations and why you must use other channels too.",
    content: (
      <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
        <p>We cannot guarantee any of the following:</p>
        <ul className="space-y-2">
          {[
            "That a donor will accept your request",
            "That an accepting donor will be medically eligible at the time",
            "That a committed donor will arrive at the designated location",
            "That your full blood requirement will be met partially or completely",
            "That a match will be found within your requested timeframe",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="text-primary mt-0.5 font-bold">—</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-amber-800 text-xs font-medium">
          Dependence solely on this platform for a medical emergency is strongly discouraged. Please contact your hospital blood bank, government blood banks, and NGOs simultaneously.
        </p>
      </div>
    ),
  },
  {
    icon: <UserCheck className="w-5 h-5" />,
    title: "Your Responsibilities",
    summary: "Your obligations as a requester and how the fee works.",
    content: (
      <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
        <p>By submitting a request you confirm that:</p>
        <ul className="space-y-2">
          {[
            "You are using LifeLine as one of multiple channels to source blood, not as your only option",
            "The information you provide is accurate and truthful",
            "You accept that the Platform Access Fee is non-refundable once donor notification begins",
            "You will hold LifeLine harmless for any inability to fulfil your request",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="text-primary mt-0.5 font-bold">—</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p>A <strong className="text-gray-800">full refund</strong> is issued only if no donors are identified or notified for your request.</p>
      </div>
    ),
  },
];

const CHECKBOXES = [
  "I understand the fee is solely a Platform Access Fee — not a payment for blood.",
  "I accept that LifeLine cannot guarantee donor availability or fulfillment.",
  "I will simultaneously use other channels and hold LifeLine harmless for unfulfilled requests.",
];

function ConsentOverlay({ onAccept }: { onAccept: (ts: string) => void }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [checks, setChecks] = useState([false, false, false]);
  const [showTerms, setShowTerms] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(15);

  const timerDone = secondsLeft === 0;
  const canInteract = scrolledToBottom && timerDone;
  const allChecked = checks.every(Boolean);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop <= el.clientHeight + 80) {
      setScrolledToBottom(true);
    }
  };

  const toggle = (i: number) => setExpanded((prev) => (prev === i ? null : i));

  const handleAccept = () => {
    onAccept(new Date().toISOString());
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-12 pb-5 bg-white border-b border-gray-100">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Shield className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 leading-tight">Before You Continue</h1>
        <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
          Read all terms carefully. You must scroll to the bottom before confirming.
        </p>
        {/* Timer progress bar */}
        <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: "100%" }}
            animate={{ width: `${(secondsLeft / 15) * 100}%` }}
            transition={{ duration: 1, ease: "linear" }}
          />
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3" onScroll={handleScroll}>

        {/* Video placeholder */}
        <div className="bg-white rounded-xl shadow border border-gray-100 p-4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0 border border-red-100">
            <Play className="w-7 h-7 text-primary ml-1" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Watch before you proceed</p>
            <p className="text-xs text-gray-500 mt-1">90 seconds · This explains what LifeLine does and does not do</p>
          </div>
        </div>

        {/* Critical clauses */}
        <div className="space-y-2">
          {[
            "We do not guarantee you will find a donor",
            "Blood donation is entirely voluntary and cannot be forced",
            "Platform fee is non-refundable once matching begins",
          ].map((clause, i) => (
            <div key={i} style={{ backgroundColor: "#FFF5F5", borderLeft: "3px solid #C62828" }} className="rounded-r-xl px-4 py-3">
              <p className="text-sm font-bold text-red-800 leading-snug">{clause}</p>
            </div>
          ))}
        </div>

        {/* Accordion sections */}
        {ACCORDION_SECTIONS.map((section, i) => (
          <div key={i} className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
            <button
              onClick={() => toggle(i)}
              className="w-full flex items-center gap-3 px-4 py-4 text-left"
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                expanded === i ? "bg-primary text-white" : "bg-primary/10 text-primary"
              }`}>
                {section.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm leading-snug">{section.title}</p>
                {expanded !== i && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{section.summary}</p>
                )}
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${expanded === i ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {expanded === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-5 pt-1 border-t border-gray-100">
                    {section.content}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}

        {/* Read full terms link */}
        <button
          onClick={() => setShowTerms(true)}
          className="flex items-center gap-1.5 text-xs text-primary font-medium mx-auto py-1"
        >
          <BookOpen className="w-3.5 h-3.5" />
          Read full terms and conditions
          <ExternalLink className="w-3 h-3 opacity-70" />
        </button>

        {/* Scroll / timer gate */}
        {!timerDone && (
          <p className="text-center text-gray-400" style={{ fontSize: "13px" }}>
            Please read all terms — {secondsLeft} second{secondsLeft !== 1 ? "s" : ""} remaining
          </p>
        )}
        {timerDone && !scrolledToBottom && (
          <p className="text-center text-gray-400" style={{ fontSize: "13px" }}>
            Scroll to the bottom to unlock confirmation
          </p>
        )}

        {/* Checkboxes — locked until canInteract */}
        <div className={`bg-gray-50 rounded-2xl p-4 space-y-3 border border-gray-100 transition-opacity duration-300 ${!canInteract ? "opacity-40 pointer-events-none select-none" : ""}`}>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">I confirm that:</p>
          {CHECKBOXES.map((text, i) => (
            <button
              key={i}
              onClick={() => setChecks((c) => c.map((v, idx) => (idx === i ? !v : v)))}
              className={`w-full flex items-start gap-3 text-left p-3 rounded-xl border-2 transition-all ${
                checks[i]
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-gray-200 bg-white hover:border-primary/40"
              }`}
            >
              <div className={`mt-0.5 w-5 h-5 rounded-md flex-shrink-0 border-2 flex items-center justify-center transition-all ${
                checks[i] ? "bg-primary border-primary" : "border-gray-300"
              }`}>
                {checks[i] && <CheckCircle2 className="w-3 h-3 text-white" />}
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{text}</p>
            </button>
          ))}
        </div>

        {/* Consent version notice */}
        <p className="text-[10px] text-center text-gray-400 pb-1">
          Terms v{CONSENT_VERSION} · Consent is logged with timestamp and device info
        </p>
        <p className="text-center text-gray-400 pb-2" style={{ fontSize: "12px" }}>
          LifeLine is a voluntary donor matching platform — not a blood bank or medical service provider.
        </p>
      </div>

      {/* CTA */}
      <div className="flex-shrink-0 bg-white border-t border-gray-100 px-5 pt-4 pb-8">
        {canInteract && !allChecked && (
          <p className="text-xs text-center text-gray-400 mb-3">
            Check all three boxes above to continue
          </p>
        )}
        {!canInteract && (
          <p className="text-xs text-center text-gray-400 mb-3">
            {!timerDone ? `Read all terms — ${secondsLeft}s` : "Scroll to the bottom to continue"}
          </p>
        )}
        <Button
          className="w-full h-13 rounded-xl font-bold text-base"
          disabled={!allChecked || !canInteract}
          onClick={handleAccept}
        >
          <ShieldCheck className="w-5 h-5 mr-2" />
          I Agree — Continue
        </Button>
      </div>

      {/* Full terms modal */}
      <AnimatePresence>
        {showTerms && <FullTermsModal onClose={() => setShowTerms(false)} />}
      </AnimatePresence>
    </div>
  );
}

// ─── SELFIE CAPTURE ───────────────────────────────────────────────────────────

interface SelfieData {
  dataUrl: string;
  lat: number | null;
  lng: number | null;
  timestamp: string;
  userAgent: string;
}

type CameraMode =
  | "choice"        // show Camera + Upload options
  | "cam-prompt"    // show permission explanation before requesting
  | "cam-loading"   // requesting permission
  | "cam-active"    // live viewfinder
  | "preview"       // captured photo
  | "denied"        // camera permission denied
  | "upload-preview"; // uploaded image shown

function SelfieCapture({
  requesterName,
  tier,
  onCapture,
  onSkip,
}: {
  requesterName: string;
  tier: Tier;
  onCapture: (data: SelfieData) => void;
  onSkip: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [mode, setMode] = useState<CameraMode>("choice");
  const [preview, setPreview] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<"loading" | "done" | "denied">("loading");

  // Pre-fetch GPS silently
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus("done");
      },
      () => setGeoStatus("denied"),
      { timeout: 8000 }
    );
    return () => stopStream();
  }, []);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  // Bake overlay onto a canvas from any image source (video or img element)
  const bakeOverlay = useCallback(
    (source: HTMLVideoElement | HTMLImageElement, w: number, h: number): string => {
      const canvas = canvasRef.current!;
      const size = Math.min(w, h, 480);
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;

      const sx = (w - size) / 2;
      const sy = (h - size) / 2;

      // Mirror for selfie camera
      if (source instanceof HTMLVideoElement) {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(source, sx, sy, size, size, -size, 0, size, size);
        ctx.restore();
      } else {
        ctx.drawImage(source, sx, sy, size, size, 0, 0, size, size);
      }

      const now = new Date();
      const tsStr = now.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
      const gpsStr = coords
        ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
        : "GPS unavailable";

      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, size - 76, size, 76);

      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.floor(size / 24)}px sans-serif`;
      ctx.fillText(requesterName || "Requester", 12, size - 52);

      ctx.font = `${Math.floor(size / 28)}px sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(tsStr, 12, size - 32);

      ctx.font = `${Math.floor(size / 32)}px sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.fillText(gpsStr, 12, size - 14);

      ctx.fillStyle = "rgba(185,28,28,0.85)";
      ctx.font = `bold ${Math.floor(size / 26)}px sans-serif`;
      ctx.textAlign = "right";
      ctx.fillText("LifeLine", size - 12, 28);
      ctx.textAlign = "left";

      return canvas.toDataURL("image/jpeg", 0.72);
    },
    [coords, requesterName]
  );

  // ── Camera flow ──
  const handleRequestCamera = async () => {
    setMode("cam-loading");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera API not available");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 480 },
          height: { ideal: 480 },
        },
      });
      streamRef.current = stream;
      setMode("cam-active");
      // Attach stream after state update (next tick)
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch {
      setMode("denied");
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const dataUrl = bakeOverlay(video, video.videoWidth, video.videoHeight);
    setPreview(dataUrl);
    setMode("preview");
    stopStream();
  };

  const retake = async () => {
    setPreview(null);
    setMode("cam-prompt");
  };

  // ── Upload flow ──
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const dataUrl = bakeOverlay(img, img.naturalWidth, img.naturalHeight);
        setPreview(dataUrl);
        setMode("upload-preview");
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const acceptPhoto = () => {
    if (!preview) return;
    onCapture({
      dataUrl: preview,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    });
  };

  return (
    <div className="mt-5 bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <h3 className="font-bold text-base text-foreground flex items-center gap-2">
          <Camera className="w-4 h-4 text-primary" />
          Identity Verification
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          A photo helps us protect all parties. Your name, timestamp and GPS are overlaid on the image.
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* GPS chip */}
        <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl ${
          geoStatus === "done"
            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
            : geoStatus === "denied"
            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
            : "bg-muted text-muted-foreground"
        }`}>
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
          {geoStatus === "done" && coords
            ? `Location captured: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
            : geoStatus === "denied"
            ? "Location unavailable — will be noted in verification record"
            : "Acquiring location…"}
        </div>

        {/* ── CHOICE ── */}
        {mode === "choice" && (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMode("cam-prompt")}
              className="flex flex-col items-center gap-2.5 p-4 border-2 border-border rounded-2xl hover:border-primary/50 hover:bg-primary/5 transition-all"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                <Camera className="w-6 h-6 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">Take Selfie</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Use your camera</p>
              </div>
            </button>
            <button
              onClick={() => uploadRef.current?.click()}
              className="flex flex-col items-center gap-2.5 p-4 border-2 border-border rounded-2xl hover:border-primary/50 hover:bg-primary/5 transition-all"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                <ImagePlus className="w-6 h-6 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">Upload Selfie</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">From your gallery</p>
              </div>
            </button>
          </div>
        )}

        {/* ── CAM PROMPT ── */}
        {mode === "cam-prompt" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl p-5 space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-xl flex items-center justify-center flex-shrink-0">
                <Camera className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-semibold text-blue-900 dark:text-blue-200 text-sm">
                  LifeLine needs camera access
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-400 mt-1 leading-relaxed">
                  For identity verification. When your browser asks, please tap <strong>Allow</strong>. Your photo is stored securely and never shared with donors.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setMode("choice")}
                className="flex-1 h-10 rounded-xl text-sm font-medium border-2 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-400"
              >
                Go Back
              </button>
              <button
                onClick={handleRequestCamera}
                className="flex-1 h-10 rounded-xl text-sm font-bold bg-blue-600 text-white flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                Allow Camera Access
              </button>
            </div>
          </motion.div>
        )}

        {/* ── CAM LOADING ── */}
        {mode === "cam-loading" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Requesting camera access…</p>
          </div>
        )}

        {/* ── CAM ACTIVE ── */}
        {mode === "cam-active" && (
          <div className="space-y-3">
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-square">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                <p className="text-white text-xs font-medium text-center">{requesterName}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { stopStream(); setMode("choice"); }}
                className="h-11 rounded-xl text-sm font-medium border-2 border-border text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={capturePhoto}
                className="h-11 rounded-xl text-sm font-bold bg-primary text-white flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" /> Capture
              </button>
            </div>
          </div>
        )}

        {/* ── DENIED ── */}
        {mode === "denied" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl p-4">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">Camera access denied</p>
                <p className="text-xs text-red-600 dark:text-red-500 mt-1 leading-relaxed">
                  Your browser blocked camera access. You can upload a selfie from your phone gallery instead, or enable camera permission in your browser settings and try again.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode("cam-prompt")}
                className="h-11 rounded-xl text-sm font-medium border-2 border-border text-foreground flex items-center justify-center gap-1.5"
              >
                <Camera className="w-4 h-4" /> Try Again
              </button>
              <button
                onClick={() => uploadRef.current?.click()}
                className="h-11 rounded-xl text-sm font-bold bg-primary text-white flex items-center justify-center gap-1.5"
              >
                <ImagePlus className="w-4 h-4" /> Upload Instead
              </button>
            </div>
          </motion.div>
        )}

        {/* ── PREVIEW (camera or upload) ── */}
        {(mode === "preview" || mode === "upload-preview") && preview && (
          <div className="space-y-3">
            <div className="rounded-2xl overflow-hidden aspect-square">
              <img src={preview} alt="Verification selfie" className="w-full h-full object-cover" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setPreview(null);
                  setMode(mode === "upload-preview" ? "choice" : "cam-prompt");
                }}
                className="h-11 rounded-xl font-semibold text-sm border-2 border-border text-foreground"
              >
                Retake
              </button>
              <button
                onClick={acceptPhoto}
                className="h-11 rounded-xl font-bold text-sm bg-primary text-white flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" /> Use This Photo
              </button>
            </div>
          </div>
        )}

        {/* Hidden inputs */}
        <canvas ref={canvasRef} className="hidden" />
        <input
          ref={uploadRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={handleUpload}
        />

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Your photo and location are collected solely for fraud prevention and platform integrity. This information is never shared with donors, requesters, or any third parties and is stored securely.
        </p>

        {tier === "emergency" && (
          <button
            onClick={onSkip}
            className="w-full h-11 rounded-xl text-sm font-medium text-muted-foreground border border-border flex items-center justify-center gap-2"
          >
            <AlertTriangle className="w-4 h-4" />
            Skip for Emergency — complete later
          </button>
        )}
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────

export default function RequestBlood() {
  const [, setLocation] = useLocation();
  const { profile } = useProfile();

  const [consentAccepted, setConsentAccepted] = useState(false);
  const [consentTimestamp, setConsentTimestamp] = useState("");
  const [step, setStep] = useState(1);
  const [tier, setTier] = useState<Tier>(null);

  const [patientName, setPatientName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | "">("");
  const [units, setUnits] = useState<number>(1);
  const [hospital, setHospital] = useState("");
  const [hospitalCity, setHospitalCity] = useState("");
  const [reqDate, setReqDate] = useState("");
  const [reqTime, setReqTime] = useState("");

  const [docUploaded, setDocUploaded] = useState(false);
  const [docName, setDocName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [selfieData, setSelfieData] = useState<SelfieData | null>(null);
  const [selfieSkipped, setSelfieSkipped] = useState(false);

  const [paying, setPaying] = useState(false);
  const [requestId] = useState(genRequestId);
  const [submitting, setSubmitting] = useState(false);

  const selectedTier = TIERS.find((t) => t.id === tier);
  const isStep2Valid =
    patientName.trim().length >= 2 &&
    relationship !== "" &&
    bloodGroup !== "" &&
    hospital.trim().length >= 2 &&
    hospitalCity.trim().length >= 2 &&
    reqDate !== "";

  const isStep3Valid =
    docUploaded &&
    (selfieData !== null || selfieSkipped || tier === "emergency");

  const submitToApi = async (): Promise<{ id?: number } | null> => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/blood-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          requester_id: 1,
          patient_name: patientName,
          blood_group: bloodGroup,
          units_needed: units,
          hospital_name: hospital,
          hospital_location: hospitalCity,
          request_tier:
            tier === "scheduled" ? "normal" : tier === "urgent" ? "urgent" : "critical",
          status: "pending",
          requester_name: profile?.name ?? null,
          relationship,
          required_date: reqDate || null,
          required_time: reqTime || null,
          consent_accepted_at: consentTimestamp,
          consent_version: CONSENT_VERSION,
          verification_selfie_data: selfieData?.dataUrl ?? null,
          verification_lat: selfieData?.lat ?? null,
          verification_lng: selfieData?.lng ?? null,
          verification_timestamp: selfieData?.timestamp ?? null,
          verification_user_agent: selfieData?.userAgent ?? null,
          verification_skipped: selfieSkipped,
        }),
      });
      if (res.ok) return (await res.json()) as { id?: number };
      return null;
    } catch {
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  const handlePay = async () => {
    setPaying(true);
    await new Promise((r) => setTimeout(r, 2000));
    const result = await submitToApi();

    // Create local lifecycle-managed request for request-status tracking
    try {
      await createRequest(
        {
          patient_name: patientName,
          relationship,
          blood_group: bloodGroup as BloodGroup | "",
          units_needed: units,
          hospital_name: hospital,
          hospital_city: hospitalCity,
          required_date: reqDate,
          required_time: reqTime || undefined,
          tier: (tier ?? "scheduled") as "scheduled" | "urgent" | "emergency",
          doctor_note_uploaded: docUploaded,
          selfie_captured: selfieData !== null,
          consent_timestamp: consentTimestamp,
        },
        profile?.phone ?? "",
        profile?.name
      );
    } catch { /* silent — API result is authoritative */ }

    setPaying(false);
    const qs = new URLSearchParams({
      bg: bloodGroup,
      urgency: tier ?? "",
      hospital,
      city: hospitalCity,
      units: String(units),
    });
    if (result?.id) qs.set("id", String(result.id));
    else qs.set("rid", requestId);
    setLocation(`/request-confirmation?${qs}`);
  };

  const Header = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div className="flex items-start gap-3 mb-6">
      <button
        onClick={() => {
          if (step === 1) setLocation("/home");
          else setStep((s) => s - 1);
        }}
        className="w-10 h-10 rounded-full flex items-center justify-center bg-muted hover:bg-muted/80 flex-shrink-0 mt-0.5"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <div>
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );

  if (!consentAccepted) {
    return (
      <ConsentOverlay
        onAccept={(ts) => {
          setConsentTimestamp(ts);
          setConsentAccepted(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <div className="h-1 bg-muted">
        <motion.div className="h-full bg-primary" animate={{ width: `${(step / 4) * 100}%` }} transition={{ duration: 0.4 }} />
      </div>
      <div className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
          Consent accepted at {new Date(consentTimestamp).toLocaleTimeString()}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-10">
        <AnimatePresence mode="wait">

          {/* STEP 1 — TIER */}
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
              <Header title="Request Blood" subtitle="Choose how quickly you need it" />
              <div className="space-y-3">
                {TIERS.map((t) => (
                  <button key={t.id} onClick={() => setTier(t.id)}
                    className={`w-full text-left border-2 rounded-2xl p-4 transition-all ${tier === t.id ? t.activeColor + " shadow-sm" : t.color}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${t.badge}`}>{t.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground">{t.label}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${t.badge}`}>{t.fee}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{t.feeNote} · {t.time}</p>
                        <p className="text-xs text-foreground/70 mt-1.5 leading-relaxed">{t.desc}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <Button className="w-full h-12 mt-6 rounded-xl font-semibold" disabled={!tier} onClick={() => setStep(2)}>
                Continue <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </motion.div>
          )}

          {/* STEP 2 — PATIENT DETAILS */}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
              <Header title="Patient Details" subtitle="Tell us who needs blood" />
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Patient Full Name</Label>
                  <Input placeholder="e.g. Mohammad Karim" className="h-12 rounded-xl" value={patientName} onChange={(e) => setPatientName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Relationship to Patient</Label>
                  <div className="flex flex-wrap gap-2">
                    {RELATIONSHIPS.map((r) => (
                      <button key={r} onClick={() => setRelationship(r)}
                        className={`px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-all ${relationship === r ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground"}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Blood Group Needed</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {BLOOD_GROUPS.map((bg) => (
                      <button key={bg} onClick={() => setBloodGroup(bg)}
                        className={`h-12 rounded-xl text-sm font-bold border-2 transition-all ${bloodGroup === bg ? "bg-primary text-white border-primary shadow-sm" : "bg-card border-border text-foreground hover:border-primary/40"}`}>
                        {bg}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Units Needed</Label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((u) => (
                      <button key={u} onClick={() => setUnits(u)}
                        className={`w-12 h-12 rounded-xl text-sm font-bold border-2 transition-all ${units === u ? "bg-primary text-white border-primary" : "bg-card border-border text-foreground"}`}>
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Hospital Name</Label>
                  <Input placeholder="e.g. Dhaka Medical College" className="h-12 rounded-xl" value={hospital} onChange={(e) => setHospital(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Hospital City</Label>
                  <Input placeholder="e.g. Dhaka" className="h-12 rounded-xl" value={hospitalCity} onChange={(e) => setHospitalCity(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold">Required Date</Label>
                    <Input type="date" className="h-12 rounded-xl" value={reqDate} onChange={(e) => setReqDate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold">Time (optional)</Label>
                    <Input type="time" className="h-12 rounded-xl" value={reqTime} onChange={(e) => setReqTime(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="mt-4 border border-red-400 rounded-xl px-4 py-3 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#C62828" }} />
                <p className="leading-relaxed" style={{ fontSize: "13px", color: "#C62828" }}>
                  If this is a life-threatening emergency please contact emergency services on <strong>112</strong> and your nearest hospital blood bank immediately alongside this request.
                </p>
              </div>
              <Button className="w-full h-12 mt-6 rounded-xl font-semibold" disabled={!isStep2Valid} onClick={() => setStep(3)}>
                Continue <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </motion.div>
          )}

          {/* STEP 3 — DOCUMENT + SELFIE */}
          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
              <Header title="Doctor's Note" subtitle="Upload document & complete verification" />
              <div className="space-y-4">
                <div
                  onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${docUploaded ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 bg-muted/30"}`}
                >
                  {docUploaded ? (
                    <>
                      <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
                        <FileText className="w-7 h-7 text-primary" />
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-primary text-sm">{docName}</p>
                        <p className="text-xs text-muted-foreground mt-1">Tap to change</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center">
                        <Upload className="w-7 h-7 text-muted-foreground" />
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-foreground text-sm">Upload Document</p>
                        <p className="text-xs text-muted-foreground mt-1">Doctor's note, prescription, or hospital slip</p>
                        <p className="text-xs text-muted-foreground">JPG, PNG or PDF · Max 5MB</p>
                      </div>
                    </>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) { setDocUploaded(true); setDocName(file.name); }
                  }} />
                {docUploaded && (
                  <button onClick={() => { setDocUploaded(false); setDocName(""); }} className="flex items-center gap-1.5 text-sm text-destructive font-medium">
                    <X className="w-4 h-4" /> Remove document
                  </button>
                )}
              </div>

              {!selfieData && !selfieSkipped && (
                <SelfieCapture
                  requesterName={profile?.name ?? ""}
                  tier={tier}
                  onCapture={(data) => setSelfieData(data)}
                  onSkip={() => setSelfieSkipped(true)}
                />
              )}

              {selfieData && (
                <div className="mt-5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 flex items-center gap-3">
                  <img src={selfieData.dataUrl} alt="Selfie" className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border-2 border-emerald-300" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Identity Verified</p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">
                      {selfieData.lat ? `GPS: ${selfieData.lat.toFixed(3)}, ${selfieData.lng?.toFixed(3)}` : "GPS unavailable"} · {new Date(selfieData.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                  <button onClick={() => setSelfieData(null)} className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                    <X className="w-4 h-4 text-emerald-700" />
                  </button>
                </div>
              )}

              {selfieSkipped && (
                <div className="mt-5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Verification Skipped</p>
                    <p className="text-xs text-amber-600 mt-0.5">You can complete identity verification after your emergency is addressed.</p>
                  </div>
                  <button onClick={() => setSelfieSkipped(false)} className="text-xs text-amber-700 underline">Undo</button>
                </div>
              )}

              <Button
                className="w-full h-12 mt-6 rounded-xl font-semibold"
                disabled={!docUploaded || (!selfieData && !selfieSkipped && tier !== "emergency")}
                onClick={() => setStep(4)}
              >
                Review Request <ArrowRight className="ml-2 w-4 h-4" />
              </Button>

              {tier === "emergency" && !docUploaded && (
                <button onClick={() => setStep(4)} className="w-full h-12 mt-2 rounded-xl font-medium text-muted-foreground text-sm flex items-center justify-center gap-2 border border-border">
                  Skip document (Emergency)
                </button>
              )}
            </motion.div>
          )}

          {/* STEP 4 — REVIEW */}
          {step === 4 && (
            <motion.div key="s4" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
              <Header title="Review & Confirm" subtitle="Double check everything before submitting" />
              <div className="space-y-4">
                <div className={`border-2 rounded-2xl p-4 ${selectedTier?.activeColor}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedTier?.badge}`}>{selectedTier?.icon}</div>
                    <div>
                      <p className="font-bold text-foreground capitalize">{tier} Request</p>
                      <p className="text-xs text-muted-foreground">{selectedTier?.time} · {selectedTier?.feeNote}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                  {([
                    ["Patient", patientName],
                    ["Relationship", relationship],
                    ["Blood Group", bloodGroup],
                    ["Units", `${units} unit${units > 1 ? "s" : ""}`],
                    ["Hospital", hospital],
                    ["City", hospitalCity],
                    ["Date", reqDate || "—"],
                    ["Time", reqTime || "—"],
                    ["Document", docUploaded ? docName : "Not uploaded"],
                    ["Identity", selfieData ? "✓ Photo captured" : selfieSkipped ? "Skipped (Emergency)" : "—"],
                    ["Consent", new Date(consentTimestamp).toLocaleTimeString()],
                  ] as [string, string][]).map(([label, value]) => (
                    <div key={label} className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span className="text-sm font-semibold text-foreground text-right max-w-[55%] truncate">{value}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
                  <p className="text-sm font-bold text-foreground mb-3">Payment Summary</p>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">{selectedTier?.label} tier fee</span>
                    <span className="font-semibold">{selectedTier?.fee}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-3">
                    <span className="text-muted-foreground">Platform fee</span>
                    <span className="font-semibold text-green-600">Free</span>
                  </div>
                  <div className="border-t border-primary/20 pt-3 flex justify-between">
                    <span className="font-bold text-foreground">Total</span>
                    <span className="font-bold text-primary text-lg">{selectedTier?.fee}</span>
                  </div>
                </div>
              </div>
              {/* Emergency disclaimer */}
              <div className="mt-4 border-2 border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-red-700 dark:text-red-400">Emergency Disclaimer</p>
                    <p className="text-xs text-red-600 dark:text-red-500 mt-1 leading-relaxed">
                      LifeLine is a donor matching platform — <strong>not a hospital or blood bank</strong>. We cannot guarantee blood will be available. If this is a life-threatening emergency, contact your hospital blood bank, the nearest government blood bank, and emergency services immediately in addition to this request.
                    </p>
                  </div>
                </div>
              </div>

              <Button
                className="w-full h-14 mt-6 rounded-xl font-bold text-base"
                onClick={handlePay}
                disabled={paying || submitting}
              >
                {paying || submitting
                  ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> {paying ? "Processing…" : "Saving…"}</>
                  : <><CheckCircle2 className="w-5 h-5 mr-2" /> Pay {selectedTier?.fee} & Submit</>
                }
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
        <p className="text-center text-gray-400 pt-6 pb-2" style={{ fontSize: "12px" }}>
          LifeLine is a voluntary donor matching platform — not a blood bank or medical service provider.
        </p>
      </div>
    </div>
  );
}
