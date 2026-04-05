# Phase 3 — QR Codes & Guest Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-generate a branded QR code PDF on property approval, serve a mobile-first public guest feedback form at `/f/[uniqueCode]`, calculate GCS, branch to Name Drop™ (GCS ≥ 8) or Vent Box™ (GCS ≤ 5), send red alert emails for low scores, and show a live alert badge in the portal topbar.

**Architecture:** On property approval, a `uniqueCode` is generated, stored in `qr_codes`, and a branded PDF is emailed to the owner. Guests scan the QR and land on a public TanStack Router route (`/f/$uniqueCode`) that uses tRPC `publicProcedure` endpoints. Feedback is saved, property averages are recalculated in-place, and a Resend email fires for low scores. The portal topbar badge queries a `protectedProcedure` for unread alert count.

**Tech Stack:** qrcode, pdf-lib, tRPC publicProcedure, TanStack Router, Resend, Drizzle ORM

---

## File Map

**Create:**
- `packages/api/src/lib/generate-qr.ts` — QR PNG + PDF generation helpers
- `packages/api/src/routers/feedback.ts` — public feedback tRPC router + alert count procedure
- `apps/portal-web/src/routes/f.$uniqueCode.tsx` — guest feedback form (public, no auth)

**Modify:**
- `packages/api/package.json` — add qrcode, pdf-lib deps
- `packages/api/src/lib/email.ts` — update sendApprovalEmail to accept PDF attachment; add sendAlertEmail
- `packages/api/src/routers/properties.ts` — update approveProperty to generate QR + email PDF
- `packages/api/src/routers/index.ts` — register feedbackRouter
- `apps/portal-web/src/components/topbar-notifications.tsx` — wire to real alert count

---

## Task 1: Install QR code and PDF generation packages

**Files:**
- Modify: `packages/api/package.json` (pnpm manages this)

- [ ] **Step 1: Install runtime packages**

  From the repo root:
  ```bash
  pnpm add qrcode pdf-lib --filter @intuitive-stay/api
  ```

- [ ] **Step 2: Install TypeScript types for qrcode**

  ```bash
  pnpm add -D @types/qrcode --filter @intuitive-stay/api
  ```

- [ ] **Step 3: Verify packages were added**

  ```bash
  grep -E "qrcode|pdf-lib" packages/api/package.json
  ```

  Expected: both `qrcode` and `pdf-lib` appear in dependencies; `@types/qrcode` in devDependencies.

- [ ] **Step 4: Commit**

  ```bash
  git add packages/api/package.json pnpm-lock.yaml
  git commit -m "feat(api): install qrcode and pdf-lib for QR generation"
  ```

---

## Task 2: Build QR code + PDF generator

**Files:**
- Create: `packages/api/src/lib/generate-qr.ts`

