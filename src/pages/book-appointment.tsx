import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Calendar, Clock, User, Users, ChevronRight,
  CheckCircle2, AlertCircle, IndianRupee, ShieldCheck,
} from "lucide-react";
import { useProfile } from "@/context/profile-context";
import { toast } from "@/hooks/use-toast";
import { addTimelineEntry, generateId } from "@/lib/health-store";
import type { TimelineEntry } from "@/types/health";

type Doctor = {
  id: number; name: string; specialty: string; clinic_name: string | null;
  city: string | null; consultation_fee: number | null; available_days: string | null;
  available_start_time: string | null; available_end_time: string | null;
  phone?: string;
};

function generateBookingId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "LL-";
  for (let i = 0; i < 7; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function generateSlots(start: string, end: string): string[] {
  const slots: string[] = [];
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let h = sh ?? 9, m = sm ?? 0;
  const endMins = (eh ?? 17) * 60 + (em ?? 0);
  while (h * 60 + m < endMins) {
    const suffix = h >= 12 ? "PM" : "AM";
    const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
    slots.push(`${displayH}:${String(m).padStart(2, "0")} ${suffix}`);
    m += 30; if (m >= 60) { m -= 60; h++; }
  }
  return slots;
}

function getNext14Days(): Date[] {
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i + 1); return d;
  });
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

function dayLabel(d: Date, idx: number): string {
  if (idx === 0) return "Tomorrow";
  return d.toLocaleDateString("en-IN", { weekday: "short" });
}

const RELATIONS = ["Spouse", "Parent", "Child", "Sibling", "Friend", "Other"];
const DEPOSIT_AMOUNT = 49;

