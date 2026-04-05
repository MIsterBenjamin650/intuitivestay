# Phase 2 — Wix Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Accept property registrations from a Wix form, display them in an admin approvals page, let the admin approve or reject each one, and send confirmation emails to the property owner on both outcomes.

**Architecture:** A plain HTTP POST endpoint (`POST /api/properties/register`, protected by `x-wixbridge-secret` header) accepts Wix form submissions and seeds the database with an organisation, property, and portal user account. A tRPC `properties` router with an `adminProcedure` middleware exposes procedures for listing and actioning pending properties. An Admin Approvals page in portal-web wires up the UI. Approval and rejection emails are sent via Resend.

**Tech Stack:** Hono.js, tRPC, Drizzle ORM, Resend, TanStack Start, React

---

## File Map

**Create:**
- `packages/api/src/lib/email.ts` — Resend email helpers (approval + rejection)
- `packages/api/src/lib/register-property.ts` — registerPropertyFromWix service function
- `packages/api/src/routers/properties.ts` — properties tRPC router
- `apps/portal-web/src/routes/_portal.admin.approvals.tsx` — admin approvals page

**Modify:**
- `packages/env/src/server.ts` — add WIXBRIDGE_SECRET, RESEND_API_KEY, ADMIN_EMAIL, PUBLIC_PORTAL_URL
- `apps/portal-server/.env` — add placeholder values for new vars
- `packages/api/src/index.ts` — add adminProcedure export
- `packages/api/src/routers/index.ts` — register properties router in appRouter
- `apps/portal-server/src/index.ts` — add Wix bridge HTTP endpoint
- `apps/portal-web/src/components/app-sidebar.tsx` — add admin nav item

---

## Task 1: Add new environment variables

**Files:**
- Modify: `packages/env/src/server.ts`
- Modify: `apps/portal-server/.env`

- [ ] **Step 1: Update server env schema**

  Read `packages/env/src/server.ts`. Add four variables to the `server` block, after `NODE_ENV`:

  ```typescript
  WIXBRIDGE_SECRET: z.string().min(16),
  RESEND_API_KEY: z.string().min(1),
  ADMIN_EMAIL: z.string().email(),
  PUBLIC_PORTAL_URL: z.string().url(),
  ```

  The full updated `server` block:
  ```typescript
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    WIXBRIDGE_SECRET: z.string().min(16),
    RESEND_API_KEY: z.string().min(1),
    ADMIN_EMAIL: z.string().email(),
    PUBLIC_PORTAL_URL: z.string().url(),
  },
  ```

- [ ] **Step 2: Add placeholder values to .env**

  Read `apps/portal-server/.env`. Append these four lines:
  ```
  WIXBRIDGE_SECRET=change-me-to-a-secret-at-least-16-chars
  RESEND_API_KEY=re_placeholder_get_from_resend_com
  ADMIN_EMAIL=admin@intuitivestay.com
  PUBLIC_PORTAL_URL=http://localhost:5173
  ```