- [ ] **Step 1: Create the generator file**

  Create `packages/api/src/lib/generate-qr.ts`:

  ```typescript
  import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
  import QRCode from "qrcode"

  /** Generates an 8-character alphanumeric unique code for a QR URL. */
  export function generateUniqueCode(): string {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 8)
  }

  /**
   * Generates a branded PDF containing a QR code pointing to feedbackUrl.
   * Returns a Buffer of the PDF bytes suitable for email attachment.
   */
  export async function generateQrPdf(feedbackUrl: string, propertyName: string): Promise<Buffer> {
    // 1. Generate QR code as PNG buffer
    const qrPngBuffer = await QRCode.toBuffer(feedbackUrl, {
      width: 280,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    })

    // 2. Build PDF (400 × 520 points)
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([400, 520])

    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)

    // Embed QR image and scale to 260×260
    const qrImage = await pdfDoc.embedPng(qrPngBuffer)
    const qrSize = 260
    const qrX = (400 - qrSize) / 2 // horizontally centred

    page.drawImage(qrImage, { x: qrX, y: 195, width: qrSize, height: qrSize })

    // "IntuItiveStay" heading
    page.drawText("IntuItiveStay", {
      x: 50,
      y: 480,
      size: 20,
      font: boldFont,
      color: rgb(0, 0, 0),
    })

    // Property name
    page.drawText(propertyName, {
      x: 50,
      y: 450,
      size: 13,
      font: boldFont,
      color: rgb(0.25, 0.25, 0.25),
      maxWidth: 300,
    })

    // Instruction below QR
    page.drawText("Scan to share your feedback", {
      x: 50,
      y: 165,
      size: 11,
      font: regularFont,
      color: rgb(0.4, 0.4, 0.4),
    })

    // URL in small text
    page.drawText(feedbackUrl, {
      x: 50,
      y: 145,
      size: 8,
      font: regularFont,
      color: rgb(0.6, 0.6, 0.6),
      maxWidth: 300,
    })

    const pdfBytes = await pdfDoc.save()
    return Buffer.from(pdfBytes)
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  cd packages/api && npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 3: Commit**

  ```bash
  git add packages/api/src/lib/generate-qr.ts
  git commit -m "feat(api): add QR code PNG + branded PDF generator"
  ```

---

## Task 3: Update email helpers — PDF attachment + alert email

**Files:**
- Modify: `packages/api/src/lib/email.ts`

- [ ] **Step 1: Read the current file**

  Read `packages/api/src/lib/email.ts` fully before editing.

- [ ] **Step 2: Update sendApprovalEmail to accept an optional PDF buffer**

  Change the `sendApprovalEmail` function signature and body to:

  ```typescript
  export async function sendApprovalEmail(
    ownerEmail: string,
    ownerName: string,
    propertyName: string,
    qrPdfBuffer?: Buffer,
  ) {
    await resend.emails.send({
      from: FROM,
      to: ownerEmail,
      subject: `Your property "${propertyName}" has been approved`,
      html: `<h1>Welcome to IntuItiveStay, ${ownerName}!</h1>
  <p>Your property <strong>${propertyName}</strong> has been approved and is now live.</p>
  <p>Log in to your portal to view your dashboard and download your QR code:</p>
  <p><a href="${env.PUBLIC_PORTAL_URL}">${env.PUBLIC_PORTAL_URL}</a></p>
  <p>Your branded QR code is attached to this email as a PDF. Print it and place it at reception, bedside tables, or dining areas.</p>
  <p>If you haven't set a password yet, use the "Forgot password" option on the login page.</p>`,
      attachments: qrPdfBuffer
        ? [
            {
              filename: `${propertyName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-qr-code.pdf`,
              content: qrPdfBuffer,
            },
          ]
        : undefined,
    })
  }
  ```

- [ ] **Step 3: Add sendAlertEmail at the end of the file**

  ```typescript
  export async function sendAlertEmail(
    ownerEmail: string,
    ownerName: string,
    propertyName: string,
    gcs: number,
    pillars: { resilience: number; empathy: number; consistency: number; recognition: number },
  ) {
    await resend.emails.send({
      from: FROM,
      to: ownerEmail,
      subject: `⚠️ Low score alert at ${propertyName}`,
      html: `<h1>Hi ${ownerName},</h1>
  <p>A guest at <strong>${propertyName}</strong> submitted a low Guest Connection Score of <strong>${gcs.toFixed(2)}</strong>.</p>
  <p><strong>Pillar breakdown:</strong></p>
  <ul>
    <li>Resilience: ${pillars.resilience}/10</li>
    <li>Empathy: ${pillars.empathy}/10</li>
    <li>Consistency: ${pillars.consistency}/10</li>
    <li>Recognition: ${pillars.recognition}/10</li>
  </ul>
  <p>Log in to your portal to view any additional feedback left by the guest:</p>
  <p><a href="${env.PUBLIC_PORTAL_URL}">${env.PUBLIC_PORTAL_URL}</a></p>`,
    })
  }
  ```

- [ ] **Step 4: Verify TypeScript compiles**

  ```bash
  cd packages/api && npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/api/src/lib/email.ts
  git commit -m "feat(api): update approval email to include QR PDF attachment; add sendAlertEmail"
  ```

---

## Task 4: Update approveProperty to generate QR code and email PDF

**Files:**
- Modify: `packages/api/src/routers/properties.ts`

The `approveProperty` procedure must now: (1) generate a unique code, (2) save the QR code record to `qr_codes`, (3) generate the PDF, and (4) send the approval email with the PDF attached. All of steps 3-4 are fire-and-forget so they do not block the mutation response.

- [ ] **Step 1: Read the current file**

  Read `packages/api/src/routers/properties.ts` fully.

- [ ] **Step 2: Add new imports**

  At the top of the file, add:
  ```typescript
  import { qrCodes } from "@intuitive-stay/db/schema"
  import { env } from "@intuitive-stay/env/server"
  import { generateQrPdf, generateUniqueCode } from "../lib/generate-qr"
  ```

- [ ] **Step 3: Replace the approveProperty mutation body**

  Replace the entire `approveProperty` procedure with:

  ```typescript
  approveProperty: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const [property] = await db
        .update(properties)
        .set({ status: "approved", updatedAt: new Date() })
        .where(eq(properties.id, input.id))
        .returning()

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })
      }

      // Check if a QR code already exists (idempotency — re-approving a property should not create a duplicate)
      const existingQr = await db.query.qrCodes.findFirst({
        where: eq(qrCodes.propertyId, property.id),
      })

      if (!existingQr) {
        const uniqueCode = generateUniqueCode()
        const feedbackUrl = `${env.PUBLIC_PORTAL_URL}/f/${uniqueCode}`

        await db.insert(qrCodes).values({
          id: crypto.randomUUID(),
          propertyId: property.id,
          uniqueCode,
          feedbackUrl,
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        // Fire-and-forget: generate PDF then send approval email with attachment
        generateQrPdf(feedbackUrl, property.name)
          .then((pdfBuffer) =>
            sendApprovalEmail(property.ownerEmail, property.ownerName, property.name, pdfBuffer),
          )
          .catch((err) => console.error("Failed to generate QR / send approval email:", err))
      } else {
        // QR already exists — just resend the approval email without regenerating
        sendApprovalEmail(property.ownerEmail, property.ownerName, property.name).catch((err) =>
          console.error("Failed to send approval email:", err),
        )
      }

      return property
    }),
  ```

- [ ] **Step 4: Verify TypeScript compiles**

  ```bash
  cd packages/api && npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/api/src/routers/properties.ts
  git commit -m "feat(api): generate QR code and email branded PDF on property approval"
  ```

---

## Task 5: Build feedback tRPC router

**Files:**
- Create: `packages/api/src/routers/feedback.ts`

This router has five procedures. The first four are `publicProcedure` (no auth needed — guests submit feedback without accounts). The fifth is `protectedProcedure` (owners see their alert count in the portal topbar).

An internal helper `updatePropertyScores` recalculates running averages after each submission.

- [ ] **Step 1: Create the feedback router file**

  Create `packages/api/src/routers/feedback.ts`:

  ```typescript
  import { db } from "@intuitive-stay/db"
  import { feedback, organisations, properties, propertyScores, qrCodes } from "@intuitive-stay/db/schema"
  import { TRPCError } from "@trpc/server"
  import { and, count, eq, inArray, sql } from "drizzle-orm"
  import { z } from "zod"

  import { protectedProcedure, publicProcedure, router } from "../index"
  import { sendAlertEmail } from "../lib/email"

  /**
   * Recalculates running averages for a property after new feedback is submitted.
   * Uses incremental update: newAvg = (oldAvg * oldCount + newValue) / newCount
   * If no row exists yet, creates one with the new values.
   */
  async function updatePropertyScores(
    propertyId: string,
    scores: { resilience: number; empathy: number; consistency: number; recognition: number; gcs: number },
  ) {
    const existing = await db.query.propertyScores.findFirst({
      where: eq(propertyScores.propertyId, propertyId),
    })

    if (existing) {
      const total = existing.totalFeedback
      const newTotal = total + 1
      const prev = {
        gcs: Number(existing.avgGcs ?? 0),
        resilience: Number(existing.avgResilience ?? 0),
        empathy: Number(existing.avgEmpathy ?? 0),
        consistency: Number(existing.avgConsistency ?? 0),
        recognition: Number(existing.avgRecognition ?? 0),
      }

      await db
        .update(propertyScores)
        .set({
          avgGcs: String(((prev.gcs * total) + scores.gcs) / newTotal),
          avgResilience: String(((prev.resilience * total) + scores.resilience) / newTotal),
          avgEmpathy: String(((prev.empathy * total) + scores.empathy) / newTotal),
          avgConsistency: String(((prev.consistency * total) + scores.consistency) / newTotal),
          avgRecognition: String(((prev.recognition * total) + scores.recognition) / newTotal),
          totalFeedback: newTotal,
          updatedAt: new Date(),
        })
        .where(eq(propertyScores.propertyId, propertyId))
    } else {
      await db.insert(propertyScores).values({
        id: crypto.randomUUID(),
        propertyId,
        avgGcs: String(scores.gcs),
        avgResilience: String(scores.resilience),
        avgEmpathy: String(scores.empathy),
        avgConsistency: String(scores.consistency),
        avgRecognition: String(scores.recognition),
        totalFeedback: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }
  }

  export const feedbackRouter = router({
    /** Public — returns property name for display at the top of the feedback form. */
    getFeedbackFormData: publicProcedure
      .input(z.object({ uniqueCode: z.string() }))
      .query(async ({ input }) => {
        const qrCode = await db.query.qrCodes.findFirst({
          where: eq(qrCodes.uniqueCode, input.uniqueCode),
        })

        if (!qrCode) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Invalid feedback link" })
        }

        const property = await db.query.properties.findFirst({
          where: eq(properties.id, qrCode.propertyId),
        })

        if (!property) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })
        }

        return { propertyName: property.name }
      }),

    /**
     * Public — saves feedback, updates property scores, fires alert email if GCS ≤ 5.
     * Returns feedbackId and gcs so the client can branch to Name Drop or Vent Box.
     */
    submitFeedback: publicProcedure
      .input(
        z.object({
          uniqueCode: z.string(),
          resilience: z.number().int().min(1).max(10),
          empathy: z.number().int().min(1).max(10),
          consistency: z.number().int().min(1).max(10),
          recognition: z.number().int().min(1).max(10),
          mealTime: z.enum(["breakfast", "lunch", "dinner", "none"]).nullable().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const qrCode = await db.query.qrCodes.findFirst({
          where: eq(qrCodes.uniqueCode, input.uniqueCode),
        })

        if (!qrCode) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Invalid feedback link" })
        }

        const gcs = (input.resilience + input.empathy + input.consistency + input.recognition) / 4

        const feedbackId = crypto.randomUUID()
        await db.insert(feedback).values({
          id: feedbackId,
          propertyId: qrCode.propertyId,
          qrCodeId: qrCode.id,
          resilience: input.resilience,
          empathy: input.empathy,
          consistency: input.consistency,
          recognition: input.recognition,
          gcs: gcs.toFixed(2),
          mealTime: input.mealTime ?? null,
          source: "qr_form",
          submittedAt: new Date(),
        })

        // Update running averages — non-blocking, but awaited to keep scores fresh
        await updatePropertyScores(qrCode.propertyId, {
          resilience: input.resilience,
          empathy: input.empathy,
          consistency: input.consistency,
          recognition: input.recognition,
          gcs,
        })

        // Fire-and-forget alert email for low scores
        if (gcs <= 5) {
          const property = await db.query.properties.findFirst({
            where: eq(properties.id, qrCode.propertyId),
          })
          if (property) {
            sendAlertEmail(property.ownerEmail, property.ownerName, property.name, gcs, {
              resilience: input.resilience,
              empathy: input.empathy,
              consistency: input.consistency,
              recognition: input.recognition,
            }).catch((err) => console.error("Failed to send alert email:", err))
          }
        }

        return { feedbackId, gcs }
      }),

    /** Public — saves staff name nomination from Name Drop™ screen (GCS ≥ 8). */
    submitNameDrop: publicProcedure
      .input(z.object({ feedbackId: z.string(), staffName: z.string().min(1).max(100) }))
      .mutation(async ({ input }) => {
        await db
          .update(feedback)
          .set({ namedStaffMember: input.staffName })
          .where(eq(feedback.id, input.feedbackId))
        return { ok: true }
      }),

    /** Public — saves private vent text from Vent Box™ screen (GCS ≤ 5). */
    submitVentText: publicProcedure
      .input(z.object({ feedbackId: z.string(), text: z.string().min(1).max(2000) }))
      .mutation(async ({ input }) => {
        await db
          .update(feedback)
          .set({ ventText: input.text })
          .where(eq(feedback.id, input.feedbackId))
        return { ok: true }
      }),

    /**
     * Protected — returns count of all low-GCS feedback (GCS ≤ 5) across the
     * owner's properties. Used by the portal topbar notification badge.
     */
    getRedAlertCount: protectedProcedure.query(async ({ ctx }) => {
      const org = await db.query.organisations.findFirst({
        where: eq(organisations.ownerId, ctx.session.user.id),
      })

      if (!org) return 0

      const userProperties = await db
        .select({ id: properties.id })
        .from(properties)
        .where(eq(properties.organisationId, org.id))

      if (userProperties.length === 0) return 0

      const propertyIds = userProperties.map((p) => p.id)

      const [result] = await db
        .select({ total: count() })
        .from(feedback)
        .where(
          and(
            inArray(feedback.propertyId, propertyIds),
            sql`${feedback.gcs} <= 5`,
          ),
        )

      return result?.total ?? 0
    }),
  })
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  cd packages/api && npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 3: Commit**

  ```bash
  git add packages/api/src/routers/feedback.ts
  git commit -m "feat(api): add feedback tRPC router with submitFeedback, Name Drop, Vent Box, alert count"
  ```

