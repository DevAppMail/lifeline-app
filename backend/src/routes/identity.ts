import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { config } from "../config.js";
import { generateLifelineId } from "../lib/id-gen.js";
import { signFederatedJwt } from "../lib/jwt.js";
import { findOrCreateProPatient } from "../lib/pro-client.js";

export const identityRouter = new Hono();

interface SupabaseUserResponse {
  id: string;
  aud: string;
  role: string;
  email?: string;
  phone?: string;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface BridgeRequestBody {
  lifeline_id?: string;
  name?: string;
  phone?: string;
}

async function verifySupabaseToken(
  token: string,
): Promise<SupabaseUserResponse> {
  const response = await fetch(
    `${config.supabaseUrl}/auth/v1/user`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: config.supabaseAnonKey,
      },
    },
  );

  if (!response.ok) {
    throw new HTTPException(401, {
      message: "Invalid or expired Supabase session",
    });
  }

  return response.json() as Promise<SupabaseUserResponse>;
}

async function resolveAdminUserId(phone: string): Promise<number | null> {
  if (!phone) return null;

  try {
    const response = await fetch(
      `${config.adminApiUrl}/api/users/lookup?phone=${encodeURIComponent(phone)}`,
      {
        headers: {
          "X-BFF-Api-Key": config.adminBffApiKey,
        },
      },
    );

    if (response.ok) {
      const data = await response.json();
      return data.user?.id ?? null;
    }
  } catch {
    // Admin unreachable — carry on without admin_user_id
  }

  return null;
}

identityRouter.post("/identity/bridge", async (c) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new HTTPException(401, {
      message: "Missing or invalid Authorization header",
    });
  }

  const supabaseToken = authHeader.slice(7);

  const supabaseUser = await verifySupabaseToken(supabaseToken);

  const supabaseUid = supabaseUser.id;
  const phone = supabaseUser.phone || "";

  const body = await c.req.json().catch(() => ({})) as BridgeRequestBody;
  const lifelineId = body.lifeline_id || generateLifelineId();
  const displayName = body.name || "Patient";

  const adminUserId = await resolveAdminUserId(phone);

  const proPatientId = await findOrCreateProPatient(phone, displayName);

  const identity = {
    supabase_uid: supabaseUid,
    lifeline_id: lifelineId,
    admin_user_id: adminUserId,
    pro_patient_id: proPatientId,
    phone,
  };

  const token = await signFederatedJwt(identity);

  return c.json({ token, identity });
});

identityRouter.post("/identity/dev-bridge", async (c) => {
  if (config.nodeEnv !== "development") {
    return c.json({ error: "Dev bridge only available in development" }, 403);
  }

  const body = await c.req.json().catch(() => ({})) as BridgeRequestBody;
  const lifelineId = body.lifeline_id || "LL-DEV123456";
  const displayName = body.name || "Devraj (Test)";

  const identity = {
    supabase_uid: "dev-bypass-00000000-0000-0000-0000-000000000000",
    lifeline_id: lifelineId,
    admin_user_id: 1,
    pro_patient_id: "22222222-2222-4222-8222-222222222222",
    phone: body.phone || "919000000000",
  };

  const token = await signFederatedJwt(identity);

  return c.json({ token, identity });
});
