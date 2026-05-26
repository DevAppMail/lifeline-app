import type { MiddlewareHandler } from "hono";
import { verifyFederatedJwt, type FederatedIdentity } from "../lib/jwt.js";

declare module "hono" {
  interface ContextVariableMap {
    identity: FederatedIdentity;
  }
}

export const requireFederatedAuth: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const identity = await verifyFederatedJwt(token);
    c.set("identity", identity);
    await next();
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
};
