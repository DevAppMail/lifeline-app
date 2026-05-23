import { useState, useEffect, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Droplet, Heart, Activity, User,
  Timer, Clock, Users, Stethoscope, Bell, Save, CheckCircle2,
  Pencil, Check, X, Plus, Trash2, Phone,
} from "lucide-react";
import { useProfile } from "@/context/profile-context";
import { getTimeline, getProviders, getPendingFollowUps, getCareCircle } from "@/lib/health-store";
import type { EmergencyContact } from "@/types/health";

function calcEligibility(lastDonationDate?: string) {
  if (!lastDonationDate) return { eligible: true, daysRemaining: 0, nextDate: "" };
  const next = new Date(lastDonationDate).getTime() + 90 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  if (now >= next) return { eligible: true, daysRemaining: 0, nextDate: "" };
  return {
    eligible: false,
    daysRemaining: Math.ceil((next - now) / 86400000),
    nextDate: new Date(next).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
  };
}

function generateContactId() {
  return `ec-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
}

export default function Health() {
  const [, setLocation] = useLocation();
  const { profile, updateProfile } = useProfile();

  // Live counts from health-store
  const [timelineCount, setTimelineCount] = useState(0);
  const [providersCount, setProvidersCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [careCircleCount, setCareCircleCount] = useState(0);

  // Health identity editing
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [eAllergies, setEAllergies] = useState("");
  const [eConditions, setEConditions] = useState("");
  const [eLanguage, setELanguage] = useState("");

  // Emergency contacts
  const [editingContacts, setEditingContacts] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactRel, setNewContactRel] = useState("");

  // Health notes
  const [userId, setUserId] = useState<number | null>(null);
  const [healthNotes, setHealthNotes] = useState(profile?.healthNotes ?? "");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  useEffect(() => {
    setTimelineCount(getTimeline().length);
    setProvidersCount(getProviders().length);
    setPendingCount(getPendingFollowUps().length);
    setCareCircleCount(getCareCircle().length);
  }, []);

  useEffect(() => {
    if (!profile?.phone) return;
    fetch(`/api/users/lookup?phone=${encodeURIComponent(profile.phone)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user) {
          setUserId(data.user.id ?? null);
          if (data.user.health_notes != null) {
            setHealthNotes(data.user.health_notes);
            updateProfile({ healthNotes: data.user.health_notes });
          }
        }
      })
      .catch(() => {});
  }, [profile?.phone]);

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

  const eligibility = calcEligibility(profile.lastDonationDate);
  const contacts = profile.emergency_contacts ?? [];

  const startEditIdentity = () => {
    setEAllergies((profile.allergies ?? []).join(", "));
    setEConditions((profile.chronic_conditions ?? []).join(", "));
    setELanguage(profile.preferred_language ?? "");
    setEditingIdentity(true);
  };

  const saveIdentity = () => {
    updateProfile({
      allergies: eAllergies.split(",").map(s => s.trim()).filter(Boolean),
      chronic_conditions: eConditions.split(",").map(s => s.trim()).filter(Boolean),
      preferred_language: eLanguage.trim() || undefined,
    });
    setEditingIdentity(false);
  };

  const addContact = () => {
    if (!newContactName.trim() || !newContactPhone.trim()) return;
    const contact: EmergencyContact = {
      id: generateContactId(),
      name: newContactName.trim(),
      phone: newContactPhone.trim(),
      relationship: newContactRel.trim() || "Contact",
    };
    updateProfile({ emergency_contacts: [...contacts, contact] });
    setNewContactName(""); setNewContactPhone(""); setNewContactRel("");
  };

  const removeContact = (id: string) => {
    updateProfile({ emergency_contacts: contacts.filter(c => c.id !== id) });
  };

  const hubCards = [
    {
      label: "Health Timeline",
      sub: timelineCount > 0 ? `${timelineCount} entries` : "Your health story",
      icon: <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
      bg: "bg-blue-50 dark:bg-blue-950/30",
      href: "/health-timeline",
    },
    {
      label: "Follow-Up Approvals",
      sub: pendingCount > 0 ? `${pendingCount} pending` : "All clear",
      icon: <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
      bg: "bg-amber-50 dark:bg-amber-950/30",
      href: "/follow-ups",
      badge: pendingCount,
    },
    {
      label: "My Providers",
      sub: providersCount > 0 ? `${providersCount} added` : "Add your care team",
      icon: <Stethoscope className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      href: "/providers",
    },
    {
      label: "Care Circle",
      sub: careCircleCount > 0 ? `${careCircleCount} members` : "Add trusted family",
      icon: <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />,
      bg: "bg-purple-50 dark:bg-purple-950/30",
      href: "/care-circle",
    },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background pb-24">

      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-4 border-b border-border">
        <button onClick={() => setLocation("/home")}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-muted hover:bg-muted/80">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold">My Health</h1>
          <p className="text-xs text-muted-foreground font-mono tracking-wider mt-0.5">
            {profile.lifeline_id ?? "Generating ID…"}
          </p>
        </div>
        {/* ABHA placeholder */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed border-border text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
          Link ABHA
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-5 space-y-5">

        {/* Donation Eligibility */}
        <div className={`rounded-2xl p-4 border-2 flex items-center gap-4 ${
          eligibility.eligible
            ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800"
            : "border-border bg-card"
        }`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            eligibility.eligible ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-muted"
          }`}>
            {eligibility.eligible
              ? <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2, repeat: Infinity }}
                  className="w-4 h-4 rounded-full bg-emerald-500" />
              : <Timer className="w-5 h-5 text-muted-foreground" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-bold text-sm ${eligibility.eligible ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"}`}>
              {eligibility.eligible ? "Eligible to donate today" : `Next eligible: ${eligibility.nextDate}`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {eligibility.eligible
                ? "You can safely donate blood right now."
                : `${eligibility.daysRemaining} days remaining — 90-day gap required.`}
            </p>
          </div>
          <Link href="/donate">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Link>
        </div>

        {/* Hub Grid */}
        <section>
          <h2 className="text-base font-bold text-foreground mb-3">Your Health</h2>
          <div className="grid grid-cols-2 gap-3">
            {hubCards.map((card) => (
              <Link key={card.label} href={card.href} className="block">
                <motion.div whileTap={{ scale: 0.97 }}
                  className={`${card.bg} rounded-2xl p-4 relative border border-transparent hover:border-border transition-colors`}>
                  {card.badge ? (
                    <span className="absolute top-3 right-3 min-w-[20px] h-5 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1.5">
                      {card.badge}
                    </span>
                  ) : null}
                  <div className="w-9 h-9 bg-white/60 dark:bg-black/20 rounded-xl flex items-center justify-center mb-3 shadow-sm">
                    {card.icon}
                  </div>
                  <p className="text-sm font-bold text-foreground leading-tight">{card.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
                </motion.div>
              </Link>
            ))}
          </div>
        </section>

        {/* Health Identity Snapshot */}
        <section className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="text-sm font-bold text-foreground">Health Identity</p>
            {editingIdentity ? (
              <div className="flex gap-2">
                <button onClick={() => setEditingIdentity(false)}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
                <button onClick={saveIdentity}
                  className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <button onClick={startEditIdentity}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <Pencil className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>

          <AnimatePresence mode="wait">
            {editingIdentity ? (
              <motion.div key="editing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="p-4 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Allergies <span className="font-normal">(comma-separated)</span>
                  </label>
                  <input value={eAllergies} onChange={e => setEAllergies(e.target.value)}
                    placeholder="e.g. Penicillin, Dust, Latex"
                    className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Chronic Conditions <span className="font-normal">(comma-separated)</span>
                  </label>
                  <input value={eConditions} onChange={e => setEConditions(e.target.value)}
                    placeholder="e.g. Diabetes, Hypertension"
                    className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Preferred Language
                  </label>
                  <select value={eLanguage} onChange={e => setELanguage(e.target.value)}
                    className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">Select language</option>
                    {["English", "Hindi", "Marathi", "Tamil", "Telugu", "Kannada", "Bengali", "Gujarati", "Punjabi", "Malayalam"].map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
              </motion.div>
            ) : (
              <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {[
                  {
                    label: "Allergies",
                    value: (profile.allergies ?? []).length > 0
                      ? (profile.allergies ?? []).join(", ")
                      : "None recorded",
                    warn: (profile.allergies ?? []).length > 0,
                  },
                  {
                    label: "Chronic Conditions",
                    value: (profile.chronic_conditions ?? []).length > 0
                      ? (profile.chronic_conditions ?? []).join(", ")
                      : "None recorded",
                    warn: false,
                  },
                  {
                    label: "Preferred Language",
                    value: profile.preferred_language || "Not set",
                    warn: false,
                  },
                ].map((row, i, arr) => (
                  <div key={row.label} className={`flex items-start gap-3 px-4 py-3 ${i < arr.length - 1 ? "border-b border-border" : ""}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">{row.label}</p>
                      <p className={`text-sm font-medium mt-0.5 ${row.warn ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
                        {row.value}
                      </p>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Emergency Contacts */}
        <section className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="text-sm font-bold text-foreground">Emergency Contacts</p>
            <button onClick={() => setEditingContacts(v => !v)}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              {editingContacts
                ? <X className="w-4 h-4 text-muted-foreground" />
                : <Plus className="w-4 h-4 text-muted-foreground" />}
            </button>
          </div>

          {contacts.map((c, i) => (
            <div key={c.id} className={`flex items-center gap-3 px-4 py-3 ${i < contacts.length - 1 || editingContacts ? "border-b border-border" : ""}`}>
              <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                <Phone className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.relationship} · {c.phone}</p>
              </div>
              {editingContacts && (
                <button onClick={() => removeContact(c.id)} className="text-destructive/70 hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}

          <AnimatePresence>
            {editingContacts && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden">
                <div className="p-4 space-y-2.5 border-t border-border">
                  <div className="grid grid-cols-2 gap-2">
                    <input value={newContactName} onChange={e => setNewContactName(e.target.value)}
                      placeholder="Name *"
                      className="px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                    <input value={newContactRel} onChange={e => setNewContactRel(e.target.value)}
                      placeholder="Relationship"
                      className="px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <input value={newContactPhone} onChange={e => setNewContactPhone(e.target.value)}
                    placeholder="Phone number *" type="tel"
                    className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                  <button onClick={addContact} disabled={!newContactName.trim() || !newContactPhone.trim()}
                    className="w-full py-2.5 bg-primary text-white text-sm font-bold rounded-xl disabled:opacity-50">
                    Add Contact
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {contacts.length === 0 && !editingContacts && (
            <div className="px-4 py-5 text-center">
              <p className="text-sm text-muted-foreground">No emergency contacts added.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Tap + to add family or friends.</p>
            </div>
          )}
        </section>

        {/* Health Notes */}
        <section className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Health Notes</p>
          <textarea
            value={healthNotes}
            onChange={e => { setHealthNotes(e.target.value); setNotesSaved(false); }}
            placeholder="Add medications, allergies, or notes for medical staff..."
            rows={4}
            className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
          <button onClick={handleSaveNotes} disabled={notesSaving}
            className={`mt-3 w-full h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60 ${
              notesSaved ? "bg-emerald-500 text-white" : "bg-primary text-white"
            }`}>
            {notesSaving
              ? <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              : notesSaved
              ? <><CheckCircle2 className="w-4 h-4" /> Saved</>
              : <><Save className="w-4 h-4" /> Save Notes</>}
          </button>
        </section>

      </div>

      {/* Bottom Nav */}
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
