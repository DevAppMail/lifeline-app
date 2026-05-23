import { useState, useEffect, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Pencil, Check, X, LogOut, Bell, Lock,
  Heart, Droplet, Activity, User, MapPin, Briefcase,
  ShieldCheck, Trophy, Flame, Users, ChevronRight,
  CalendarDays, Clock, Star, AlertTriangle, RotateCcw,
  CheckCircle2, XCircle, AlertCircle, Stethoscope, ChevronDown, ChevronUp,
} from "lucide-react";
import { useProfile, BloodGroup } from "@/context/profile-context";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const BLOOD_GROUPS: BloodGroup[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

type AppointmentRow = {
  id: number;
  doctor_id: number;
  doctor_name: string;
  doctor_specialty: string;
  appointment_date: string;
  appointment_time: string | null;
  status: string;
  booking_id: string | null;
  for_self: boolean;
  patient_name_override: string | null;
  reason: string | null;
  fee: number | null;
  rating: number | null;
  rating_comment: string | null;
  rated_at: string | null;
  doctor_confirmed: boolean;
  deposit_held: boolean;
  deposit_amount: number | null;
  attended_at: string | null;
  cancelled_at: string | null;
  no_show_at: string | null;
};

type Notification = {
  id: number;
  type: string;
  message: string;
  read: boolean;
  created_at: string;
  appointment_id: number;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 px-1">{title}</p>
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        {children}
      </div>
    </div>
  );
}

function Row({ icon, label, value, last = false }: { icon: React.ReactNode; label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 ${!last ? "border-b border-border" : ""}`}>
      <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground truncate">{value || "—"}</p>
      </div>
    </div>
  );
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  scheduled: { label: "Scheduled", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  completed: { label: "Completed", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  cancelled: { label: "Cancelled", cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  no_show: { label: "Missed", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

function isToday(dateStr: string): boolean {
  return new Date(dateStr).toDateString() === new Date().toDateString();
}

function canCancel(appt: AppointmentRow): boolean {
  const tStr = `${appt.appointment_date}T${(appt.appointment_time ?? "09:00").replace(/\s?(AM|PM)/i, "").padStart(5, "0")}:00`;
  return new Date(tStr).getTime() - Date.now() >= 2 * 60 * 60 * 1000;
}

function isUpcoming(appt: AppointmentRow): boolean {
  return appt.status === "scheduled";
}

function formatApptDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function StarRow({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n}
          onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="transition-transform active:scale-90">
          <Star className={`w-8 h-8 transition-colors ${(hover || value) >= n ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"}`} />
        </button>
      ))}
    </div>
  );
}