---

## Task 6: Register feedback router in appRouter

**Files:**
- Modify: `packages/api/src/routers/index.ts`

- [ ] **Step 1: Read the current file**

  Read `packages/api/src/routers/index.ts`.

- [ ] **Step 2: Add feedback router import and registration**

  Replace the entire file with:

  ```typescript
  import { protectedProcedure, publicProcedure, router } from "../index"
  import { feedbackRouter } from "./feedback"
  import { propertiesRouter } from "./properties"

  export const appRouter = router({
    healthCheck: publicProcedure.query(() => {
      return "OK"
    }),
    privateData: protectedProcedure.query(({ ctx }) => {
      return {
        message: "This is private",
        user: ctx.session.user,
      }
    }),
    properties: propertiesRouter,
    feedback: feedbackRouter,
  })

  export type AppRouter = typeof appRouter
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  cd packages/api && npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 4: Commit**

  ```bash
  git add packages/api/src/routers/index.ts
  git commit -m "feat(api): register feedback router in appRouter"
  ```

---

## Task 7: Build guest feedback form

**Files:**
- Create: `apps/portal-web/src/routes/f.$uniqueCode.tsx`

This is a **public route** — no auth required, no portal sidebar. It sits at the root level like `login.tsx`. The form is mobile-first (designed for guests on a phone).

The component has four steps controlled by local state:
- `"form"` — shows the 4 pillar ratings + meal time selector + submit button
- `"name-drop"` — shown when GCS ≥ 8; optional staff name input
- `"vent-box"` — shown when GCS ≤ 5; optional private feedback text area
- `"thank-you"` — final screen after all steps are complete

- [ ] **Step 1: Create the feedback form route**

  Create `apps/portal-web/src/routes/f.$uniqueCode.tsx`:

  ```tsx
  import { cn } from "@intuitive-stay/ui/lib/utils"
  import { useMutation, useQuery } from "@tanstack/react-query"
  import { createFileRoute } from "@tanstack/react-router"
  import { useState } from "react"

  import { useTRPC, useTRPCClient } from "@/utils/trpc"

  export const Route = createFileRoute("/f/$uniqueCode")({
    component: FeedbackPage,
  })

  type Step = "form" | "name-drop" | "vent-box" | "thank-you"
  type MealTime = "breakfast" | "lunch" | "dinner" | "none"

  function RatingInput({
    label,
    description,
    value,
    onChange,
  }: {
    label: string
    description: string
    value: number
    onChange: (v: number) => void
  }) {
    return (
      <div className="space-y-2">
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex gap-1 flex-wrap">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={cn(
                "h-10 w-10 rounded-md text-sm font-medium border transition-colors",
                value === n
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:bg-muted",
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    )
  }

  function FeedbackPage() {
    const { uniqueCode } = Route.useParams()
    const trpc = useTRPC()
    const trpcClient = useTRPCClient()

    const { data, isLoading, isError } = useQuery(
      trpc.feedback.getFeedbackFormData.queryOptions({ uniqueCode }),
    )

    const [step, setStep] = useState<Step>("form")
    const [feedbackId, setFeedbackId] = useState<string | null>(null)

    // Form state
    const [resilience, setResilience] = useState(0)
    const [empathy, setEmpathy] = useState(0)
    const [consistency, setConsistency] = useState(0)
    const [recognition, setRecognition] = useState(0)
    const [mealTime, setMealTime] = useState<MealTime>("none")

    // Name Drop / Vent Box input state
    const [staffName, setStaffName] = useState("")
    const [ventText, setVentText] = useState("")

    const submitFeedback = useMutation({
      mutationFn: () =>
        trpcClient.feedback.submitFeedback.mutate({
          uniqueCode,
          resilience,
          empathy,
          consistency,
          recognition,
          mealTime,
        }),
      onSuccess: ({ feedbackId: id, gcs }) => {
        setFeedbackId(id)
        if (gcs >= 8) setStep("name-drop")
        else if (gcs <= 5) setStep("vent-box")
        else setStep("thank-you")
      },
    })

    const submitNameDrop = useMutation({
      mutationFn: () =>
        trpcClient.feedback.submitNameDrop.mutate({
          feedbackId: feedbackId!,
          staffName,
        }),
      onSuccess: () => setStep("thank-you"),
    })

    const submitVentText = useMutation({
      mutationFn: () =>
        trpcClient.feedback.submitVentText.mutate({
          feedbackId: feedbackId!,
          text: ventText,
        }),
      onSuccess: () => setStep("thank-you"),
    })

    const allRated = resilience > 0 && empathy > 0 && consistency > 0 && recognition > 0

    if (isLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-muted-foreground text-sm">Loading…</p>
        </div>
      )
    }

    if (isError) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="text-center space-y-2">
            <p className="font-semibold">Invalid feedback link</p>
            <p className="text-sm text-muted-foreground">
              This QR code is not recognised. Please ask staff for a new one.
            </p>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-md px-4 py-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              IntuItiveStay
            </p>
            <h1 className="text-xl font-bold">{data?.propertyName}</h1>
          </div>

          {/* ─── Step: Form ─── */}
          {step === "form" && (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground text-center">
                How was your experience? Rate each area 1–10.
              </p>

              <RatingInput
                label="Resilience"
                description="How well did staff handle problems or complaints?"
                value={resilience}
                onChange={setResilience}
              />
              <RatingInput
                label="Empathy"
                description="Did staff make you feel genuinely cared for?"
                value={empathy}
                onChange={setEmpathy}
              />
              <RatingInput
                label="Consistency"
                description="Was the quality of service consistent throughout?"
                value={consistency}
                onChange={setConsistency}
              />
              <RatingInput
                label="Recognition"
                description="Did staff remember your preferences or make you feel valued?"
                value={recognition}
                onChange={setRecognition}
              />

              {/* Meal time */}
              <div className="space-y-2">
                <p className="text-sm font-semibold">Meal time (optional)</p>
                <div className="flex gap-2 flex-wrap">
                  {(["breakfast", "lunch", "dinner", "none"] as MealTime[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMealTime(m)}
                      className={cn(
                        "px-4 py-2 rounded-md text-sm border capitalize transition-colors",
                        mealTime === m
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover:bg-muted",
                      )}
                    >
                      {m === "none" ? "N/A" : m}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => submitFeedback.mutate()}
                disabled={!allRated || submitFeedback.isPending}
                className={cn(
                  "w-full py-3 rounded-lg font-semibold text-sm transition-colors",
                  allRated && !submitFeedback.isPending
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground cursor-not-allowed",
                )}
              >
                {submitFeedback.isPending ? "Submitting…" : "Submit Feedback"}
              </button>

              {submitFeedback.isError && (
                <p className="text-sm text-destructive text-center">
                  Something went wrong. Please try again.
                </p>
              )}
            </div>
          )}

          {/* ─── Step: Name Drop™ ─── */}
          {step === "name-drop" && (
            <div className="space-y-6 text-center">
              <div className="space-y-2">
                <h2 className="text-lg font-bold">Who made your stay exceptional?</h2>
                <p className="text-sm text-muted-foreground">
                  If a team member went above and beyond, let us know their name so we can
                  recognise them.
                </p>
              </div>
              <input
                type="text"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder="Staff member's name (optional)"
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                maxLength={100}
              />
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => submitNameDrop.mutate()}
                  disabled={!staffName.trim() || submitNameDrop.isPending}
                  className={cn(
                    "w-full py-3 rounded-lg font-semibold text-sm transition-colors",
                    staffName.trim() && !submitNameDrop.isPending
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-muted text-muted-foreground cursor-not-allowed",
                  )}
                >
                  {submitNameDrop.isPending ? "Sending…" : "Send Recognition"}
                </button>
                <button
                  type="button"
                  onClick={() => setStep("thank-you")}
                  className="w-full py-3 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Skip
                </button>
              </div>
            </div>
          )}

          {/* ─── Step: Vent Box™ ─── */}
          {step === "vent-box" && (
            <div className="space-y-6 text-center">
              <div className="space-y-2">
                <h2 className="text-lg font-bold">We're sorry to hear that.</h2>
                <p className="text-sm text-muted-foreground">
                  Would you like to share more privately? Your message goes directly to the
                  property owner — not a public review.
                </p>
              </div>
              <textarea
                value={ventText}
                onChange={(e) => setVentText(e.target.value)}
                placeholder="Tell us what went wrong (optional)"
                rows={4}
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
                maxLength={2000}
              />
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => submitVentText.mutate()}
                  disabled={!ventText.trim() || submitVentText.isPending}
                  className={cn(
                    "w-full py-3 rounded-lg font-semibold text-sm transition-colors",
                    ventText.trim() && !submitVentText.isPending
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-muted text-muted-foreground cursor-not-allowed",
                  )}
                >
                  {submitVentText.isPending ? "Sending…" : "Send Privately"}
                </button>
                <button
                  type="button"
                  onClick={() => setStep("thank-you")}
                  className="w-full py-3 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Skip
                </button>
              </div>
            </div>
          )}

          {/* ─── Step: Thank You ─── */}
          {step === "thank-you" && (
            <div className="text-center space-y-4 py-8">
              <div className="text-5xl">🙏</div>
              <h2 className="text-xl font-bold">Thank you for your feedback!</h2>
              <p className="text-sm text-muted-foreground">
                Your response has been recorded. It helps us improve the experience for every
                guest.
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  cd apps/portal-web && npx tsc --noEmit
  ```

  Expected: No errors (or only pre-existing errors unrelated to this file).

- [ ] **Step 3: Commit**

  ```bash
  git add apps/portal-web/src/routes/f.\$uniqueCode.tsx
  git commit -m "feat(web): add public guest feedback form at /f/:uniqueCode"
  ```

---

## Task 8: Wire TopbarNotifications to real red alert count

**Files:**
- Modify: `apps/portal-web/src/components/topbar-notifications.tsx`

Replace the hardcoded mock data with a real query. The badge will show the count of low-GCS feedback across the owner's properties. The notification popover list will be simplified for now — Phase 4 will add real per-alert items.

- [ ] **Step 1: Read the current file**

  Read `apps/portal-web/src/components/topbar-notifications.tsx` fully.

- [ ] **Step 2: Replace the file with the real-data version**

  Replace the entire file with:

  ```tsx
  import { Button } from "@intuitive-stay/ui/components/button"
  import {
    Popover,
    PopoverContent,
    PopoverDescription,
    PopoverHeader,
    PopoverTitle,
    PopoverTrigger,
  } from "@intuitive-stay/ui/components/popover"
  import { useQuery } from "@tanstack/react-query"
  import { BellIcon } from "lucide-react"

  import { useTRPC } from "@/utils/trpc"

  export function TopbarNotifications() {
    const trpc = useTRPC()
    const { data: alertCount = 0 } = useQuery(
      trpc.feedback.getRedAlertCount.queryOptions(),
    )

    return (
      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="relative"
              aria-label="View notifications"
            />
          }
        >
          <BellIcon />
          {alertCount > 0 ? (
            <span className="pointer-events-none absolute -top-1 -right-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {alertCount}
            </span>
          ) : null}
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={10} className="w-80">
          <PopoverHeader>
            <PopoverTitle>Alerts</PopoverTitle>
            <PopoverDescription>
              {alertCount > 0
                ? `${alertCount} low-score ${alertCount === 1 ? "alert" : "alerts"} across your properties`
                : "No low-score alerts"}
            </PopoverDescription>
          </PopoverHeader>
          {alertCount > 0 ? (
            <div className="px-3 py-2">
              <p className="text-sm text-muted-foreground">
                {alertCount} guest {alertCount === 1 ? "submission" : "submissions"} scored 5 or
                below. Visit the Alerts page for each property to review details.
              </p>
            </div>
          ) : (
            <div className="px-3 py-2">
              <p className="text-sm text-muted-foreground">All scores are looking good.</p>
            </div>
          )}
        </PopoverContent>
      </Popover>
    )
  }
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  cd apps/portal-web && npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/portal-web/src/components/topbar-notifications.tsx
  git commit -m "feat(web): wire topbar notification badge to real red alert count"
  ```

---

## Phase 3 Complete ✓

At this point you have:
- ✅ QR code generated on property approval, saved to `qr_codes` table, emailed as branded PDF
- ✅ Public guest feedback form at `/f/$uniqueCode` (mobile-first, no login required)
- ✅ GCS calculated on submission, branching to Name Drop™ (≥8) or Vent Box™ (≤5)
- ✅ Property scores updated incrementally in `property_scores` on every submission
- ✅ Red alert email sent to property owner when GCS ≤ 5
- ✅ Portal topbar badge shows real count of low-score alerts

**To test end-to-end locally:**
1. Start the full dev stack: `pnpm dev` (from repo root)
2. Log in as admin (`benjamin@intuitivestay.com`)
3. Use the Wix bridge curl command from Phase 2 to register a test property
4. Go to `/admin/approvals`, approve the property
5. Check the API server logs — you should see the QR code being generated
6. Check Supabase dashboard — `qr_codes` table should have a new row
7. Copy the `feedbackUrl` from the `qr_codes` row, open it in a browser
8. Fill in the feedback form, submit
9. Submit with a score of 5 or below on all pillars to trigger the Vent Box™ and red alert email
10. Back in the portal, the bell icon should show a badge with the alert count
