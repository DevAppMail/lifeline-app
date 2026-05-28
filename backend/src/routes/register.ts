import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { config } from "../config.js";

const SUPABASE_AUTH_URL = `${config.supabaseUrl}/auth/v1/user`;

interface SupabaseUserResponse {
  id: string;
  email?: string;
  phone?: string;
}

async function verifySupabaseToken(token: string): Promise<SupabaseUserResponse> {
  const response = await fetch(SUPABASE_AUTH_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: config.supabaseAnonKey,
    },
  });

  if (!response.ok) {
    throw new HTTPException(401, { message: "Invalid Supabase session" });
  }

  return response.json() as Promise<SupabaseUserResponse>;
}

export const registerRouter = new Hono();

registerRouter.post("/users/register", async (c) => {
  const authHeader = c.req.header("X-Supabase-Auth");
  if (!authHeader) {
    throw new HTTPException(401, { message: "Missing X-Supabase-Auth header" });
  }

  const supabaseUser = await verifySupabaseToken(authHeader);

  const body = await c.req.json().catch(() => ({})) as {
    name?: string;
    phone?: string;
    email?: string;
    blood_group?: string;
    city?: string;
  };

  const name = body.name || supabaseUser.email?.split("@")[0] || "Patient";
  const phone = body.phone || supabaseUser.phone || "";
  const email = body.email || supabaseUser.email || "";
  const bloodGroup = body.blood_group || "";
  const city = body.city || "";

  const userPayload = {
    full_name: name,
    phone,
    email,
    city,
    role: "patient",
    is_active: true,
  };

  const adminRes = await fetch(`${config.adminApiUrl}/api/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-BFF-Api-Key": config.adminBffApiKey,
    },
    body: JSON.stringify(userPayload),
  });

  if (!adminRes.ok) {
    const errText = await adminRes.text().catch(() => "unknown error");
    return c.json({ error: `Admin user creation failed: ${adminRes.status} ${errText}` }, 502);
  }

  const createdUser = await adminRes.json() as { id: string; [key: string]: unknown };

  if (bloodGroup) {
    const donorPayload: Record<string, unknown> = {
      user_id: createdUser.id,
      blood_group: bloodGroup,
      availability_toggle: true,
      status: "active",
    };

    await fetch(`${config.adminApiUrl}/api/donors`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-BFF-Api-Key": config.adminBffApiKey,
      },
      body: JSON.stringify(donorPayload),
    }).catch(() => {});
  }

  return c.json({ user: createdUser }, 201);
});
