import { useState, useEffect, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Heart, Droplet, Activity, User, Stethoscope,
  Plus, X, Check, Phone, MapPin, Calendar, ChevronRight,
  Trash2, Pencil, Star,
} from "lucide-react";
import { useProfile } from "@/context/profile-context";
import {
  getProviders, addProvider, removeProvider, updateProvider, generateId,
} from "@/lib/health-store";
import { getProviderVisitStats, getProviderContinuityLabel } from "@/lib/continuity-intelligence";
import type { LinkedProvider, ProviderType } from "@/types/health";
import { BottomNav } from "@/components/bottom-nav";

const PROVIDER_TYPE_CONFIG: Record<ProviderType, { label: string; color: string; bg: string }> = {
  doctor:                   { label: "Doctor",                  color: "text-blue-700 dark:text-blue-400",     bg: "bg-blue-100 dark:bg-blue-950/30" },
  physiotherapist:          { label: "Physiotherapist",         color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-950/30" },
  occupational_therapist:   { label: "Occupational Therapist",  color: "text-teal-700 dark:text-teal-400",    bg: "bg-teal-100 dark:bg-teal-950/30" },
  speech_therapist:         { label: "Speech Therapist",        color: "text-purple-700 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-950/30" },
  nurse:                    { label: "Nurse",                   color: "text-pink-700 dark:text-pink-400",     bg: "bg-pink-100 dark:bg-pink-950/30" },
  palliative_care_provider: { label: "Palliative Care",         color: "text-rose-700 dark:text-rose-400",    bg: "bg-rose-100 dark:bg-rose-950/30" },
  home_visit_provider:      { label: "Home Visit",              color: "text-amber-700 dark:text-amber-400",  bg: "bg-amber-100 dark:bg-amber-950/30" },
  clinic:                   { label: "Clinic",                  color: "text-slate-700 dark:text-slate-400",  bg: "bg-slate-100 dark:bg-slate-800" },
  multi_provider_clinic:    { label: "Multi-Provider Clinic",   color: "text-indigo-700 dark:text-indigo-400", bg: "bg-indigo-100 dark:bg-indigo-950/30" },
  home_care:                { label: "Home Care",               color: "text-amber-700 dark:text-amber-400",  bg: "bg-amber-100 dark:bg-amber-950/30" },
  specialist:               { label: "Specialist",              color: "text-red-700 dark:text-red-400",      bg: "bg-red-100 dark:bg-red-950/30" },
  other:                    { label: "Other",                   color: "text-muted-foreground",               bg: "bg-muted" },
};

// Only show current types in the add form — legacy values still render correctly if stored
const CURRENT_PROVIDER_TYPES: ProviderType[] = [
  "doctor", "physiotherapist", "occupational_therapist", "speech_therapist",
  "nurse", "palliative_care_provider", "home_visit_provider", "clinic", "multi_provider_clinic",
];
const PROVIDER_TYPES = CURRENT_PROVIDER_TYPES.map(t => [t, PROVIDER_TYPE_CONFIG[t]] as [ProviderType, typeof PROVIDER_TYPE_CONFIG[ProviderType]]);

export default function Providers() {
  const [, setLocation] = useLocation();
  const { profile } = useProfile();
  const [providers, setProviders] = useState<LinkedProvider[]>([]);
  const [adding, setAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [fName, setFName] = useState("");
  const [fSpecialty, setFSpecialty] = useState("");
  const [fType, setFType] = useState<ProviderType>("doctor");
  const [fClinic, setFClinic] = useState("");
  const [fLocation, setFLocation] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [fLastVisit, setFLastVisit] = useState("");
  const [fNextFollowUp, setFNextFollowUp] = useState("");
  const [fNotes, setFNotes] = useState("");

  useEffect(() => { setProviders(getProviders()); }, []);
  const refresh = () => setProviders(getProviders());

  const visitStats = useMemo(() => getProviderVisitStats(), []);
  const sortedProviders = useMemo(() => {
    return [...providers].sort((a, b) => {
      const aStats = visitStats.find(v => v.name === a.name);
      const bStats = visitStats.find(v => v.name === b.name);
      const aVisits = aStats?.totalVisits ?? 0;
      const bVisits = bStats?.totalVisits ?? 0;
      if (bVisits !== aVisits) return bVisits - aVisits;
      const aHasFollowUp = a.next_follow_up_date && new Date(a.next_follow_up_date) >= new Date();
      const bHasFollowUp = b.next_follow_up_date && new Date(b.next_follow_up_date) >= new Date();
      if (aHasFollowUp && !bHasFollowUp) return -1;
      if (!aHasFollowUp && bHasFollowUp) return 1;
      return b.added_at.localeCompare(a.added_at);
    });
  }, [providers, visitStats]);

  const resetForm = () => {
    setFName(""); setFSpecialty(""); setFType("doctor"); setFClinic("");
    setFLocation(""); setFPhone(""); setFLastVisit(""); setFNextFollowUp(""); setFNotes("");
  };

  const handleAdd = () => {
    if (!fName.trim()) return;
    addProvider({
      id: generateId(),
      name: fName.trim(),
      specialty: fSpecialty.trim() || PROVIDER_TYPE_CONFIG[fType].label,
      provider_type: fType,
      clinic_name: fClinic.trim() || undefined,
      location: fLocation.trim() || undefined,
      phone: fPhone.trim() || undefined,
      last_visit_date: fLastVisit || undefined,
      next_follow_up_date: fNextFollowUp || undefined,
      user_notes: fNotes.trim() || undefined,
      added_at: new Date().toISOString(),
    });
    resetForm();
    setAdding(false);
    refresh();
  };

  const handleRemove = (id: string) => {
    removeProvider(id);
    refresh();
    if (expandedId === id) setExpandedId(null);
  };

  if (!profile) return null;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background pb-24">

      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-4 border-b border-border">
        <button onClick={() => setLocation("/health")}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-muted hover:bg-muted/80">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">My Care Team</h1>
          <p className="text-sm text-muted-foreground">Your healthcare providers</p>
        </div>
        <button onClick={() => { setAdding(v => !v); if (adding) resetForm(); }}
          className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          {adding ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-4">

        {/* Add Provider Form */}
        <AnimatePresence>
          {adding && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-4">
              <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <p className="text-sm font-bold text-foreground">Add Provider</p>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Name *</label>
                  <input value={fName} onChange={e => setFName(e.target.value)} placeholder="Dr. Priya Sharma"
                    className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Provider Type</label>
                  <div className="flex flex-wrap gap-2">
                    {PROVIDER_TYPES.map(([type, cfg]) => (
                      <button key={type} onClick={() => setFType(type)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                          fType === type ? "bg-primary text-white border-primary" : "bg-card border-border text-foreground"
                        }`}>
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Specialty</label>
                    <input value={fSpecialty} onChange={e => setFSpecialty(e.target.value)} placeholder="e.g. Cardiology"
                      className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Clinic / Hospital</label>
                    <input value={fClinic} onChange={e => setFClinic(e.target.value)} placeholder="Optional"
                      className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Phone</label>
                    <input value={fPhone} onChange={e => setFPhone(e.target.value)} type="tel" placeholder="Optional"
                      className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Location</label>
                    <input value={fLocation} onChange={e => setFLocation(e.target.value)} placeholder="City / Area"
                      className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Last Visit</label>
                    <input type="date" value={fLastVisit} onChange={e => setFLastVisit(e.target.value)}
                      max={new Date().toISOString().split("T")[0]}
                      className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Next Follow-Up</label>
                    <input type="date" value={fNextFollowUp} onChange={e => setFNextFollowUp(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Notes</label>
                  <input value={fNotes} onChange={e => setFNotes(e.target.value)} placeholder="Any notes about this provider"
                    className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                </div>

                <button onClick={handleAdd} disabled={!fName.trim()}
                  className="w-full py-3 bg-primary text-white text-sm font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" /> Add Provider
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Providers List */}
        {providers.length === 0 && !adding ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4">
              <Stethoscope className="w-8 h-8 text-muted-foreground/30" />
            </div>
            <p className="text-base font-semibold text-foreground">Build your care team</p>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-[280px]">
              Add your doctors, therapists, and healthcare providers to track your care journey over time.
            </p>
            <button onClick={() => setAdding(true)}
              className="mt-5 px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-xl">
              Add First Provider
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedProviders.map((provider, i) => {
              const cfg = PROVIDER_TYPE_CONFIG[provider.provider_type];
              const isExpanded = expandedId === provider.id;
              const hasUpcoming = provider.next_follow_up_date && new Date(provider.next_follow_up_date) >= new Date();
              const stats = visitStats.find(v => v.name === provider.name);
              const visitCount = stats?.totalVisits ?? 0;
              const continuityLabel = getProviderContinuityLabel(provider.name);
              const isTrusted = visitCount >= 3;
              return (
                <motion.div key={provider.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className={`bg-card border rounded-2xl overflow-hidden shadow-sm ${isTrusted ? "border-amber-200 dark:border-amber-800/30" : "border-border"}`}>
                  <button className="w-full flex items-start gap-3 p-4 text-left" onClick={() => setExpandedId(isExpanded ? null : provider.id)}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
                      <Stethoscope className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-bold text-foreground">{provider.name}</p>
                            {isTrusted && <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />}
                          </div>
                          <p className="text-xs text-muted-foreground">{provider.specialty}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                            {cfg.label}
                          </span>
                          <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                        </div>
                      </div>
                      {provider.clinic_name && (
                        <p className="text-xs text-muted-foreground mt-1">{provider.clinic_name}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className={`text-xs flex items-center gap-1 ${visitCount > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                          {continuityLabel}
                        </span>
                        {!provider.last_visit_date && visitCount > 0 && stats?.lastVisit ? (
                          <span className="text-xs text-muted-foreground">
                            Last: {new Date(stats.lastVisit).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </span>
                        ) : provider.last_visit_date && (
                          <span className="text-xs text-muted-foreground">
                            Last: {new Date(provider.last_visit_date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </span>
                        )}
                        {visitCount > 1 && (
                          <span className="text-xs text-muted-foreground">
                            {visitCount} visits
                          </span>
                        )}
                        {hasUpcoming && (
                          <span className="text-xs text-primary font-semibold">
                            Follow-up: {new Date(provider.next_follow_up_date! + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-border">
                        <div className="px-4 py-3 space-y-2">
                          {provider.location && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 flex-shrink-0" /> {provider.location}
                            </p>
                          )}
                          {provider.phone && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 flex-shrink-0" /> {provider.phone}
                            </p>
                          )}
                          {provider.user_notes && (
                            <p className="text-xs text-muted-foreground italic">"{provider.user_notes}"</p>
                          )}
                          <div className="flex gap-2 pt-1">
                            <button onClick={() => handleRemove(provider.id)}
                              className="flex items-center gap-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 px-3 py-1.5 rounded-xl transition-colors">
                              <Trash2 className="w-3.5 h-3.5" /> Remove
                            </button>
                            <Link href="/follow-ups"
                              className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-xl transition-colors">
                              Add Follow-Up
                            </Link>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}

        <div className="h-4" />
      </div>

      <BottomNav />
    </div>
  );
}
