import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { config } from "../config.js";

const SECRET = new TextEncoder().encode(config.jwtSecret);

export interface FederatedIdentity {
  supabase_uid: string;
  lifeline_id: string;
  admin_user_id: number | null;
  pro_patient_id: string | null;
  phone: string;
}

export interface FederatedJwtPayload extends JWTPayload, FederatedIdentity {}

export async function signFederatedJwt(
  identity: FederatedIdentity,
): Promise<string> {
  const payload: FederatedJwtPayload & JWTPayload = {
    ...identity,
  };

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(config.jwtExpiresIn)
    .sign(SECRET);
}

export async function verifyFederatedJwt(
  token: string,
): Promise<FederatedIdentity> {
  const { payload } = await jwtVerify(token, SECRET, {
    algorithms: ["HS256"],
  });

  return {
    supabase_uid: payload.supabase_uid as string,
    lifeline_id: payload.lifeline_id as string,
    admin_user_id: (payload.admin_user_id as number) ?? null,
    pro_patient_id: (payload.pro_patient_id as string) ?? null,
    phone: payload.phone as string,
  };
}
