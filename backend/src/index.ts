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

const app = new Hono();

app.use("*", cors());
app.onError(errorHandler);

app.route("/api/app", healthRouter);
app.route("/api/app", identityRouter);
app.route("/api/app", doctorsRouter);
app.route("/api/app", appointmentsRouter);
app.route("/api/app", continuityRouter);

console.log(
  `[BFF] lifeline-app-bff starting on port ${config.port} (${config.nodeEnv})`,
);

serve({
  fetch: app.fetch,
  port: config.port,
});
