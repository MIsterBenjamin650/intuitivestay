import { trpcServer } from "@hono/trpc-server";
import { createContext } from "@intuitive-stay/api/context";
import { generatePropertySummary } from "@intuitive-stay/api/lib/ai";
import { sendDailySummaryEmail } from "@intuitive-stay/api/lib/email";
import { registerPropertyFromWix } from "@intuitive-stay/api/lib/register-property";
import { appRouter } from "@intuitive-stay/api/routers/index";
import { auth } from "@intuitive-stay/auth";
import { db } from "@intuitive-stay/db";
import { aiDailySummaries, feedback, properties } from "@intuitive-stay/db/schema";
import { env } from "@intuitive-stay/env/server";
import { and, eq, gte, lt } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { stripeWebhookHandler } from "./webhooks/stripe";

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

app.use("/api/properties/register", cors({
  origin: "*",
  allowMethods: ["POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "x-wixbridge-secret"],
}))

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

  let property
  try {
    property = await registerPropertyFromWix({
      ownerName,
      ownerEmail,
      propertyName,
      propertyAddress,
      propertyCity,
      propertyCountry,
      propertyType,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("registerPropertyFromWix error:", message)
    return c.json({ error: message }, 500)
  }

  if (!property) {
    return c.json({ error: "Failed to create property" }, 500)
  }

  return c.json({ success: true, propertyId: property.id }, 201)
})

app.post("/webhooks/stripe", stripeWebhookHandler)

app.get("/api/cron/daily-summaries", async (c) => {
  const cronSecret = env.CRON_SECRET
  const secret = c.req.header("x-cron-secret")
  if (!cronSecret || !secret || secret !== cronSecret) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const dateParam = c.req.query("date")
  const dateStr = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10) })()
  const dayStart = new Date(`${dateStr}T00:00:00.000Z`)
  const dayEnd = new Date(`${dateStr}T23:59:59.999Z`)

  const allProperties = await db
    .select({ id: properties.id, name: properties.name, ownerEmail: properties.ownerEmail })
    .from(properties)
    .where(eq(properties.status, "approved"))

  const results: { propertyId: string; status: string }[] = []

  for (const prop of allProperties) {
    const rows = await db
      .select({
        gcs: feedback.gcs,
        resilience: feedback.resilience,
        empathy: feedback.empathy,
        anticipation: feedback.anticipation,
        recognition: feedback.recognition,
        ventText: feedback.ventText,
        namedStaffMember: feedback.namedStaffMember,
      })
      .from(feedback)
      .where(
        and(
          eq(feedback.propertyId, prop.id),
          gte(feedback.submittedAt, dayStart),
          lt(feedback.submittedAt, dayEnd),
        ),
      )

    if (!rows.length) {
      results.push({ propertyId: prop.id, status: "skipped — no submissions" })
      continue
    }

    const avg = (vals: number[]) =>
      vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null

    const summaryInput = {
      propertyName: prop.name,
      date: dateStr,
      submissionCount: rows.length,
      avgGcs: avg(rows.map((r) => Number(r.gcs))),
      avgResilience: avg(rows.map((r) => r.resilience)),
      avgEmpathy: avg(rows.map((r) => r.empathy)),
      avgAnticipation: avg(rows.map((r) => r.anticipation)),
      avgRecognition: avg(rows.map((r) => r.recognition)),
      ventTexts: rows.map((r) => r.ventText).filter((t): t is string => !!t),
      staffMentions: rows.map((r) => r.namedStaffMember).filter((s): s is string => !!s),
    }

    try {
      const result = await generatePropertySummary(summaryInput)

      await db
        .insert(aiDailySummaries)
        .values({
          id: crypto.randomUUID(),
          propertyId: prop.id,
          date: dateStr,
          narrative: result.narrative,
          focusPoints: result.focus,
          generatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [aiDailySummaries.propertyId, aiDailySummaries.date],
          set: {
            narrative: result.narrative,
            focusPoints: result.focus,
            generatedAt: new Date(),
          },
        })

      await sendDailySummaryEmail(
        prop.ownerEmail,
        prop.name,
        dateStr,
        result.narrative,
        result.focus,
        env.PUBLIC_PORTAL_URL,
      )

      results.push({ propertyId: prop.id, status: "generated" })
    } catch (err) {
      results.push({ propertyId: prop.id, status: `error: ${String(err)}` })
    }
  }

  return c.json({ date: dateStr, results })
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
