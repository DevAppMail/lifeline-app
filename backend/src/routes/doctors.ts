import { Hono } from "hono";
import { requireFederatedAuth } from "../middleware/auth.js";
import { proxyToAdmin, extractQueryString } from "../lib/proxy.js";

export const doctorsRouter = new Hono();

doctorsRouter.get("/doctors", requireFederatedAuth, async (c) => {
  const identity = c.var.identity;
  const queryString = extractQueryString(new URL(c.req.url));

  const response = await proxyToAdmin("/api/doctors", queryString, {
    identity,
  });

  const data = await response.json();
  return c.json(data, response.status as 200 | 400 | 401 | 500);
});

doctorsRouter.get("/doctors/:id", requireFederatedAuth, async (c) => {
  const identity = c.var.identity;
  const id = c.req.param("id");

  const response = await proxyToAdmin(`/api/doctors/${id}`, "", {
    identity,
  });

  if (response.status === 404) {
    return c.json({ error: "Doctor not found" }, 404);
  }

  if (!response.ok) {
    const data = await response.json();
    return c.json(data, response.status as 400 | 500);
  }

  const data = await response.json();
  return c.json(data);
});

doctorsRouter.get(
  "/doctors/:id/booked-slots",
  requireFederatedAuth,
  async (c) => {
    const identity = c.var.identity;
    const id = c.req.param("id");
    const queryString = extractQueryString(new URL(c.req.url));

    const response = await proxyToAdmin(
      `/api/doctors/${id}/booked-slots`,
      queryString,
      { identity },
    );

    const data = await response.json();
    return c.json(data, response.status as 200 | 400 | 500);
  },
);

doctorsRouter.get("/doctors/favourites", requireFederatedAuth, async (c) => {
  const identity = c.var.identity;
  const queryString = extractQueryString(new URL(c.req.url));

  const response = await proxyToAdmin("/api/doctors/favourites", queryString, { identity });

  const data = await response.json();
  return c.json(data, response.status as 200 | 400 | 500);
});

doctorsRouter.post("/doctors/favourites", requireFederatedAuth, async (c) => {
  const identity = c.var.identity;
  const body = await c.req.json();

  const response = await proxyToAdmin("/api/doctors/favourites", "", {
    identity,
    method: "POST",
    body: JSON.stringify(body),
    contentType: "application/json",
  });

  const data = await response.json();
  return c.json(data, response.status as 201 | 400 | 500);
});

doctorsRouter.delete("/doctors/favourites/:doctorId", requireFederatedAuth, async (c) => {
  const identity = c.var.identity;
  const doctorId = c.req.param("doctorId");
  const queryString = extractQueryString(new URL(c.req.url));

  const response = await proxyToAdmin(`/api/doctors/favourites/${doctorId}`, queryString, {
    identity,
    method: "DELETE",
  });

  const data = await response.json();
  return c.json(data, response.status as 200 | 400 | 500);
});
