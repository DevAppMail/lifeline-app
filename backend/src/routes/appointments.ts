import { Hono } from "hono";
import { requireFederatedAuth } from "../middleware/auth.js";
import { proxyToAdmin, extractQueryString } from "../lib/proxy.js";
import { queryProTable, insertProTable, updateProTable, resolveProDoctorIdByPhone } from "../lib/pro-client.js";

export const appointmentsRouter = new Hono();

appointmentsRouter.get("/appointments", requireFederatedAuth, async (c) => {
  const identity = c.var.identity;
  const proPatientId = identity.pro_patient_id;

  if (proPatientId) {
    try {
      const rows = await queryProTable<Record<string, unknown>>("pro_appointments", {
        patient_id: `eq.${proPatientId}`,
        order: "appointment_date.desc,appointment_time.desc",
        select: "*",
      });
      const transformed = rows.map((r) => {
        const rawNotes = String(r.notes || "{}");
        let meta: Record<string, unknown> = {};
        try { meta = JSON.parse(rawNotes) as Record<string, unknown>; } catch { meta = {}; }
        return {
          id: String(r.id),
          doctor_id: meta.admin_id ?? null,
          doctor_name: meta.name ?? "",
          doctor_specialty: meta.specialty ?? "",
          appointment_date: String(r.appointment_date || ""),
          appointment_time: String(r.appointment_time || "").slice(0, 5),
          status: String(r.status || "scheduled"),
          booking_id: null,
          for_self: true,
          patient_name_override: r.patient_name ? String(r.patient_name) : null,
          reason: r.patient_visible_note ? String(r.patient_visible_note) : null,
          fee: null,
          rating: (meta.rating as number) ?? null,
          rating_comment: (meta.rating_comment as string) ?? null,
          rated_at: (meta.rated_at as string) ?? null,
          doctor_confirmed: r.status === "confirmed",
          deposit_held: false,
          deposit_amount: null,
          attended_at: r.status === "completed" ? String(r.updated_at || "") : null,
          cancelled_at: r.voided ? String(r.voided_at || "") : null,
          no_show_at: r.status === "no_show" ? String(r.updated_at || "") : null,
        };
      });
      return c.json(transformed);
    } catch {
      // Fall through to admin fallback
    }
  }

  if (!identity.phone) {
    return c.json({ error: "Phone number required" }, 400);
  }

  const response = await proxyToAdmin(
    "/api/appointments/by-phone",
    `phone=${encodeURIComponent(identity.phone)}`,
    { identity },
  );
  const data = await response.json();
  return c.json(data, response.status as 200 | 400 | 500);
});

appointmentsRouter.post("/appointments", requireFederatedAuth, async (c) => {
  const identity = c.var.identity;
  const body = await c.req.json() as {
    doctor_id: number;
    doctor_name?: string;
    doctor_phone?: string;
    appointment_date: string;
    appointment_time: string;
    for_self: boolean;
    patient_name_override?: string | null;
    relation?: string | null;
    reason?: string | null;
    allergies?: string | null;
    fee?: number | null;
    deposit_held?: boolean;
    deposit_amount?: number | null;
    status?: string;
  };

  const proPatientId = identity.pro_patient_id;

  const patientName = body.for_self
    ? (body.patient_name_override || "Patient")
    : (body.patient_name_override || "Guest");

  let proDoctorId: string | null = null;
  if (body.doctor_phone) {
    proDoctorId = await resolveProDoctorIdByPhone(body.doctor_phone);
  }

  const doctorMeta = {
    admin_id: body.doctor_id,
    name: body.doctor_name || "",
    phone: body.doctor_phone || "",
  };

  if (proPatientId && proDoctorId) {
    try {
      const created = await insertProTable("pro_appointments", {
        doctor_id: proDoctorId,
        patient_id: proPatientId,
        patient_name: patientName,
        patient_phone: identity.phone,
        appointment_date: body.appointment_date,
        appointment_time: body.appointment_time,
        type: "consultation",
        status: body.status || "scheduled",
        appointment_source: "patient",
        notes: JSON.stringify(doctorMeta),
        patient_visible_note: body.reason || null,
      });
      return c.json(created[0] || { id: null }, 201);
    } catch {
      // Fall through to admin
    }
  }

  const response = await proxyToAdmin("/api/appointments", "", {
    identity,
    method: "POST",
    body: JSON.stringify(body),
    contentType: "application/json",
  });
  const data = await response.json();
  const status = response.status as 201 | 400 | 409 | 500;
  return c.json(data, status);
});