- [ ] **Step 3: Verify env types load without error**

  ```bash
  cd packages/env && npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 4: Commit**

  ```bash
  git add packages/env/src/server.ts apps/portal-server/.env
  git commit -m "feat: add WIXBRIDGE_SECRET, RESEND_API_KEY, ADMIN_EMAIL, PUBLIC_PORTAL_URL env vars"
  ```

---

## Task 2: Install Resend SDK

**Files:**
- Modify: `packages/api/package.json` (pnpm manages this)

- [ ] **Step 1: Install resend in the API package**

  From the repo root:
  ```bash
  pnpm add resend --filter @intuitive-stay/api
  ```

- [ ] **Step 2: Verify it was added**

  ```bash
  grep resend packages/api/package.json
  ```

  Expected: `"resend": "..."` appears in dependencies.

- [ ] **Step 3: Commit**

  ```bash
  git add packages/api/package.json pnpm-lock.yaml
  git commit -m "feat(api): install resend sdk"
  ```

---

## Task 3: Build email helpers

**Files:**
- Create: `packages/api/src/lib/email.ts`

- [ ] **Step 1: Create the email helpers file**

  Create `packages/api/src/lib/email.ts`:

  ```typescript
  import { env } from "@intuitive-stay/env/server"
  import { Resend } from "resend"

  const resend = new Resend(env.RESEND_API_KEY)

  const FROM = "IntuItiveStay <onboarding@intuitivestay.com>"

  export async function sendApprovalEmail(
    ownerEmail: string,
    ownerName: string,
    propertyName: string,
  ) {
    await resend.emails.send({
      from: FROM,
      to: ownerEmail,
      subject: `Your property "${propertyName}" has been approved`,
      html: `<h1>Welcome to IntuItiveStay, ${ownerName}!</h1>
  <p>Your property <strong>${propertyName}</strong> has been approved and is now live.</p>
  <p>Log in to your portal to view your dashboard and download your QR code:</p>
  <p><a href="${env.PUBLIC_PORTAL_URL}">${env.PUBLIC_PORTAL_URL}</a></p>
  <p>If you haven't set a password yet, use the "Forgot password" option on the login page.</p>`,
    })
  }

  export async function sendRejectionEmail(
    ownerEmail: string,
    ownerName: string,
    propertyName: string,
  ) {
    await resend.emails.send({
      from: FROM,
      to: ownerEmail,
      subject: "Update on your IntuItiveStay application",
      html: `<h1>Hi ${ownerName},</h1>
  <p>Thank you for submitting <strong>${propertyName}</strong> to IntuItiveStay.</p>
  <p>We need a little more information before we can approve your property. Please reply to this email with any additional details and we'll be in touch shortly.</p>`,
    })
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  cd packages/api && npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 3: Commit**

  ```bash
  git add packages/api/src/lib/email.ts
  git commit -m "feat(api): add approval and rejection email helpers via Resend"
  ```

---

## Task 4: Build registerProperty service function

**Files:**
- Create: `packages/api/src/lib/register-property.ts`

This function is called by the Wix bridge HTTP endpoint. It inserts a portal user account (if one doesn't already exist for that email), an organisation, and a pending property into the database. The owner uses the "Forgot password" flow on their first portal login — no password is set here.

- [ ] **Step 1: Create the service function**

  Create `packages/api/src/lib/register-property.ts`:

  ```typescript
  import { db } from "@intuitive-stay/db"
  import { organisations, properties, user } from "@intuitive-stay/db/schema"
  import { eq } from "drizzle-orm"

  export type RegisterPropertyInput = {
    ownerName: string
    ownerEmail: string
    propertyName: string
    propertyAddress?: string
    propertyCity: string
    propertyCountry: string
    propertyType?: string
  }

  export async function registerPropertyFromWix(input: RegisterPropertyInput) {
    // 1. Find or create the portal user account
    const existingUser = await db.query.user.findFirst({
      where: eq(user.email, input.ownerEmail),
    })

    const userId = existingUser?.id ?? crypto.randomUUID()

    if (!existingUser) {
      await db.insert(user).values({
        id: userId,
        name: input.ownerName,
        email: input.ownerEmail,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }

    // 2. Create an organisation for this owner
    const baseSlug = input.ownerName
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
    // Append random suffix to guarantee uniqueness
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`
    const orgId = crypto.randomUUID()

    await db.insert(organisations).values({
      id: orgId,
      name: `${input.ownerName}'s Organisation`,
      slug,
      plan: "host",
      ownerId: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // 3. Create the property (status: pending — awaiting admin approval)
    const propertyId = crypto.randomUUID()
    const [property] = await db
      .insert(properties)
      .values({
        id: propertyId,
        organisationId: orgId,
        name: input.propertyName,
        address: input.propertyAddress ?? null,
        city: input.propertyCity,
        country: input.propertyCountry,
        type: input.propertyType ?? null,
        status: "pending",
        ownerEmail: input.ownerEmail,
        ownerName: input.ownerName,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    return property
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  cd packages/api && npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 3: Commit**

  ```bash
  git add packages/api/src/lib/register-property.ts
  git commit -m "feat(api): add registerPropertyFromWix service function"
  ```

---

## Task 5: Add adminProcedure and build properties tRPC router

**Files:**
- Modify: `packages/api/src/index.ts`
- Create: `packages/api/src/routers/properties.ts`

- [ ] **Step 1: Add adminProcedure to packages/api/src/index.ts**

  Read `packages/api/src/index.ts`. Add this import at the top of the file (after existing imports):

  ```typescript
  import { env } from "@intuitive-stay/env/server"
  ```

  Then add the `adminProcedure` export after the existing `protectedProcedure` export:

  ```typescript
  export const adminProcedure = t.procedure.use(({ ctx, next }) => {
    if (!ctx.session) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required",
      })
    }
    if (ctx.session.user.email !== env.ADMIN_EMAIL) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Admin access required",
      })
    }
    return next({
      ctx: {
        ...ctx,
        session: ctx.session,
      },
    })
  })
  ```

- [ ] **Step 2: Create packages/api/src/routers/properties.ts**

  ```typescript
  import { db } from "@intuitive-stay/db"
  import { organisations, properties } from "@intuitive-stay/db/schema"
  import { TRPCError } from "@trpc/server"
  import { eq } from "drizzle-orm"
  import { z } from "zod"

  import { adminProcedure, protectedProcedure, router } from "../index"
  import { sendApprovalEmail, sendRejectionEmail } from "../lib/email"

  export const propertiesRouter = router({
    getPendingProperties: adminProcedure.query(async () => {
      return db
        .select()
        .from(properties)
        .where(eq(properties.status, "pending"))
        .orderBy(properties.createdAt)
    }),

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

        // Fire-and-forget: email failure must not block the approval action
        sendApprovalEmail(property.ownerEmail, property.ownerName, property.name).catch(
          (err) => console.error("Failed to send approval email:", err),
        )

        return property
      }),

    rejectProperty: adminProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        const [property] = await db
          .update(properties)
          .set({ status: "rejected", updatedAt: new Date() })
          .where(eq(properties.id, input.id))
          .returning()

        if (!property) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })
        }

        // Fire-and-forget: email failure must not block the rejection action
        sendRejectionEmail(property.ownerEmail, property.ownerName, property.name).catch(
          (err) => console.error("Failed to send rejection email:", err),
        )

        return property
      }),

    getMyProperties: protectedProcedure.query(async ({ ctx }) => {
      const org = await db.query.organisations.findFirst({
        where: eq(organisations.ownerId, ctx.session.user.id),
      })

      if (!org) {
        return []
      }

      return db
        .select()
        .from(properties)
        .where(eq(properties.organisationId, org.id))
    }),
  })
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  cd packages/api && npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 4: Commit**

  ```bash
  git add packages/api/src/index.ts packages/api/src/routers/properties.ts
  git commit -m "feat(api): add adminProcedure and properties tRPC router"
  ```

---

## Task 6: Register properties router in appRouter

**Files:**
- Modify: `packages/api/src/routers/index.ts`

- [ ] **Step 1: Add properties router to appRouter**

  Read `packages/api/src/routers/index.ts`. Replace the entire file with:

  ```typescript
  import { protectedProcedure, publicProcedure, router } from "../index"
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
  })

  export type AppRouter = typeof appRouter
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  cd packages/api && npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 3: Commit**

  ```bash
  git add packages/api/src/routers/index.ts
  git commit -m "feat(api): register properties router in appRouter"
  ```

---

## Task 7: Build Wix bridge HTTP endpoint

**Files:**
- Modify: `apps/portal-server/src/index.ts`

The Wix bridge is a plain HTTP POST endpoint (not tRPC) so that the Wix form can call it with a simple `fetch`. It validates the `x-wixbridge-secret` header, then calls `registerPropertyFromWix`.

- [ ] **Step 1: Read apps/portal-server/src/index.ts**

  Read the full file before making changes.

- [ ] **Step 2: Add import for registerPropertyFromWix**

  At the top of `apps/portal-server/src/index.ts`, after the existing imports, add:

  ```typescript
  import { registerPropertyFromWix } from "@intuitive-stay/api/lib/register-property"
  ```

- [ ] **Step 3: Add the Wix bridge endpoint**

  In the same file, add the following endpoint **before** the existing `app.get("/", ...)` handler:

  ```typescript
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

    return c.json({ success: true, propertyId: property.id }, 201)
  })
  ```

- [ ] **Step 4: Verify TypeScript compiles**

  ```bash
  cd apps/portal-server && npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 5: Test the endpoint manually**

  Start the API server:
  ```bash
  cd apps/portal-server && pnpm dev
  ```

  In a second terminal, send a test registration:
  ```bash
  curl -X POST http://localhost:5174/api/properties/register \
    -H "Content-Type: application/json" \
    -H "x-wixbridge-secret: change-me-to-a-secret-at-least-16-chars" \
    -d '{"ownerName":"Test Owner","ownerEmail":"test@example.com","propertyName":"Test Hotel","propertyCity":"London","propertyCountry":"United Kingdom"}'
  ```

  Expected: `{"success":true,"propertyId":"<uuid>"}` with HTTP 201.

  Check that the secret guard works:
  ```bash
  curl -X POST http://localhost:5174/api/properties/register \
    -H "Content-Type: application/json" \
    -d '{"ownerName":"Test Owner","ownerEmail":"test@example.com","propertyName":"Test Hotel","propertyCity":"London","propertyCountry":"United Kingdom"}'
  ```

  Expected: `{"error":"Unauthorized"}` with HTTP 401.

  Stop the server with Ctrl+C.

  Open the Supabase dashboard and confirm a row appeared in the `properties` table with `status = 'pending'`. Also confirm a row appeared in `organisations` and in `user` (for test@example.com).

- [ ] **Step 6: Commit**

  ```bash
  git add apps/portal-server/src/index.ts
  git commit -m "feat(server): add POST /api/properties/register Wix bridge endpoint"
  ```

---

## Task 8: Build Admin Approvals page and sidebar nav

**Files:**
- Create: `apps/portal-web/src/routes/_portal.admin.approvals.tsx`
- Modify: `apps/portal-web/src/components/app-sidebar.tsx`

The admin approvals page lists all pending properties with Approve and Reject buttons. Access control is enforced server-side by `adminProcedure` — non-admin users will see an error message. The sidebar shows an Admin nav item for all users (Phase 5 can add role-based visibility).

- [ ] **Step 1: Read the sidebar component**

  Read `apps/portal-web/src/components/app-sidebar.tsx` fully. Understand the data structure for nav groups before making changes.

- [ ] **Step 2: Add admin nav item to sidebar**

  In `apps/portal-web/src/components/app-sidebar.tsx`:

  Add this import at the top (with the other lucide-react icon imports):
  ```tsx
  import { ShieldCheckIcon } from "lucide-react"
  ```

  Find where the nav group items array is defined (look for the array of objects with `title`, `url`, `icon`, `items` properties). Add an admin group following the exact same shape as the existing nav groups:

  ```tsx
  {
    title: "Admin",
    url: "/admin/approvals",
    icon: ShieldCheckIcon,
    items: [
      {
        title: "Approvals",
        url: "/admin/approvals",
      },
    ],
  },
  ```

  Adapt the shape to exactly match how existing nav groups are structured in the file.

- [ ] **Step 3: Create the Admin Approvals page**

  Create `apps/portal-web/src/routes/_portal.admin.approvals.tsx`:

  ```tsx
  import { Button } from "@intuitive-stay/ui/components/button"
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "@intuitive-stay/ui/components/card"
  import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
  import { createFileRoute } from "@tanstack/react-router"
  import { toast } from "sonner"

  import { useTRPC, useTRPCClient } from "@/utils/trpc"

  export const Route = createFileRoute("/_portal/admin/approvals")({
    component: ApprovalsPage,
  })

  function ApprovalsPage() {
    const trpc = useTRPC()
    const trpcClient = useTRPCClient()
    const queryClient = useQueryClient()

    const {
      data: pendingProperties,
      isLoading,
      isError,
      error,
    } = useQuery(trpc.properties.getPendingProperties.queryOptions())

    const approveMutation = useMutation({
      mutationFn: (id: string) =>
        trpcClient.properties.approveProperty.mutate({ id }),
      onSuccess: (property) => {
        queryClient.invalidateQueries(trpc.properties.getPendingProperties.queryFilter())
        toast.success(`"${property.name}" approved`)
      },
      onError: () => toast.error("Failed to approve property"),
    })

    const rejectMutation = useMutation({
      mutationFn: (id: string) =>
        trpcClient.properties.rejectProperty.mutate({ id }),
      onSuccess: (property) => {
        queryClient.invalidateQueries(trpc.properties.getPendingProperties.queryFilter())
        toast.success(`"${property.name}" rejected`)
      },
      onError: () => toast.error("Failed to reject property"),
    })

    if (isError) {
      return (
        <div className="p-6">
          <p className="text-destructive">
            {(error as { message?: string })?.message ?? "Access denied or error loading data"}
          </p>
        </div>
      )
    }

    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Pending Approvals</h1>
          <p className="text-muted-foreground">
            Review and approve or reject property registrations
          </p>
        </div>

        {isLoading && <p className="text-muted-foreground">Loading...</p>}

        {!isLoading && pendingProperties?.length === 0 && (
          <p className="text-muted-foreground">No pending properties.</p>
        )}

        <div className="space-y-4">
          {pendingProperties?.map((property) => (
            <Card key={property.id}>
              <CardHeader>
                <CardTitle>{property.name}</CardTitle>
                <CardDescription>
                  {property.ownerName} · {property.ownerEmail}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {[property.city, property.country, property.address, property.type]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="text-xs text-muted-foreground">
                  Submitted: {new Date(property.createdAt).toLocaleDateString()}
                </p>
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={() => approveMutation.mutate(property.id)}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => rejectMutation.mutate(property.id)}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                  >
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 4: Verify TypeScript compiles**

  ```bash
  cd apps/portal-web && npx tsc --noEmit
  ```

  Expected: No errors (or only pre-existing errors unrelated to these files).

- [ ] **Step 5: Run the full dev stack and visually verify**

  From the repo root:
  ```bash
  pnpm dev
  ```

  1. Open http://localhost:5173, log in.
  2. Confirm "Admin > Approvals" appears in the sidebar.
  3. Navigate to `/admin/approvals`.
  4. If logged in as the ADMIN_EMAIL account: the page should show pending properties (or "No pending properties." if DB is empty). Add one with the curl from Task 7 Step 5, then refresh.
  5. If logged in as a different account: the page should show the error message (FORBIDDEN from tRPC).
  6. Click "Approve" on a pending property. Confirm the card disappears and a success toast appears. Check Supabase to confirm `status` changed to `approved`.
  7. Add another pending property with curl, then click "Reject". Confirm the card disappears and status changed to `rejected` in Supabase.

  Stop with Ctrl+C.

- [ ] **Step 6: Commit**

  ```bash
  git add \
    apps/portal-web/src/routes/_portal.admin.approvals.tsx \
    apps/portal-web/src/components/app-sidebar.tsx
  git commit -m "feat(web): add admin approvals page and sidebar nav"
  ```

---

## Phase 2 Complete ✓

At this point you have:
- ✅ Wix bridge endpoint (`POST /api/properties/register`) accepting property registrations
- ✅ Admin approvals page listing all pending properties with Approve and Reject buttons
- ✅ Approval and rejection emails sent to the property owner via Resend
- ✅ `getMyProperties` tRPC procedure ready for Phase 4 dashboard wiring

**To connect the live Wix registration form (done outside this codebase):**
1. In Wix, create a form with fields: `ownerName`, `ownerEmail`, `propertyName`, `propertyAddress`, `propertyCity`, `propertyCountry`, `propertyType`
2. On form submit, use Wix Velo to POST to `https://your-portal-domain/api/properties/register` with header `x-wixbridge-secret: [your WIXBRIDGE_SECRET value]`
3. Set the real `WIXBRIDGE_SECRET`, `RESEND_API_KEY`, `ADMIN_EMAIL`, and `PUBLIC_PORTAL_URL` values in your production environment
