import { trpcServer } from "@hono/trpc-server";
import { createContext } from "@intuitive-stay/api/context";
import { registerPropertyFromWix } from "@intuitive-stay/api/lib/register-property";
import { appRouter } from "@intuitive-stay/api/routers/index";
import { auth } from "@intuitive-stay/auth";
import { env } from "@intuitive-stay/env/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_opts, context) => {
      return createContext({ context });
    },
  }),
);

app.post("/api/properties/register", async (c) => {
  const secret = c.req.header("x-wixbridge-secret")
  if (!secret || secret !== env.WIXBRIDGE_SECRET) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400)
  }

  const ownerName = typeof body.ownerName === "string" ? body.ownerName.trim() : ""
  const ownerEmail = typeof body.ownerEmail === "string" ? body.ownerEmail.trim() : ""
  const propertyName = typeof body.propertyName === "string" ? body.propertyName.trim() : ""
  const propertyCity = typeof body.propertyCity === "string" ? body.propertyCity.trim() : ""
  const propertyCountry =
    typeof body.propertyCountry === "string" ? body.propertyCountry.trim() : ""

  if (!ownerName || !ownerEmail || !propertyName || !propertyCity || !propertyCountry) {
    return c.json(
      {
        error:
          "Missing required fields: ownerName, ownerEmail, propertyName, propertyCity, propertyCountry",
      },
      400,
    )
  }

  const propertyAddress =
    typeof body.propertyAddress === "string" ? body.propertyAddress.trim() : undefined
  const propertyType =
    typeof body.propertyType === "string" ? body.propertyType.trim() : undefined

  const property = await registerPropertyFromWix({
    ownerName,
    ownerEmail,
    propertyName,
    propertyAddress,
    propertyCity,
    propertyCountry,
    propertyType,
  })

  if (!property) {
    return c.json({ error: "Failed to create property" }, 500)
  }

  return c.json({ success: true, propertyId: property.id }, 201)
})

app.get("/", (c) => {
  return c.text("OK");
});

import { serve } from "@hono/node-server";

serve(
  {
    fetch: app.fetch,
    port: 5174,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