appointmentsRouter.patch("/appointments/:id/cancel", requireFederatedAuth, async (c) => {
  const identity = c.var.identity;
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({})) as { reason?: string };

  const proPatientId = identity.pro_patient_id;

  if (proPatientId) {
    try {
      await updateProTable("pro_appointments", "id", id, {
        status: "cancelled",
        voided: true,
        voided_at: new Date().toISOString(),
        void_reason: body.reason || "Patient requested cancellation",
      });
      return c.json({ success: true });
    } catch {
      // Fall through to admin
    }
  }

  const response = await proxyToAdmin(`/api/appointments/${id}/cancel`, "", {
    identity,
    method: "PATCH",
    body: JSON.stringify(body),
    contentType: "application/json",
  });
  const data = await response.json();
  return c.json(data, response.status as 200 | 400 | 500);
});

appointmentsRouter.patch("/appointments/:id/rate", requireFederatedAuth, async (c) => {
  const identity = c.var.identity;
  const id = c.req.param("id");
  const { rating, comment } = await c.req.json() as { rating: number; comment?: string };
  if (!rating || rating < 1 || rating > 5) {
    return c.json({ error: "rating must be 1–5" }, 400);
  }

  const proPatientId = identity.pro_patient_id;
  if (proPatientId && /^[0-9a-f-]+$/i.test(id)) {
    try {
      const rows = await queryProTable<Record<string, unknown>>("pro_appointments", {
        id: `eq.${id}`,
        patient_id: `eq.${proPatientId}`,
        select: "*",
      });
      if (rows.length > 0) {
        const appt = rows[0]!;
        if (appt.status !== "completed") {
          return c.json({ error: "Only completed appointments can be rated" }, 400);
        }
        const rawNotes = String(appt.notes || "{}");
        let meta: Record<string, unknown> = {};
        try { meta = JSON.parse(rawNotes) as Record<string, unknown>; } catch { meta = {}; }
        meta.rating = rating;
        meta.rating_comment = comment || null;
        meta.rated_at = new Date().toISOString();

        await updateProTable("pro_appointments", "id", id, {
          notes: JSON.stringify(meta),
          status: "completed",
        });
        return c.json({ success: true });
      }
    } catch {}
  }

  if (!/^\d+$/.test(id)) return c.json({ error: "Appointment not found" }, 404);
  const response = await proxyToAdmin(`/api/appointments/${id}/rate`, "", {
    identity,
    method: "PATCH",
    body: JSON.stringify({ rating, comment }),
    contentType: "application/json",
  });
  const data = await response.json();
  return c.json(data, response.status as 200 | 400 | 500);
});

appointmentsRouter.get("/appointments/no-show-count", requireFederatedAuth, async (c) => {
  const identity = c.var.identity;

  if (identity.pro_patient_id) {
    try {
      const rows = await queryProTable("pro_appointments", {
        patient_id: `eq.${identity.pro_patient_id}`,
        status: "eq.no_show",
        select: "id",
      });
      return c.json({ count: rows.length });
    } catch {
      // Fall through to admin
    }
  }

  const response = await proxyToAdmin(
    "/api/appointments/no-show-count",
    `phone=${encodeURIComponent(identity.phone || "")}`,
    { identity },
  );
  const data = await response.json();
  return c.json(data, response.status as 200 | 400 | 500);
});
