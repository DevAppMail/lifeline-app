import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { config } from "./config.js";
import { errorHandler } from "./middleware/error.js";
import { healthRouter } from "./routes/health.js";
import { identityRouter } from "./routes/identity.js";
import { doctorsRouter } from "./routes/doctors.js";
import { appointmentsRouter } from "./routes/appointments.js";
import { continuityRouter } from "./routes/continuity.js";
import { registerRouter } from "./routes/register.js";

const app = new Hono();

const CORS_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:5000,http://localhost:3002,http://localhost:3000,http://localhost:5173")
  .split(",")
  .map((s) => s.trim());

app.use(
  "*",
  cors({
    origin: CORS_ORIGINS,
    credentials: true,
  }),
);
app.onError(errorHandler);

app.route("/api/app", healthRouter);
app.route("/api/app", identityRouter);
app.route("/api/app", doctorsRouter);
app.route("/api/app", appointmentsRouter);
app.route("/api/app", continuityRouter);
app.route("/api/app", registerRouter);

if (!config.jwtSecret || !config.adminBffApiKey) {
  console.error("[BFF] FATAL: JWT_SECRET and ADMIN_BFF_API_KEY must be set in production");
  process.exit(1);
}

console.log(
  `[BFF] lifeline-app-bff starting on port ${config.port} (${config.nodeEnv})`,
);

serve({
  fetch: app.fetch,
  port: config.port,
});