export default function BookAppointment() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/book-appointment/:doctorId");
  const { profile, bffFetch } = useProfile();
  const doctorId = Number(params?.doctorId);

  const [step, setStep] = useState(1);
  const [doc, setDoc] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [noShowCount, setNoShowCount] = useState(0);
  const requiresDeposit = noShowCount >= 2;

  const days = getNext14Days();
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [forSelf, setForSelf] = useState(true);
  const [otherName, setOtherName] = useState("");
  const [relation, setRelation] = useState("");
  const [reason, setReason] = useState("");
  const [allergies, setAllergies] = useState("");

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isNaN(doctorId)) return;
    bffFetch(`/api/app/doctors/${doctorId}`)
      .then(r => r.json()).then(d => { setDoc(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [doctorId, bffFetch]);

  useEffect(() => {
    if (!profile?.phone) return;
    bffFetch(`/api/app/appointments/no-show-count`)
      .then(r => r.json()).then(d => { if (typeof d.count === "number") setNoShowCount(d.count); })
      .catch(() => {});
  }, [profile?.phone, bffFetch]);

  useEffect(() => {
    if (!selectedDay || !doc) return;
    setSlotsLoading(true);
    bffFetch(`/api/app/doctors/${doc.id}/booked-slots?date=${selectedDay}`)
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setBookedSlots(d); setSlotsLoading(false); })
      .catch(() => setSlotsLoading(false));
  }, [selectedDay, doc, bffFetch]);

  const slots = doc?.available_start_time && doc?.available_end_time
    ? generateSlots(doc.available_start_time, doc.available_end_time)
    : [];

  const availDays = doc?.available_days ? doc.available_days.split(",").map(d => d.trim()) : [];
  const isDayAvailable = (d: Date) => {
    const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
    return availDays.some(avd => avd.toLowerCase().startsWith(dayName.toLowerCase()));
  };

  const handleConfirm = async () => {
    if (!doc || !selectedDay || !selectedSlot || !profile) return;
    setSubmitting(true);
    const bookingId = generateBookingId();
    try {
      const res = await bffFetch("/api/app/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_phone: profile.phone || null,
          doctor_id: doc.id,
          doctor_name: doc.name,
          doctor_phone: doc.phone || null,
          appointment_date: selectedDay,
          appointment_time: selectedSlot,
          for_self: forSelf,
          patient_name_override: !forSelf ? otherName : null,
          relation: !forSelf ? relation : null,
          reason: reason || null,
          allergies: allergies || null,
          fee: doc.consultation_fee,
          deposit_held: requiresDeposit,
          deposit_amount: requiresDeposit ? DEPOSIT_AMOUNT : null,
          status: "scheduled",
        }),
      });
      if (res.ok) {
        const data = await res.json();

        addTimelineEntry({
          id: generateId(),
          type: "appointment",
          date: selectedDay,
          title: `Appointment with ${doc.name}`,
          subtitle: `${selectedSlot} — ${doc.clinic_name ?? doc.specialty}`,
          provider: doc.name,
          location: doc.clinic_name ?? undefined,
          status: "scheduled",
        } satisfies TimelineEntry);

        const urlParams = new URLSearchParams({
          bookingId,
          doctorId: String(doc.id),
          doctorName: doc.name,
          date: selectedDay,
          time: selectedSlot,
          clinic: doc.clinic_name ?? "",
          city: doc.city ?? "",
          appointmentId: String(data.id),
          depositHeld: requiresDeposit ? "1" : "0",
        });
        setLocation(`/booking-confirmed?${urlParams}`);
      } else {
        const err = await res.json().catch(() => ({ error: "Booking failed" }));
        toast({ title: "Booking failed", description: err.error ?? "Something went wrong", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Could not reach server. Please try again.", variant: "destructive" });
    }
    setSubmitting(false);
  };

  if (loading || !doc) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const canStep2 = !!selectedDay;
  const canStep3 = !!selectedSlot;
  const canStep4 = forSelf ? true : (otherName.trim().length > 0);

  const STEPS = ["Date", "Time", "Details", "Confirm"];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-3 px-4 pt-12 pb-3">
          <button onClick={() => step > 1 ? setStep(s => s - 1) : setLocation(`/doctor/${doc.id}`)}
            className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground font-medium">{doc.name}</p>
            <h1 className="font-bold text-base text-foreground leading-tight">Book Appointment</h1>
          </div>
        </div>
        <div className="px-4 pb-4">
          <div className="flex gap-1.5">
            {STEPS.map((label, i) => (
              <div key={i} className="flex-1 flex flex-col gap-1">
                <div className={`h-1 rounded-full transition-all ${i + 1 <= step ? "bg-primary" : "bg-muted"}`} />
                <span className={`text-[9px] font-semibold text-center ${i + 1 === step ? "text-primary" : "text-muted-foreground/50"}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* No-show warning banner (1st or 2nd no-show) */}
      {noShowCount === 1 && (
        <div className="mx-4 mt-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl px-4 py-2.5 flex gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            You have a missed appointment on record. Please remember to cancel if you cannot attend.
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-28">
        <div className="px-4 pt-5">
          <AnimatePresence mode="wait">

            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
                <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" /> Select a Date
                </h2>
                <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
                  {days.map((day, idx) => {
                    const avail = isDayAvailable(day);
                    const selected = selectedDay === formatDate(day);
                    return (
                      <button key={idx}
                        disabled={!avail}
                        onPointerDown={() => { setSelectedDay(formatDate(day)); setSelectedSlot(null); }}
                        className={`flex-shrink-0 w-16 rounded-2xl py-4 flex flex-col items-center gap-1.5 border transition-all ${
                          selected ? "bg-primary text-white border-primary shadow-md shadow-primary/25"
                          : avail ? "bg-card border-border hover:border-primary/40"
                          : "bg-muted/30 border-border/30 opacity-40"
                        }`}>
                        <span className={`text-[10px] font-semibold ${selected ? "text-white/80" : "text-muted-foreground"}`}>
                          {dayLabel(day, idx)}
                        </span>
                        <span className={`text-xl font-bold ${selected ? "text-white" : "text-foreground"}`}>
                          {day.getDate()}
                        </span>
                        <span className={`text-[10px] ${selected ? "text-white/70" : "text-muted-foreground"}`}>
                          {day.toLocaleDateString("en-IN", { month: "short" })}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {selectedDay && (
                  <p className="text-xs text-muted-foreground mt-3 text-center">
                    {new Date(selectedDay + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                  </p>
                )}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
                <h2 className="text-base font-bold text-foreground mb-1 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" /> Select a Time
                </h2>
                <p className="text-xs text-muted-foreground mb-4">
                  {selectedDay ? new Date(selectedDay + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }) : ""}
                </p>
                {slotsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {slots.map(slot => {
                      const booked = bookedSlots.includes(slot);
                      const selected = selectedSlot === slot;
                      return (
                        <button key={slot}
                          disabled={booked}
                          onClick={() => setSelectedSlot(slot)}
                          className={`py-3 rounded-xl text-sm font-semibold border transition-all ${
                            selected ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                            : booked ? "bg-muted/30 text-muted-foreground/40 border-border/30 line-through"
                            : "bg-card border-border text-foreground hover:border-primary/40"
                          }`}>
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                )}
                {slots.length === 0 && !slotsLoading && (
                  <div className="text-center py-8 text-muted-foreground text-sm">No slots available for this day</div>
                )}
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                className="space-y-5">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" /> Patient Details
                </h2>

                <div className="bg-card border border-border rounded-2xl p-1 flex">
                  <button onClick={() => setForSelf(true)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                      forSelf ? "bg-primary text-white shadow-sm" : "text-muted-foreground"
                    }`}>
                    <User className="w-4 h-4" /> For Me
                  </button>
                  <button onClick={() => setForSelf(false)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                      !forSelf ? "bg-primary text-white shadow-sm" : "text-muted-foreground"
                    }`}>
                    <Users className="w-4 h-4" /> Someone Else
                  </button>
                </div>

                <AnimatePresence>
                  {!forSelf && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                      className="space-y-3 overflow-hidden">
                      <div>
                        <label className="text-xs font-semibold text-foreground mb-1.5 block">Patient Name *</label>
                        <input type="text" value={otherName} onChange={e => setOtherName(e.target.value)}
                          placeholder="Full name of the patient"
                          className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-foreground mb-1.5 block">Relation</label>
                        <div className="flex gap-2 flex-wrap">
                          {RELATIONS.map(r => (
                            <button key={r} onClick={() => setRelation(r)}
                              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                                relation === r ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/40"
                              }`}>
                              {r}
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div>
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">Reason for Visit <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <textarea value={reason} onChange={e => setReason(e.target.value)}
                    placeholder="Briefly describe your symptoms or reason"
                    rows={3}
                    className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none" />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">Known Allergies or Conditions <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <textarea value={allergies} onChange={e => setAllergies(e.target.value)}
                    placeholder="e.g. penicillin allergy, diabetes, hypertension"
                    rows={2}
                    className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none" />
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div key="step4" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                className="space-y-4">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary" /> Confirm Booking
                </h2>

                <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-bold">
                        {doc.name.replace(/^Dr\.\s*/, "").split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("")}
                      </span>
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">{doc.specialty}</p>
                      {doc.clinic_name && <p className="text-xs text-muted-foreground/70 mt-0.5">{doc.clinic_name}{doc.city ? `, ${doc.city}` : ""}</p>}
                    </div>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Date</p>
                      <p className="text-sm font-semibold text-foreground">
                        {selectedDay ? new Date(selectedDay + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Time</p>
                      <p className="text-sm font-semibold text-foreground">{selectedSlot}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Patient</p>
                      <p className="text-sm font-semibold text-foreground">
                        {forSelf ? (profile?.name ?? "You") : otherName}
                      </p>
                      {!forSelf && relation && <p className="text-xs text-muted-foreground">{relation}</p>}
                    </div>
                  </div>
                  {reason && (
                    <>
                      <div className="h-px bg-border" />
                      <div>
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Reason</p>
                        <p className="text-sm text-foreground">{reason}</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Deposit required (3rd no-show trigger) */}
                {requiresDeposit && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-primary/5 border-2 border-primary/20 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <ShieldCheck className="w-4 h-4 text-primary" />
                      </div>
                      <p className="text-sm font-bold text-foreground">Refundable Deposit Required</p>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      A small refundable deposit of <span className="font-bold text-primary">₹{DEPOSIT_AMOUNT}</span> is required due to previous missed appointments. This is <strong>fully returned</strong> when you attend your appointment.
                    </p>
                    <div className="flex items-center justify-between bg-white dark:bg-card rounded-xl px-4 py-3 border border-primary/20">
                      <span className="text-sm font-semibold text-foreground">Deposit Amount</span>
                      <div className="flex items-center gap-1 text-primary font-bold">
                        <IndianRupee className="w-4 h-4" />
                        <span className="text-base">{DEPOSIT_AMOUNT}</span>
                        <span className="text-xs font-normal text-muted-foreground ml-1">refundable</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground text-center">
                      Deposit will be processed at the clinic and returned upon attendance.
                    </p>
                  </motion.div>
                )}

              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-4 pb-6 pt-3 bg-background/95 backdrop-blur-sm border-t border-border" style={{ zIndex: 10 }}>
        {step < 4 ? (
          <button
            disabled={step === 1 ? !canStep2 : step === 2 ? !canStep3 : !canStep4}
            onClick={() => setStep(s => s + 1)}
            className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-primary/25 disabled:opacity-40 disabled:shadow-none transition-all hover:bg-primary/90">
            Continue <ChevronRight className="w-5 h-5" />
          </button>
        ) : (
          <button onClick={handleConfirm} disabled={submitting}
            className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-primary/25 disabled:opacity-60 hover:bg-primary/90 transition-all">
            {submitting ? (
              <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <><CheckCircle2 className="w-5 h-5" /> {requiresDeposit ? `Confirm & Pay ₹${DEPOSIT_AMOUNT} Deposit` : "Confirm Booking"}</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
