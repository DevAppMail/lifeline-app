import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, Clock, User, MapPin, Stethoscope,
  FileText, Pill,
  IndianRupee, CalendarClock, ChevronDown, ChevronUp,
} from "lucide-react";
import type {
  ContinuityAppointment,
  ContinuityConsultation,
  ContinuityPrescription,
  ContinuityFollowUp,
  ContinuityBilling,
  NormalizedContinuityEvent,
} from "@/types/continuity";
import { timeRemaining, isOverdue } from "@/lib/continuity-utils";

function statusBadge(status: string): { label: string; color: string } {
  const s = status.toLowerCase();
  if (s === "scheduled") return { label: "Scheduled", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" };
  if (s === "confirmed") return { label: "Confirmed", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" };
  if (s === "completed" || s === "arrived") return { label: "Completed", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" };
  if (s === "cancelled") return { label: "Cancelled", color: "bg-muted text-muted-foreground" };
  if (s === "no_show") return { label: "Missed", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
  if (s === "pending" || s === "pending_approval") return { label: "Pending", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
  return { label: status, color: "bg-muted text-muted-foreground" };
}

export function AppointmentCard({ appointment }: { appointment: ContinuityAppointment }) {
  const badge = statusBadge(appointment.status);
  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center flex-shrink-0">
          <Stethoscope className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground leading-tight truncate">{appointment.doctorName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{appointment.doctorSpecialty}</p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${badge.color}`}>
              {badge.label}
            </span>
          </div>
          {appointment.clinicName && (
            <div className="flex items-center gap-1 mt-1.5">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground truncate">{appointment.clinicName}</span>
            </div>
          )}
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {new Date(appointment.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{appointment.time || "—"}</span>
            </div>
          </div>
          {appointment.reason && (
            <p className="text-xs text-muted-foreground/70 mt-1.5 italic line-clamp-1">"{appointment.reason}"</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function ConsultationCard({ consultation }: { consultation: ContinuityConsultation }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">Consultation</p>
          {consultation.doctorName && (
            <p className="text-xs text-muted-foreground">with {consultation.doctorName}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(consultation.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </p>
          {consultation.diagnosis && (
            <div className="mt-2 bg-muted/50 rounded-xl p-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Diagnosis</p>
              <p className="text-xs text-foreground leading-relaxed">{consultation.diagnosis}</p>
            </div>
          )}
          {consultation.notes && (
            <p className="text-xs text-muted-foreground/70 mt-1.5 italic line-clamp-2">"{consultation.notes}"</p>
          )}
          {consultation.vitals && (
            <div className="flex gap-3 mt-2">
              {consultation.vitals.bloodPressure && (
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground">BP</p>
                  <p className="text-xs font-semibold text-foreground">{consultation.vitals.bloodPressure}</p>
                </div>
              )}
              {consultation.vitals.heartRate ? (
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground">HR</p>
                  <p className="text-xs font-semibold text-foreground">{consultation.vitals.heartRate} bpm</p>
                </div>
              ) : null}
              {consultation.vitals.temperature ? (
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground">Temp</p>
                  <p className="text-xs font-semibold text-foreground">{consultation.vitals.temperature}°F</p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PrescriptionCard({ prescription }: { prescription: ContinuityPrescription }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-foreground">
                Prescription · {prescription.items.length} medicine{prescription.items.length !== 1 ? "s" : ""}
              </p>
              {prescription.doctorName && (
                <p className="text-xs text-muted-foreground">by {prescription.doctorName}</p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(prescription.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
            {prescription.items.length > 0 && (
              <button onClick={() => setExpanded(!expanded)}
                className="w-7 h-7 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors flex-shrink-0">
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
          </div>
          <AnimatePresence>
            {expanded && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden">
                <div className="mt-3 space-y-2">
                  {prescription.items.map((med, i) => (
                    <div key={i} className="bg-muted/50 rounded-xl p-3">
                      <div className="flex items-start gap-2.5">
                        <Pill className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">{med.drugName}</p>
                          <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                            <span>{med.dosage}</span>
                            <span>{med.duration}</span>
                          </div>
                          {med.instructions && (
                            <p className="text-xs text-muted-foreground/70 mt-1 italic">{med.instructions}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export function FollowUpCard({ followUp }: { followUp: ContinuityFollowUp }) {
  const badge = statusBadge(followUp.status);
  const overdue = followUp.status === "pending" && isOverdue(followUp.recommendedDate);
  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
          overdue
            ? "bg-red-100 dark:bg-red-950/30"
            : "bg-amber-100 dark:bg-amber-950/30"
        }`}>
          <CalendarClock className={`w-5 h-5 ${
            overdue
              ? "text-red-600 dark:text-red-400"
              : "text-amber-600 dark:text-amber-400"
          }`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">Follow-Up</p>
              {followUp.doctorName && (
                <p className="text-xs text-muted-foreground">with {followUp.doctorName}</p>
              )}
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${badge.color}`}>
              {badge.label}
            </span>
          </div>
          {followUp.recommendedDate && (
            <div className="flex items-center gap-1.5 mt-2">
              <Calendar className={`w-3.5 h-3.5 flex-shrink-0 ${overdue ? "text-red-500" : "text-muted-foreground"}`} />
              <span className={`text-xs ${overdue ? "text-red-600 dark:text-red-400 font-semibold" : "text-muted-foreground"}`}>
                {new Date(followUp.recommendedDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                {followUp.status === "pending" && ` · ${timeRemaining(followUp.recommendedDate)}`}
              </span>
            </div>
          )}
          {followUp.reason && (
            <p className="text-xs text-muted-foreground/70 mt-1.5 italic line-clamp-1">"{followUp.reason}"</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function BillingCard({ billing }: { billing: ContinuityBilling }) {
  const badge = statusBadge(billing.status);
  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
          <IndianRupee className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">Payment</p>
              <p className="text-xs text-muted-foreground">
                {new Date(billing.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${badge.color}`}>
              {badge.label}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <div>
              <p className="text-[10px] text-muted-foreground">Total</p>
              <p className="text-sm font-bold text-foreground">₹{billing.fee.toLocaleString("en-IN")}</p>
            </div>
            {billing.amountPaid > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground">Paid</p>
                <p className="text-sm font-bold text-emerald-600">₹{billing.amountPaid.toLocaleString("en-IN")}</p>
              </div>
            )}
            {billing.pendingAmount > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground">Pending</p>
                <p className="text-sm font-bold text-amber-600">₹{billing.pendingAmount.toLocaleString("en-IN")}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ContinuityEventCard({ event }: { event: NormalizedContinuityEvent }) {
  if (event.type === "appointment") return <AppointmentCard appointment={event.data as ContinuityAppointment} />;
  if (event.type === "consultation") return <ConsultationCard consultation={event.data as ContinuityConsultation} />;
  if (event.type === "prescription") return <PrescriptionCard prescription={event.data as ContinuityPrescription} />;
  if (event.type === "follow_up") return <FollowUpCard followUp={event.data as ContinuityFollowUp} />;
  if (event.type === "billing") return <BillingCard billing={event.data as ContinuityBilling} />;
  return null;
}
