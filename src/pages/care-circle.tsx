import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Heart, Droplet, Activity, User, Users,
  Plus, X, Check, Phone, Mail, Shield, Eye, Calendar,
  Trash2,
} from "lucide-react";
import { useProfile } from "@/context/profile-context";
import {
  getCareCircle, addCareCircleMember, removeCareCircleMember, updateCareCircleMember, generateId,
} from "@/lib/health-store";
import type { CareCircleMember, CareCircleRole } from "@/types/health";

const ROLE_LABELS: Record<CareCircleRole, string> = {
  spouse:    "Spouse / Partner",
  parent:    "Parent",
  child:     "Child",
  sibling:   "Sibling",
  caregiver: "Caregiver",
  guardian:  "Guardian",
  friend:    "Friend",
  other:     "Other",
};

const ROLE_COLORS: Record<CareCircleRole, string> = {
  spouse:    "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",
  parent:    "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  child:     "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  sibling:   "bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400",
  caregiver: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  guardian:  "bg-teal-100 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400",
  friend:    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  other:     "bg-muted text-muted-foreground",
};

function getInitials(name: string): string {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

export default function CareCircle() {
  const [, setLocation] = useLocation();
  const { profile } = useProfile();
  const [members, setMembers] = useState<CareCircleMember[]>([]);
  const [adding, setAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [fName, setFName] = useState("");
  const [fRole, setFRole] = useState<CareCircleRole>("spouse");
  const [fPhone, setFPhone] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fEmergency, setFEmergency] = useState(false);
  const [fViewRecords, setFViewRecords] = useState(false);
  const [fManageAppts, setFManageAppts] = useState(false);

  useEffect(() => { setMembers(getCareCircle()); }, []);
  const refresh = () => setMembers(getCareCircle());

  const resetForm = () => {
    setFName(""); setFRole("spouse"); setFPhone(""); setFEmail("");
    setFEmergency(false); setFViewRecords(false); setFManageAppts(false);
  };

  const handleAdd = () => {
    if (!fName.trim() || !fPhone.trim()) return;
    addCareCircleMember({
      id: generateId(),
      name: fName.trim(),
      relationship: fRole,
      phone: fPhone.trim(),
      email: fEmail.trim() || undefined,
      is_emergency_contact: fEmergency,
      can_view_records: fViewRecords,
      can_manage_appointments: fManageAppts,
      added_at: new Date().toISOString(),
    });
    resetForm();
    setAdding(false);
    refresh();
  };

  const handleRemove = (id: string) => {
    removeCareCircleMember(id);
    refresh();
    if (expandedId === id) setExpandedId(null);
  };

  const togglePermission = (id: string, field: "can_view_records" | "can_manage_appointments" | "is_emergency_contact") => {
    const member = members.find(m => m.id === id);
    if (!member) return;
    updateCareCircleMember(id, { [field]: !member[field] });
    refresh();
  };

  if (!profile) return null;

  const emergencyContacts = members.filter(m => m.is_emergency_contact);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background pb-24">

      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-4 border-b border-border">
        <button onClick={() => setLocation("/health")}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-muted hover:bg-muted/80">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Care Circle</h1>
          <p className="text-sm text-muted-foreground">Trusted family & caregivers</p>
        </div>
        <button onClick={() => { setAdding(v => !v); if (adding) resetForm(); }}
          className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          {adding ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-4">

        {/* Add Member Form */}
        <AnimatePresence>
          {adding && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-4">
              <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <p className="text-sm font-bold text-foreground">Add Circle Member</p>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Full Name *</label>
                  <input value={fName} onChange={e => setFName(e.target.value)} placeholder="e.g. Meena Gaude"
                    className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Relationship</label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.entries(ROLE_LABELS) as [CareCircleRole, string][]).map(([role, label]) => (
                      <button key={role} onClick={() => setFRole(role)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                          fRole === role ? "bg-primary text-white border-primary" : "bg-card border-border text-foreground"
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Phone *</label>
                    <input value={fPhone} onChange={e => setFPhone(e.target.value)} type="tel"
                      className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Email</label>
                    <input value={fEmail} onChange={e => setFEmail(e.target.value)} type="email" placeholder="Optional"
                      className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Permissions</p>
                  {[
                    { label: "Mark as emergency contact", sub: "Can be contacted in emergencies", value: fEmergency, set: setFEmergency },
                    { label: "Can view health records", sub: "Access to your timeline and history", value: fViewRecords, set: setFViewRecords },
                    { label: "Can manage appointments", sub: "Book or cancel appointments on your behalf", value: fManageAppts, set: setFManageAppts },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-3 py-1">
                      <div className="flex-1">
                        <p className="text-sm text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.sub}</p>
                      </div>
                      <button onClick={() => item.set(v => !v)}
                        className={`w-10 h-6 rounded-full relative transition-colors flex-shrink-0 ${item.value ? "bg-primary" : "bg-muted"}`}>
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${item.value ? "translate-x-5" : "translate-x-1"}`} />
                      </button>
                    </div>
                  ))}
                </div>

                <button onClick={handleAdd} disabled={!fName.trim() || !fPhone.trim()}
                  className="w-full py-3 bg-primary text-white text-sm font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" /> Add Member
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Emergency Contacts strip */}
        {emergencyContacts.length > 0 && (
          <div className="mb-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-red-600 dark:text-red-400" />
              <p className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">Emergency Contacts</p>
            </div>
            {emergencyContacts.map(m => (
              <div key={m.id} className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{m.name}</p>
                <span className="text-xs text-muted-foreground">· {m.phone}</span>
              </div>
            ))}
          </div>
        )}

        {/* Members List */}
        {members.length === 0 && !adding ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-muted-foreground/30" />
            </div>
            <p className="text-base font-semibold text-foreground">Build your care circle</p>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-[270px]">
              Add trusted family members or caregivers who can support your health journey — especially important for elderly, rehabilitation, or chronic care.
            </p>
            <button onClick={() => setAdding(true)}
              className="mt-5 px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-xl">
              Add First Member
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((member, i) => {
              const isExpanded = expandedId === member.id;
              const roleColor = ROLE_COLORS[member.relationship];
              return (
                <motion.div key={member.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">

                  <button className="w-full flex items-center gap-3 p-4 text-left" onClick={() => setExpandedId(isExpanded ? null : member.id)}>
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-primary">{getInitials(member.name)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-foreground">{member.name}</p>
                        {member.is_emergency_contact && (
                          <span className="text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400 px-1.5 py-0.5 rounded-full">Emergency</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${roleColor}`}>
                          {ROLE_LABELS[member.relationship]}
                        </span>
                        <p className="text-xs text-muted-foreground">{member.phone}</p>
                      </div>
                    </div>
                    <ChevronLeft className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${isExpanded ? "-rotate-90" : "rotate-180"}`} />
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-border">
                        <div className="px-4 py-3 space-y-3">
                          {member.email && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5" /> {member.email}
                            </p>
                          )}

                          {/* Inline permission toggles */}
                          <div className="space-y-2">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Permissions</p>
                            {[
                              { label: "Emergency contact", field: "is_emergency_contact" as const, value: member.is_emergency_contact, icon: <Shield className="w-3.5 h-3.5" /> },
                              { label: "View records", field: "can_view_records" as const, value: member.can_view_records, icon: <Eye className="w-3.5 h-3.5" /> },
                              { label: "Manage appointments", field: "can_manage_appointments" as const, value: member.can_manage_appointments, icon: <Calendar className="w-3.5 h-3.5" /> },
                            ].map(perm => (
                              <div key={perm.field} className="flex items-center gap-2">
                                <span className="text-muted-foreground">{perm.icon}</span>
                                <span className="flex-1 text-sm text-foreground">{perm.label}</span>
                                <button onClick={() => togglePermission(member.id, perm.field)}
                                  className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${perm.value ? "bg-primary" : "bg-muted"}`}>
                                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${perm.value ? "translate-x-4" : "translate-x-0.5"}`} />
                                </button>
                              </div>
                            ))}
                          </div>

                          <button onClick={() => handleRemove(member.id)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 px-3 py-1.5 rounded-xl transition-colors">
                            <Trash2 className="w-3.5 h-3.5" /> Remove Member
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Consent notice */}
        {members.length > 0 && (
          <div className="mt-4 bg-muted/50 rounded-2xl p-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">You control your records.</span>{" "}
              Permissions above are stored locally. Full provider access controls and record sharing are coming in a future update.
            </p>
          </div>
        )}

        <div className="h-4" />
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