export default function Profile() {
  const [, setLocation] = useLocation();
  const { profile, updateProfile, clearProfile, isLoading } = useProfile();

  const [editPersonal, setEditPersonal] = useState(false);
  const [editHealth, setEditHealth] = useState(false);

  const [eName, setEName] = useState("");
  const [eAge, setEAge] = useState("");
  const [eCity, setECity] = useState("");
  const [eWork, setEWork] = useState("");

  const [eBg, setEBg] = useState<BloodGroup | "">("");
  const [eDonated, setEDonated] = useState<boolean | null>(null);
  const [eHealth, setEHealth] = useState<boolean | null>(null);

  const [notifBlood, setNotifBlood] = useState(true);
  const [notifHealth, setNotifHealth] = useState(false);
  const [notifAppt, setNotifAppt] = useState(true);

  // Appointments state
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [apptLoading, setApptLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Notifications state
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Cancel state
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Attend state
  const [attendingId, setAttendingId] = useState<number | null>(null);

  // Rating modal
  const [ratingAppt, setRatingAppt] = useState<AppointmentRow | null>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  const fetchAppointments = useCallback(async (phone: string) => {
    setApptLoading(true);
    try {
      const res = await fetch(`/api/appointments/by-phone?phone=${encodeURIComponent(phone)}`);
      if (res.ok) setAppointments(await res.json());
    } catch {}
    setApptLoading(false);
  }, []);

  const fetchNotifications = useCallback(async (phone: string) => {
    try {
      const res = await fetch(`/api/notifications?phone=${encodeURIComponent(phone)}`);
      if (res.ok) setNotifications(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    if (profile?.phone) {
      fetchAppointments(profile.phone);
      fetchNotifications(profile.phone);
    }
  }, [profile?.phone, fetchAppointments, fetchNotifications]);

  if (isLoading || !profile) return null;

  const firstName = profile.name.split(" ")[0];
  const memberSince = "May 2025";
  const totalDonations = 3;
  const livesImpacted = totalDonations * 3;
  const donorScore = 7;
  const streak = 2;

  const noShowCount = appointments.filter(a => a.status === "no_show").length;

  const startEditPersonal = () => {
    setEName(profile.name); setEAge(String(profile.age ?? "")); setECity(profile.city); setEWork(profile.workLocation); setEditPersonal(true);
  };
  const savePersonal = () => {
    updateProfile({ name: eName, age: Number(eAge), city: eCity, workLocation: eWork }); setEditPersonal(false);
  };
  const startEditHealth = () => {
    setEBg(profile.bloodGroup); setEDonated(profile.donatedBefore); setEHealth(profile.hasHealthIssues); setEditHealth(true);
  };
  const saveHealth = () => {
    updateProfile({ bloodGroup: eBg as BloodGroup, donatedBefore: eDonated, hasHealthIssues: eHealth }); setEditHealth(false);
  };

  const handleCancel = async (id: number) => {
    setCancellingId(id); setCancelError(null);
    try {
      const res = await fetch(`/api/appointments/${id}/cancel`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: "Patient cancelled" }),
      });
      if (res.ok) {
        if (profile.phone) await fetchAppointments(profile.phone);
      } else {
        const err = await res.json();
        setCancelError(err.error ?? "Could not cancel appointment.");
      }
    } catch { setCancelError("Connection error."); }
    setCancellingId(null);
  };

  const handleAttend = async (id: number) => {
    setAttendingId(id);
    try {
      const res = await fetch(`/api/appointments/${id}/attend`, { method: "PATCH" });
      if (res.ok && profile.phone) await fetchAppointments(profile.phone);
    } catch {}
    setAttendingId(null);
  };

  const handleRate = async () => {
    if (!ratingAppt || ratingValue === 0) return;
    setRatingSubmitting(true);
    try {
      const res = await fetch(`/api/appointments/${ratingAppt.id}/rate`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: ratingValue, comment: ratingComment }),
      });
      if (res.ok) {
        if (profile.phone) await fetchAppointments(profile.phone);
        setRatingAppt(null); setRatingValue(0); setRatingComment("");
      }
    } catch {}
    setRatingSubmitting(false);
  };

  const markNotifRead = async (id: number) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch {}
  };

  const upcoming = appointments.filter(isUpcoming);
  const past = appointments.filter(a => !isUpcoming(a));
  const displayPast = showAll ? past : past.slice(0, 3);
  const unreadNotifs = notifications.filter(n => !n.read);

  const genderIcon = profile.gender === "male" ? "♂" : profile.gender === "female" ? "♀" : "⚧";

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background pb-24">
      <div className="flex items-center gap-3 px-5 pt-12 pb-5">
        <button onClick={() => setLocation("/home")} className="w-10 h-10 rounded-full flex items-center justify-center bg-muted hover:bg-muted/80">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">Profile</h1>
        {unreadNotifs.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5 bg-primary/10 text-primary px-2.5 py-1 rounded-full">
            <Bell className="w-3.5 h-3.5" />
            <span className="text-xs font-bold">{unreadNotifs.length}</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 space-y-5">
        {/* PROFILE HERO */}
        <div className="bg-primary rounded-2xl p-5 relative overflow-hidden shadow-lg shadow-primary/20">
          <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/5 rounded-full" />
          <div className="absolute top-8 right-8 w-16 h-16 bg-white/5 rounded-full" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center border border-white/30">
              <User className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white truncate">{profile.name}</h2>
                {noShowCount >= 2 && (
                  <div className="flex items-center gap-1 bg-amber-400/20 border border-amber-400/40 rounded-full px-2 py-0.5 flex-shrink-0">
                    <AlertTriangle className="w-3 h-3 text-amber-300" />
                    <span className="text-[10px] font-bold text-amber-300">Warning</span>
                  </div>
                )}
              </div>
              <p className="text-white/70 text-xs mt-0.5 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {profile.city}
              </p>
              {profile.lifeline_id && (
                <p className="text-white/50 text-xs mt-0.5 font-mono tracking-wider">{profile.lifeline_id}</p>
              )}
            </div>
            <div className="flex flex-col items-center bg-white rounded-xl px-3 py-2 flex-shrink-0">
              <Droplet className="w-4 h-4 text-primary fill-primary mb-0.5" />
              <span className="text-primary font-bold text-base leading-none">{profile.bloodGroup || "?"}</span>
            </div>
          </div>
        </div>

        {/* IN-APP NOTIFICATIONS */}
        {unreadNotifs.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">Notifications</p>
            {unreadNotifs.map(notif => (
              <motion.div key={notif.id} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl p-4 border flex items-start gap-3 ${
                  notif.type === "confirmed" ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40"
                  : notif.type === "no_show_warning" ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40"
                  : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/40"
                }`}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  notif.type === "confirmed" ? "bg-emerald-100 dark:bg-emerald-900/40"
                  : notif.type === "no_show_warning" ? "bg-amber-100 dark:bg-amber-900/40"
                  : "bg-blue-100 dark:bg-blue-900/40"
                }`}>
                  {notif.type === "confirmed" ? <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  : notif.type === "no_show_warning" ? <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  : <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground leading-relaxed">{notif.message}</p>
                </div>
                <button onClick={() => markNotifRead(notif.id)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        )}

        {/* PERSONAL INFO */}
        <Section title="Personal Info">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-bold text-foreground">Personal Information</span>
            {editPersonal ? (
              <div className="flex gap-2">
                <button onClick={() => setEditPersonal(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
                <button onClick={savePersonal} className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <button onClick={startEditPersonal} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <Pencil className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
          {editPersonal ? (
            <div className="p-4 space-y-3">
              <div className="space-y-1"><Label className="text-xs font-semibold text-muted-foreground">Full Name</Label><Input value={eName} onChange={(e) => setEName(e.target.value)} className="h-11 rounded-xl" /></div>
              <div className="space-y-1"><Label className="text-xs font-semibold text-muted-foreground">Age</Label><Input type="number" value={eAge} onChange={(e) => setEAge(e.target.value)} className="h-11 rounded-xl" /></div>
              <div className="space-y-1"><Label className="text-xs font-semibold text-muted-foreground">City</Label><Input value={eCity} onChange={(e) => setECity(e.target.value)} className="h-11 rounded-xl" /></div>
              <div className="space-y-1"><Label className="text-xs font-semibold text-muted-foreground">Work Location</Label><Input value={eWork} onChange={(e) => setEWork(e.target.value)} className="h-11 rounded-xl" placeholder="Optional" /></div>
            </div>
          ) : (
            <>
              <Row icon={<User className="w-4 h-4" />} label="Full Name" value={profile.name} />
              <Row icon={<span className="text-sm">{genderIcon}</span>} label="Gender" value={profile.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : "—"} />
              <Row icon={<span className="text-sm font-bold">🎂</span>} label="Age" value={profile.age ? `${profile.age} years` : "—"} />
              <Row icon={<MapPin className="w-4 h-4" />} label="City" value={profile.city} />
              <Row icon={<Briefcase className="w-4 h-4" />} label="Work Location" value={profile.workLocation || "Not set"} last />
            </>
          )}
        </Section>

        {/* HEALTH INFO */}
        <Section title="Health Info">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-bold text-foreground">Blood & Health</span>
            {editHealth ? (
              <div className="flex gap-2">
                <button onClick={() => setEditHealth(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
                <button onClick={saveHealth} className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <button onClick={startEditHealth} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <Pencil className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
          {editHealth ? (
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground">Blood Group</Label>
                <div className="grid grid-cols-4 gap-2">
                  {BLOOD_GROUPS.map((bg) => (
                    <button key={bg} onClick={() => setEBg(bg)}
                      className={`h-11 rounded-xl text-sm font-bold border-2 transition-all ${eBg === bg ? "bg-primary text-white border-primary" : "bg-card border-border text-foreground"}`}>
                      {bg}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground">Donated Before?</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[true, false].map((v) => (
                    <button key={String(v)} onClick={() => setEDonated(v)}
                      className={`h-11 rounded-xl text-sm font-semibold border-2 transition-all ${eDonated === v ? "bg-primary text-white border-primary" : "bg-card border-border text-foreground"}`}>
                      {v ? "✓ Yes" : "✗ No"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground">Any Health Issues?</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[true, false].map((v) => (
                    <button key={String(v)} onClick={() => setEHealth(v)}
                      className={`h-11 rounded-xl text-sm font-semibold border-2 transition-all ${eHealth === v ? "bg-primary text-white border-primary" : "bg-card border-border text-foreground"}`}>
                      {v ? "Yes" : "No"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              <Row icon={<Droplet className="w-4 h-4 text-primary" />} label="Blood Group" value={profile.bloodGroup || "Not set"} />
              <Row icon={<Heart className="w-4 h-4" />} label="Donated Before" value={profile.donatedBefore === null ? "—" : profile.donatedBefore ? "Yes" : "No"} />
              <Row icon={<ShieldCheck className="w-4 h-4" />} label="Health Issues" value={profile.hasHealthIssues === null ? "—" : profile.hasHealthIssues ? "Yes" : "No"} last />
            </>
          )}
        </Section>

        {/* MY STATS */}
        <Section title="My Stats">
          <div className="grid grid-cols-2 divide-x divide-y divide-border">
            {[
              { icon: <Heart className="w-5 h-5 text-primary" />, value: totalDonations, label: "Donations", color: "text-primary" },
              { icon: <Users className="w-5 h-5 text-emerald-600" />, value: livesImpacted, label: "Lives Impacted", color: "text-emerald-600" },
              { icon: <Trophy className="w-5 h-5 text-amber-500" />, value: donorScore, label: "Donor Score", color: "text-amber-500" },
              { icon: <Flame className="w-5 h-5 text-orange-500" />, value: `${streak}×`, label: "Current Streak", color: "text-orange-500" },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center justify-center p-5 gap-1">
                {stat.icon}
                <span className={`text-2xl font-bold ${stat.color}`}>{stat.value}</span>
                <span className="text-xs text-muted-foreground text-center">{stat.label}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* MY APPOINTMENTS */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">My Appointments</p>
            {appointments.length > 0 && (
              <span className="text-xs text-muted-foreground">{appointments.length} total</span>
            )}
          </div>

          {cancelError && (
            <div className="mb-2 bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
              <p className="text-xs text-destructive">{cancelError}</p>
              <button onClick={() => setCancelError(null)} className="ml-auto"><X className="w-3.5 h-3.5 text-destructive" /></button>
            </div>
          )}

          {apptLoading ? (
            <div className="bg-card border border-border rounded-2xl p-8 flex justify-center">
              <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : appointments.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center text-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                <Stethoscope className="w-6 h-6 text-muted-foreground/40" />
              </div>
              <div>
                <p className="font-semibold text-muted-foreground text-sm">No appointments yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Book a doctor to get started</p>
              </div>
              <button onClick={() => setLocation("/book-doctor")}
                className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl">
                Book a Doctor
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* UPCOMING */}
              {upcoming.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-primary uppercase tracking-wider px-1">Upcoming</p>
                  {upcoming.map(appt => {
                    const status = STATUS_CONFIG[appt.status] ?? { label: appt.status, cls: "bg-muted text-muted-foreground" };
                    const today = isToday(appt.appointment_date);
                    const cancellable = canCancel(appt);
                    return (
                      <motion.div key={appt.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        className={`bg-card border rounded-2xl p-4 shadow-sm ${appt.doctor_confirmed ? "border-emerald-200 dark:border-emerald-800/40" : "border-border"}`}>
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Stethoscope className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-bold text-sm text-foreground leading-tight">{appt.doctor_name}</p>
                                <p className="text-xs text-muted-foreground">{appt.doctor_specialty}</p>
                              </div>
                              <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${status.cls}`}>{status.label}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1.5">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <CalendarDays className="w-3.5 h-3.5" />
                                <span>{formatApptDate(appt.appointment_date)}</span>
                              </div>
                              {appt.appointment_time && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>{appt.appointment_time}</span>
                                </div>
                              )}
                            </div>
                            {appt.doctor_confirmed && (
                              <div className="flex items-center gap-1 mt-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">Doctor Confirmed</span>
                              </div>
                            )}
                            {appt.deposit_held && (
                              <div className="flex items-center gap-1 mt-1">
                                <ShieldCheck className="w-3 h-3 text-primary" />
                                <span className="text-[10px] text-primary font-semibold">₹{appt.deposit_amount} deposit held — refunded on attendance</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {today && (
                            <button onClick={() => handleAttend(appt.id)} disabled={attendingId === appt.id}
                              className="flex-1 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-60">
                              {attendingId === appt.id
                                ? <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                : <><CheckCircle2 className="w-3.5 h-3.5" /> Mark as Attended</>}
                            </button>
                          )}
                          {cancellable ? (
                            <button onClick={() => handleCancel(appt.id)} disabled={cancellingId === appt.id}
                              className="flex-1 py-2 border border-border text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 text-muted-foreground hover:bg-muted/40 disabled:opacity-60">
                              {cancellingId === appt.id
                                ? <div className="w-4 h-4 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />
                                : <><XCircle className="w-3.5 h-3.5" /> Cancel</>}
                            </button>
                          ) : (
                            <div className="flex-1 py-2 bg-muted/30 rounded-xl flex items-center justify-center">
                              <span className="text-[10px] text-muted-foreground/60 font-medium">Cancel window closed</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* PAST */}
              {past.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-1">Past</p>
                  {displayPast.map(appt => {
                    const status = STATUS_CONFIG[appt.status] ?? { label: appt.status, cls: "bg-muted text-muted-foreground" };
                    const canRate = appt.status === "completed" && !appt.rated_at;
                    const hasRating = !!appt.rated_at;
                    return (
                      <motion.div key={appt.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                            <Stethoscope className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-bold text-sm text-foreground leading-tight">{appt.doctor_name}</p>
                                <p className="text-xs text-muted-foreground">{appt.doctor_specialty}</p>
                              </div>
                              <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${status.cls}`}>{status.label}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1.5">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <CalendarDays className="w-3.5 h-3.5" />
                                <span>{formatApptDate(appt.appointment_date)}</span>
                              </div>
                              {appt.appointment_time && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>{appt.appointment_time}</span>
                                </div>
                              )}
                            </div>
                            {hasRating && (
                              <div className="flex items-center gap-1 mt-1.5">
                                {[1,2,3,4,5].map(n => (
                                  <Star key={n} className={`w-3 h-3 ${(appt.rating ?? 0) >= n ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"}`} />
                                ))}
                                {appt.rating_comment && (
                                  <span className="text-[10px] text-muted-foreground ml-1 truncate max-w-[100px]">"{appt.rating_comment}"</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button onClick={() => setLocation(`/book-appointment/${appt.doctor_id}`)}
                            className="flex-1 py-2 border border-primary/30 text-primary text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 hover:bg-primary/5">
                            <RotateCcw className="w-3.5 h-3.5" /> Rebook
                          </button>
                          {canRate && (
                            <button onClick={() => { setRatingAppt(appt); setRatingValue(0); setRatingComment(""); }}
                              className="flex-1 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5">
                              <Star className="w-3.5 h-3.5" /> Rate Doctor
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                  {past.length > 3 && (
                    <button onClick={() => setShowAll(v => !v)}
                      className="w-full py-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                      {showAll ? <><ChevronUp className="w-4 h-4" /> Show less</> : <><ChevronDown className="w-4 h-4" /> Show {past.length - 3} more</>}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* NOTIFICATION SETTINGS */}
        <Section title="Notifications">
          {[
            { label: "Blood Request Alerts", sub: "Nearby requests matching your group", value: notifBlood, set: setNotifBlood },
            { label: "Health Tips", sub: "Weekly health & donation reminders", value: notifHealth, set: setNotifHealth },
            { label: "Appointment Reminders", sub: "Upcoming doctor appointments", value: notifAppt, set: setNotifAppt },
          ].map((item, i, arr) => (
            <div key={item.label} className={`flex items-center gap-4 px-4 py-4 ${i < arr.length - 1 ? "border-b border-border" : ""}`}>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
              </div>
              <Switch checked={item.value} onCheckedChange={item.set} />
            </div>
          ))}
        </Section>

        {/* ACCOUNT */}
        <Section title="Account">
          <button className="w-full flex items-center gap-3 px-4 py-4 border-b border-border hover:bg-muted/40 transition-colors">
            <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
              <Lock className="w-4 h-4 text-muted-foreground" />
            </div>
            <span className="flex-1 text-sm font-medium text-left">Privacy & Security</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-4 border-b border-border hover:bg-muted/40 transition-colors">
            <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
              <Bell className="w-4 h-4 text-muted-foreground" />
            </div>
            <span className="flex-1 text-sm font-medium text-left">Notification Settings</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => { clearProfile(); setLocation("/login"); }}
            className="w-full flex items-center gap-3 px-4 py-4 hover:bg-destructive/5 transition-colors">
            <div className="w-8 h-8 rounded-xl bg-destructive/10 flex items-center justify-center">
              <LogOut className="w-4 h-4 text-destructive" />
            </div>
            <span className="flex-1 text-sm font-semibold text-destructive text-left">Logout</span>
          </button>
        </Section>

        <div className="h-2" />
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 w-full max-w-[430px] bg-card/95 backdrop-blur-md border-t border-border flex justify-around py-3 pb-safe z-50">
        <Link href="/home" className="flex flex-col items-center gap-1 text-muted-foreground">
          <Heart className="w-5 h-5" />
          <span className="text-[10px] font-medium">Home</span>
        </Link>
        <Link href="/donate" className="flex flex-col items-center gap-1 text-muted-foreground">
          <Droplet className="w-5 h-5" />
          <span className="text-[10px] font-medium">Donate</span>
        </Link>
        <button className="flex flex-col items-center gap-1 text-muted-foreground">
          <Activity className="w-5 h-5" />
          <span className="text-[10px] font-medium">Requests</span>
        </button>
        <Link href="/profile" className="flex flex-col items-center gap-1 text-primary">
          <User className="w-5 h-5 fill-primary/30" />
          <span className="text-[10px] font-semibold">Profile</span>
        </Link>
      </nav>
      <style dangerouslySetInnerHTML={{ __html: `.pb-safe { padding-bottom: calc(0.75rem + env(safe-area-inset-bottom)); }` }} />

      {/* RATING MODAL */}
      <AnimatePresence>
        {ratingAppt && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end px-0"
            onClick={(e) => { if (e.target === e.currentTarget) setRatingAppt(null); }}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="bg-card w-full rounded-t-3xl p-6 pb-10 space-y-5 shadow-2xl">
              <div className="w-10 h-1 bg-muted-foreground/20 rounded-full mx-auto mb-2" />
              <div>
                <h3 className="text-lg font-bold text-foreground">Rate your visit</h3>
                <p className="text-sm text-muted-foreground">{ratingAppt.doctor_name} · {formatApptDate(ratingAppt.appointment_date)}</p>
              </div>

              <div className="flex justify-center">
                <StarRow value={ratingValue} onChange={setRatingValue} />
              </div>

              {ratingValue > 0 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">Leave a comment <span className="font-normal">(optional)</span></p>
                  <textarea value={ratingComment} onChange={e => setRatingComment(e.target.value)}
                    placeholder="How was your experience?"
                    rows={3}
                    className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none" />
                </motion.div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setRatingAppt(null)}
                  className="flex-1 py-3 border border-border rounded-2xl text-sm font-semibold text-muted-foreground">
                  Cancel
                </button>
                <button onClick={handleRate} disabled={ratingValue === 0 || ratingSubmitting}
                  className="flex-1 py-3 bg-primary text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40">
                  {ratingSubmitting
                    ? <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    : <><Star className="w-4 h-4" /> Submit Rating</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
