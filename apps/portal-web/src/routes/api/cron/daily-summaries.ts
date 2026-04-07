import { db } from "@intuitive-stay/db"
import { aiDailySummaries, feedback, properties } from "@intuitive-stay/db/schema"
import { env } from "@intuitive-stay/env/server"
import { createAPIFileRoute } from "@tanstack/react-start/api"
import { and, eq, gte, lt } from "drizzle-orm"

import { sendDailySummaryEmail } from "@intuitive-stay/api/lib/email"
import { generatePropertySummary } from "@intuitive-stay/api/lib/ai"

export const APIRoute = createAPIFileRoute("/api/cron/daily-summaries")({
  GET: async ({ request }) => {
    const cronSecret = env.CRON_SECRET
    const secret = request.headers.get("x-cron-secret")
    if (!cronSecret || !secret || secret !== cronSecret) {
      return new Response("Unauthorized", { status: 401 })
    }

    // Generate summaries for yesterday (UTC)
    const yesterday = new Date()
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    const dateStr = yesterday.toISOString().slice(0, 10)

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

    return Response.json({ date: dateStr, results })
  },
})
