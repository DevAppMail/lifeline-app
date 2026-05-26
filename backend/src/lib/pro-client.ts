import { config } from "../config.js";

const PRO_HEADERS = {
  apikey: config.proSupabaseServiceKey || "",
  Authorization: `Bearer ${config.proSupabaseServiceKey || ""}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const COMMON_PARAMS = { select: "*" };

export async function queryProTable<T = Record<string, unknown>>(
  table: string,
  params?: Record<string, string>,
): Promise<T[]> {
  const url = new URL(`${config.proSupabaseUrl}/rest/v1/${table}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  const res = await fetch(url.toString(), { headers: PRO_HEADERS });
  if (!res.ok) {
    throw new Error(`Pro query failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
  return res.json() as Promise<T[]>;
}

export async function insertProTable<T = Record<string, unknown>>(
  table: string,
  data: Record<string, unknown>,
): Promise<T[]> {
  const params = new URLSearchParams(COMMON_PARAMS);
  const res = await fetch(`${config.proSupabaseUrl}/rest/v1/${table}?${params}`, {
    method: "POST",
    headers: PRO_HEADERS,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(`Pro insert failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
  return res.json() as Promise<T[]>;
}

export async function updateProTable<T = Record<string, unknown>>(
  table: string,
  column: string,
  value: string | number,
  data: Record<string, unknown>,
): Promise<T[]> {
  const params = new URLSearchParams({ ...COMMON_PARAMS, [column]: `eq.${value}` });
  const res = await fetch(`${config.proSupabaseUrl}/rest/v1/${table}?${params}`, {
    method: "PATCH",
    headers: PRO_HEADERS,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(`Pro update failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
  return res.json() as Promise<T[]>;
}

export async function rpcProFunction<T = unknown>(
  fn: string,
  params?: Record<string, unknown>,
): Promise<T> {
  const url = `${config.proSupabaseUrl}/rest/v1/rpc/${fn}`;
  const res = await fetch(url, {
    method: "POST",
    headers: PRO_HEADERS,
    body: params ? JSON.stringify(params) : undefined,
  });
  if (!res.ok) {
    throw new Error(`Pro RPC failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
  return res.json() as Promise<T>;
}

export async function queryAuthUsers(
  column: string,
  value: string,
): Promise<Array<{ id: string; phone?: string; email?: string }>> {
  const url = new URL(`${config.proSupabaseUrl}/rest/v1/users`);
  url.searchParams.set(`${column}`, `eq.${value}`);
  const headers = {
    ...PRO_HEADERS,
    Accept: "application/json",
    "Accept-Profile": "auth",
    "Content-Profile": "auth",
  };
  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    return [];
  }
  return res.json() as Promise<Array<{ id: string; phone?: string; email?: string }>>;
}

export async function resolveProDoctorIdByPhone(
  phone: string,
): Promise<string | null> {
  if (!phone) return null;
  try {
    const users = await queryAuthUsers("phone", phone);
    return users.length > 0 ? users[0].id : null;
  } catch {
    return null;
  }
}

export async function findOrCreateProPatient(
  phone: string,
  name: string,
): Promise<string | null> {
  if (!phone) return null;

  const existing = await queryProTable<{ id: string }>("pro_patients", {
    phone: `eq.${phone}`,
    select: "id",
    limit: "1",
  });
  if (existing.length > 0) {
    return existing[0].id;
  }

  const created = await insertProTable<{ id: string }>("pro_patients", {
    name,
    phone,
    source: "lifeline_app",
    archived: false,
    voided: false,
  });
  return created.length > 0 ? created[0].id : null;
}
