import { Hono } from "hono";
import { requireFederatedAuth } from "../middleware/auth.js";
import { queryProTable, updateProTable } from "../lib/pro-client.js";
import type { PatientContinuityDTO, AppointmentDTO, ConsultationDTO, PrescriptionDTO, FollowUpDTO, BillingDTO } from "../lib/dto.js";

export const continuityRouter = new Hono();

continuityRouter.get("/continuity", requireFederatedAuth, async (c) => {
  const identity = c.var.identity;
  const proPatientId = identity.pro_patient_id;

  if (!proPatientId) {
    return c.json({ error: "No patient record found. Complete the identity bridge first." }, 400);
  }

  const appointments = await safeQueryPro("pro_appointments", {
    patient_id: `eq.${proPatientId}`,
    order: "appointment_date.desc,appointment_time.desc",
    select: "*",
  });

  const consultations = await safeQueryPro("pro_consultation_sessions", {
    patient_id: `eq.${proPatientId}`,
    order: "started_at.desc",
    select: "*",
  });

  const prescriptions = await safeQueryPro("pro_session_prescriptions", {
    patient_id: `eq.${proPatientId}`,
    order: "created_at.desc",
    select: "*",
  });

  const followUps = await safeQueryPro("pro_follow_up_recommendations", {
    patient_id: `eq.${proPatientId}`,
    order: "recommended_date.asc",
    select: "*",
  });

  const billing = await safeQueryPro("pro_session_billing", {
    patient_id: `eq.${proPatientId}`,
    order: "created_at.desc",
    select: "*",
  });

  const now = new Date();

  const apptDTOs: AppointmentDTO[] = appointments.map((a) => {
    const meta = safeParseJson(String(a.notes ?? "{}"));
    return {
      id: String(a.id),
      doctorId: meta.admin_id ? Number(meta.admin_id) : undefined,
      doctorName: String(meta.name ?? "Doctor"),
      doctorSpecialty: String(meta.specialty ?? ""),
      clinicName: "",
      date: String(a.appointment_date ?? ""),
      time: String(a.appointment_time ?? "").slice(0, 5),
      status: String(a.status ?? "scheduled"),
      reason: a.patient_visible_note ? String(a.patient_visible_note) : undefined,
      appointmentSource: String(a.appointment_source ?? "patient"),
      canCancel: String(a.status ?? "") === "scheduled",
    };
  });

  const consultationDTOs: ConsultationDTO[] = consultations.map((c) => {
    const vitals = c.vitals ? ((typeof c.vitals === "string" ? JSON.parse(c.vitals) : c.vitals) as Record<string, unknown>) : undefined;
    return {
      id: String(c.id),
      appointmentId: String(c.appointment_id || ""),
      date: String(c.started_at || "").slice(0, 10),
      doctorName: "",
      diagnosis: c.diagnosis ? String(c.diagnosis) : undefined,
      notes: c.clinical_notes ? String(c.clinical_notes) : undefined,
      vitals: vitals ? {
        bloodPressure: String(vitals.blood_pressure || vitals.bloodPressure || ""),
        heartRate: Number(vitals.heart_rate || vitals.heartRate || 0),
        temperature: Number(vitals.temperature || 0),
        weight: Number(vitals.weight || 0),
      } : undefined,
    };
  });

  const prescriptionDTOs: PrescriptionDTO[] = prescriptions.map((p) => {
    const meds = p.medicines ? ((typeof p.medicines === "string" ? JSON.parse(p.medicines) : p.medicines) as Array<Record<string, string>>) : [];
    const items = meds.map((m) => ({
      drugName: String(m.name || m.drugName || ""),
      dosage: String(m.dosage || ""),
      duration: String(m.duration || ""),
      instructions: String(m.instructions || ""),
    }));
    return {
      id: String(p.id),
      consultationId: String(p.session_id || ""),
      date: String(p.created_at || "").slice(0, 10),
      doctorName: "",
      items,
    };
  });

  const followUpDTOs: FollowUpDTO[] = followUps.map((f) => ({
    id: String(f.id),
    recommendedDate: String(f.recommended_date || ""),
    reason: f.reason ? String(f.reason) : undefined,
    status: String(f.status || "pending"),
    doctorName: "",
  }));

  const billingDTOs: BillingDTO[] = billing.map((b) => ({
    id: String(b.id),
    consultationId: String(b.session_id || ""),
    fee: Number(b.consultation_fee || 0) + Number(b.medicine_fee || 0) + Number(b.additional_fee || 0),
    amountPaid: Number(b.amount_paid || 0),
    pendingAmount: Math.max(0, Number(b.total_amount || 0) - Number(b.amount_paid || 0)),
    status: String(b.status || "pending"),
    date: String(b.created_at || "").slice(0, 10),
  }));

  const completed = apptDTOs.filter((a) => a.status === "completed" || a.status === "arrived");
  const totalSpent = billingDTOs.filter((b) => b.status === "completed").reduce((s, b) => s + b.amountPaid, 0);
  const totalPending = billingDTOs.filter((b) => b.status === "pending").reduce((s, b) => s + b.pendingAmount, 0);
  const pendingFollowUps = followUpDTOs.filter((f) => f.status === "pending");

  const summary = {
    totalAppointments: apptDTOs.length,
    totalCompleted: completed.length,
    totalSpent,
    totalPending,
    lastVisitDate: completed.length > 0 ? completed[0].date : undefined,
    nextAppointmentDate: apptDTOs.filter((a) => a.status === "scheduled").slice(0, 1).map((a) => a.date)[0],
    pendingFollowUps: pendingFollowUps.length,
  };

  const result: PatientContinuityDTO = {
    appointments: apptDTOs,
    consultations: consultationDTOs,
    prescriptions: prescriptionDTOs,
    followUps: followUpDTOs,
    billing: billingDTOs,
    summary,
  };

  return c.json(result);
});

