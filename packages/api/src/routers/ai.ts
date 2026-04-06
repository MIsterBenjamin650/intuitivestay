import { db } from "@intuitive-stay/db"
import { aiDailySummaries, feedback, properties } from "@intuitive-stay/db/schema"
import { env } from "@intuitive-stay/env/server"
import { and, eq, gte, lt } from "drizzle-orm"
import { z } from "zod"

import { adminProcedure, router } from "../index"
import { sendDailySummaryEmail } from "../lib/email"
import { generatePropertySummary } from "../lib/ai"

export const aiRouter = router({
  generateDailySummary: adminProcedure
    .input(z.object({ propertyId: z.string(), date: z.string() }))
    .mutation(async ({ input }) => {
      const targetDate = new Date(input.date)
      const dayStart = new Date(targetDate)
      dayStart.setUTCHours(0, 0, 0, 0)
      const dayEnd = new Date(targetDate)
      dayEnd.setUTCHours(23, 59, 59, 999)

      const prop = await db.query.properties.findFirst({
        where: eq(properties.id, input.propertyId),
        columns: { name: true, ownerEmail: true },
      })

      if (!prop) throw new Error("Property not found")

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
            eq(feedback.propertyId, input.propertyId),
            gte(feedback.submittedAt, dayStart),
            lt(feedback.submittedAt, dayEnd),
          ),
        )

      if (!rows.length) {
        return { skipped: true, reason: "No submissions for this date" }
      }

      const avg = (vals: number[]) =>
        vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null

      const summaryInput = {
        propertyName: prop.name,
        date: input.date,
        submissionCount: rows.length,
        avgGcs: avg(rows.map((r) => Number(r.gcs))),
        avgResilience: avg(rows.map((r) => r.resilience)),
        avgEmpathy: avg(rows.map((r) => r.empathy)),
        avgAnticipation: avg(rows.map((r) => r.anticipation)),
        avgRecognition: avg(rows.map((r) => r.recognition)),
        ventTexts: rows.map((r) => r.ventText).filter((t): t is string => !!t),
        staffMentions: rows.map((r) => r.namedStaffMember).filter((s): s is string => !!s),
      }

      const result = await generatePropertySummary(summaryInput)

      await db
        .insert(aiDailySummaries)
        .values({
          id: crypto.randomUUID(),
          propertyId: input.propertyId,
          date: input.date,
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
        input.date,
        result.narrative,
        result.focus,
        env.PUBLIC_PORTAL_URL,
      )

      return { skipped: false, date: input.date, submissionCount: rows.length }
    }),
})