continuityRouter.get("/continuity/appointments", requireFederatedAuth, async (c) => {
  const identity = c.var.identity;
  if (!identity.pro_patient_id) {
    return c.json({ error: "No patient record found" }, 400);
  }
  const rows = await safeQueryPro("pro_appointments", {
    patient_id: `eq.${identity.pro_patient_id}`,
    order: "appointment_date.desc",
    select: "*",
  });
  return c.json(rows);
});

continuityRouter.get("/continuity/consultations", requireFederatedAuth, async (c) => {
  const identity = c.var.identity;
  if (!identity.pro_patient_id) {
    return c.json({ error: "No patient record found" }, 400);
  }
  const rows = await safeQueryPro("pro_consultation_sessions", {
    patient_id: `eq.${identity.pro_patient_id}`,
    order: "started_at.desc",
    select: "*",
  });
  return c.json(rows);
});

continuityRouter.get("/continuity/prescriptions", requireFederatedAuth, async (c) => {
  const identity = c.var.identity;
  if (!identity.pro_patient_id) {
    return c.json({ error: "No patient record found" }, 400);
  }
  const rows = await safeQueryPro("pro_session_prescriptions", {
    patient_id: `eq.${identity.pro_patient_id}`,
    order: "created_at.desc",
    select: "*",
  });
  return c.json(rows);
});

continuityRouter.get("/continuity/follow-ups", requireFederatedAuth, async (c) => {
  const identity = c.var.identity;
  if (!identity.pro_patient_id) {
    return c.json({ error: "No patient record found" }, 400);
  }
  const rows = await safeQueryPro("pro_follow_up_recommendations", {
    patient_id: `eq.${identity.pro_patient_id}`,
    order: "recommended_date.asc",
    select: "*",
  });
  return c.json(rows);
});

continuityRouter.patch("/continuity/follow-ups/:id/respond", requireFederatedAuth, async (c) => {
  const identity = c.var.identity;
  const id = c.req.param("id");
  if (!identity.pro_patient_id) {
    return c.json({ error: "No patient record found" }, 400);
  }
  const body = await c.req.json() as {
    status: "accepted" | "rejected" | "rescheduled";
    rescheduled_date?: string;
    reason?: string;
  };
  const validStatuses = ["accepted", "rejected", "rescheduled"];
  if (!validStatuses.includes(body.status)) {
    return c.json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` }, 400);
  }
  try {
    const [updated] = await updateProTable("pro_follow_up_recommendations", "id", id, { status: body.status });
    if (!updated) {
      return c.json({ error: "Follow-up not found or update failed" }, 404);
    }
    return c.json({ success: true, status: body.status });
  } catch (e) {
    return c.json({ error: `Failed to update follow-up: ${e instanceof Error ? e.message : String(e)}` }, 500);
  }
});

continuityRouter.get("/continuity/billing", requireFederatedAuth, async (c) => {
  const identity = c.var.identity;
  if (!identity.pro_patient_id) {
    return c.json({ error: "No patient record found" }, 400);
  }
  const rows = await safeQueryPro("pro_session_billing", {
    patient_id: `eq.${identity.pro_patient_id}`,
    order: "created_at.desc",
    select: "*",
  });
  return c.json(rows);
});

function safeParseJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function safeQueryPro<T = Record<string, unknown>>(table: string, params?: Record<string, string>): Promise<T[]> {
  try {
    return await queryProTable<T>(table, params);
  } catch {
    return [];
  }
}
