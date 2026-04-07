# Staff Invitation System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow property owners to invite staff via email; staff get read-only access to a permission-gated property dashboard, managed from a Team page.

**Architecture:** New `propertyMembers` DB table → `team` tRPC router (owner-only mutations) + `invite` tRPC router (public token validation + protected accept) → `/invite` acceptance page (outside `_portal` layout) → `getUser()` extended to detect staff → `_portal.tsx` updated for staff routing → `app-sidebar.tsx` extended for staff sidebar → new `/team` page route.

**Tech Stack:** React, TanStack Router, Tailwind CSS v4, shadcn/ui, TypeScript, Drizzle ORM, Better Auth, Resend, tRPC

---

## File Map

| File | Change |
|---|---|
| `packages/db/src/schema/property-members.ts` | Create `propertyMembers` table |
| `packages/db/src/schema/index.ts` | Export `propertyMembers` |
| `packages/api/src/lib/email.ts` | Add `sendStaffInviteEmail()` |
| `packages/api/src/routers/team.ts` | Create `teamRouter` (invite, list, update, remove, resend) |
| `packages/api/src/routers/invite.ts` | Create `inviteRouter` (getDetails, accept) |
| `packages/api/src/routers/index.ts` | Add `team` and `invite` to `appRouter` |
| `apps/portal-web/src/functions/get-user.ts` | Detect staff membership, return `isStaff` + `staffPermissions` |
| `apps/portal-web/src/routes/_portal.tsx` | Skip subscription check for staff; pass `isStaff` to sidebar |
| `apps/portal-web/src/components/app-sidebar.tsx` | Add staff sidebar branch |
| `apps/portal-web/src/routes/invite.tsx` | New invite acceptance page |
| `apps/portal-web/src/routes/_portal.properties.$propertyId.team.tsx` | New Team management page |
| `apps/portal-web/src/components/app-sidebar.tsx` | Add Team link to owner sidebar |

---

### Task 1: DB schema — `propertyMembers` table

**Context:** The schema lives in `packages/db/src/schema/`. The `user.id` column is `text` (not uuid), so `propertyMembers.userId` must also be `text`. Push schema changes with `drizzle-kit push` (not `migrate`) from the repo root. Existing tables: `auth.ts`, `feedback.ts`, `organisations.ts`, `properties.ts`, `property-scores.ts`, `property-tiers.ts`, `qr-codes.ts`, `ai-daily-summaries.ts`.

**Files:**
- Create: `packages/db/src/schema/property-members.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Create the schema file**

Create `packages/db/src/schema/property-members.ts`:

```ts
import { pgTable, text, timestamp, jsonb, unique } from "drizzle-orm/pg-core"
import { properties } from "./properties"
import { user } from "./auth"

export const propertyMembers = pgTable(
  "property_members",
  {
    id: text("id").primaryKey(),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    invitedEmail: text("invited_email").notNull(),
    displayName: text("display_name"),
    role: text("role").notNull().default("staff"),
    permissions: jsonb("permissions").notNull().default({
      viewFeedback: true,
      viewAnalytics: true,
      viewAiSummary: false,
      viewWordCloud: true,
      viewStaffCloud: false,
      viewAlerts: false,
    }),
    status: text("status").notNull().default("pending"),
    inviteToken: text("invite_token").notNull().unique(),
    inviteExpiresAt: timestamp("invite_expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    acceptedAt: timestamp("accepted_at"),
  },
)
```

- [ ] **Step 2: Export from schema index**

In `packages/db/src/schema/index.ts`, add:

```ts
export * from "./property-members"
```

(Add this line alongside the existing exports.)

- [ ] **Step 3: Push schema to DB**

```bash
cd C:/Users/miste/intuitivestay/intuitivestay && pnpm --filter @intuitive-stay/db exec drizzle-kit push 2>&1 | tail -20
```

Expected: `property_members` table created with no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema/property-members.ts packages/db/src/schema/index.ts
git commit -m "feat: add propertyMembers schema for staff invitations"
```

---

### Task 2: Email helper — `sendStaffInviteEmail`

**Context:** `packages/api/src/lib/email.ts` has a `Resend` client, `FROM` constant, and several `send*Email` functions. `env.PUBLIC_PORTAL_URL` is available from `@intuitive-stay/env/server`.

**Files:**
- Modify: `packages/api/src/lib/email.ts`

- [ ] **Step 1: Add `sendStaffInviteEmail` at the bottom of the file**

```ts
export async function sendStaffInviteEmail(
  invitedEmail: string,
  propertyName: string,
  inviterName: string,
  token: string,
) {
  const inviteUrl = `${env.PUBLIC_PORTAL_URL}/invite?token=${token}`

  await resend.emails.send({
    from: FROM,
    to: invitedEmail,
    subject: `${propertyName} — You've been invited to view the dashboard`,
    html: `<h1>You've been invited!</h1>
<p><strong>${inviterName}</strong> has invited you to access the guest feedback dashboard for <strong>${propertyName}</strong>.</p>
<p>Click the button below to accept your invitation and set up your account:</p>
<p><a href="${inviteUrl}" style="display:inline-block;background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Accept Invitation →</a></p>
<p style="font-size:12px;color:#64748b">This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.</p>`,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/lib/email.ts
git commit -m "feat: add sendStaffInviteEmail helper"
```

---

### Task 3: tRPC team router

**Context:** The tRPC routers live in `packages/api/src/routers/`. The `protectedProcedure` and `publicProcedure` are exported from `packages/api/src/index.ts`. The `db` import is `@intuitive-stay/db`. Schema tables: `propertyMembers` (just created), `properties`, `organisations`. To verify ownership: join `properties` to `organisations` where `organisations.ownerId = ctx.session.user.id`. Use `crypto.randomUUID()` for IDs and tokens.

**Files:**
- Create: `packages/api/src/routers/team.ts`

- [ ] **Step 1: Create the team router**

Create `packages/api/src/routers/team.ts`:

```ts
import { db } from "@intuitive-stay/db"
import { organisations, properties, propertyMembers } from "@intuitive-stay/db/schema"
import { TRPCError } from "@trpc/server"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

import { protectedProcedure, router } from "../index"
import { sendStaffInviteEmail } from "../lib/email"

const permissionsSchema = z.object({
  viewFeedback: z.boolean(),
  viewAnalytics: z.boolean(),
  viewAiSummary: z.boolean(),
  viewWordCloud: z.boolean(),
  viewStaffCloud: z.boolean(),
  viewAlerts: z.boolean(),
})

async function assertOwner(userId: string, propertyId: string) {
  const row = await db
    .select({ orgId: organisations.id })
    .from(organisations)
    .innerJoin(properties, eq(properties.organisationId, organisations.id))
    .where(and(eq(organisations.ownerId, userId), eq(properties.id, propertyId)))
    .limit(1)

  if (!row.length) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not authorised for this property" })
  }
}

export const teamRouter = router({
  inviteStaff: protectedProcedure
    .input(
      z.object({
        propertyId: z.string(),
        email: z.string().email(),
        displayName: z.string().optional(),
        permissions: permissionsSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertOwner(ctx.session.user.id, input.propertyId)

      // Check for existing pending invite or active member with this email
      const existing = await db
        .select({ id: propertyMembers.id, status: propertyMembers.status })
        .from(propertyMembers)
        .where(
          and(
            eq(propertyMembers.propertyId, input.propertyId),
            eq(propertyMembers.invitedEmail, input.email),
          ),
        )
        .limit(1)

      if (existing.length && existing[0]?.status === "active") {
        throw new TRPCError({ code: "CONFLICT", message: "This email is already an active member" })
      }
      if (existing.length && existing[0]?.status === "pending") {
        throw new TRPCError({ code: "CONFLICT", message: "An invitation is already pending for this email" })
      }

      const prop = await db
        .select({ name: properties.name, ownerName: properties.ownerName })
        .from(properties)
        .where(eq(properties.id, input.propertyId))
        .limit(1)

      if (!prop.length || !prop[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })
      }

      const token = crypto.randomUUID()
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      const [member] = await db
        .insert(propertyMembers)
        .values({
          id: crypto.randomUUID(),
          propertyId: input.propertyId,
          invitedEmail: input.email,
          displayName: input.displayName ?? null,
          permissions: input.permissions,
          inviteToken: token,
          inviteExpiresAt: expiresAt,
        })
        .returning()

      await sendStaffInviteEmail(
        input.email,
        prop[0].name,
        prop[0].ownerName,
        token,
      )

      return member
    }),

  listMembers: protectedProcedure
    .input(z.object({ propertyId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertOwner(ctx.session.user.id, input.propertyId)

      return db
        .select()
        .from(propertyMembers)
        .where(eq(propertyMembers.propertyId, input.propertyId))
        .orderBy(propertyMembers.createdAt)
    }),

  updatePermissions: protectedProcedure
    .input(z.object({ memberId: z.string(), permissions: permissionsSchema }))
    .mutation(async ({ ctx, input }) => {
      const member = await db
        .select({ propertyId: propertyMembers.propertyId })
        .from(propertyMembers)
        .where(eq(propertyMembers.id, input.memberId))
        .limit(1)

      if (!member.length || !member[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" })
      }

      await assertOwner(ctx.session.user.id, member[0].propertyId)

      const [updated] = await db
        .update(propertyMembers)
        .set({ permissions: input.permissions })
        .where(eq(propertyMembers.id, input.memberId))
        .returning()

      return updated
    }),

  removeMember: protectedProcedure
    .input(z.object({ memberId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const member = await db
        .select({ propertyId: propertyMembers.propertyId })
        .from(propertyMembers)
        .where(eq(propertyMembers.id, input.memberId))
        .limit(1)

      if (!member.length || !member[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" })
      }

      await assertOwner(ctx.session.user.id, member[0].propertyId)

      await db.delete(propertyMembers).where(eq(propertyMembers.id, input.memberId))

      return { success: true }
    }),

  resendInvite: protectedProcedure
    .input(z.object({ memberId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const member = await db
        .select()
        .from(propertyMembers)
        .where(eq(propertyMembers.id, input.memberId))
        .limit(1)

      if (!member.length || !member[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" })
      }

      await assertOwner(ctx.session.user.id, member[0].propertyId)

      if (member[0].status === "active") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Member has already accepted" })
      }

      const prop = await db
        .select({ name: properties.name, ownerName: properties.ownerName })
        .from(properties)
        .where(eq(properties.id, member[0].propertyId))
        .limit(1)

      if (!prop.length || !prop[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })
      }

      const newToken = crypto.randomUUID()
      const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      const [updated] = await db
        .update(propertyMembers)
        .set({ inviteToken: newToken, inviteExpiresAt: newExpiry })
        .where(eq(propertyMembers.id, input.memberId))
        .returning()

      await sendStaffInviteEmail(
        member[0].invitedEmail,
        prop[0].name,
        prop[0].ownerName,
        newToken,
      )

      return updated
    }),
})
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/routers/team.ts
git commit -m "feat: add teamRouter for staff invitation management"
```

---

### Task 4: tRPC invite router

**Context:** The `invite.accept` procedure is protected — the staff user must be signed in before calling it. The frontend flow is: user signs up via `authClient.signUp.email()`, then calls `invite.accept({ token })`. The procedure verifies the session user's email matches `invitedEmail`, sets `status = "active"`, `userId = ctx.session.user.id`, `acceptedAt = now()`.

**Files:**
- Create: `packages/api/src/routers/invite.ts`

- [ ] **Step 1: Create the invite router**

Create `packages/api/src/routers/invite.ts`:

```ts
import { db } from "@intuitive-stay/db"
import { properties, propertyMembers } from "@intuitive-stay/db/schema"
import { TRPCError } from "@trpc/server"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

import { protectedProcedure, publicProcedure, router } from "../index"

export const inviteRouter = router({
  getDetails: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const member = await db
        .select({
          id: propertyMembers.id,
          invitedEmail: propertyMembers.invitedEmail,
          status: propertyMembers.status,
          inviteExpiresAt: propertyMembers.inviteExpiresAt,
          propertyId: propertyMembers.propertyId,
        })
        .from(propertyMembers)
        .where(eq(propertyMembers.inviteToken, input.token))
        .limit(1)

      if (!member.length || !member[0]) {
        return { valid: false as const, reason: "invalid" as const }
      }

      const m = member[0]

      if (m.status === "active") {
        return { valid: false as const, reason: "already_accepted" as const }
      }

      if (new Date() > m.inviteExpiresAt) {
        return { valid: false as const, reason: "expired" as const }
      }

      const prop = await db
        .select({ name: properties.name })
        .from(properties)
        .where(eq(properties.id, m.propertyId))
        .limit(1)

      return {
        valid: true as const,
        email: m.invitedEmail,
        propertyName: prop[0]?.name ?? "your property",
        propertyId: m.propertyId,
      }
    }),

  accept: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const member = await db
        .select()
        .from(propertyMembers)
        .where(eq(propertyMembers.inviteToken, input.token))
        .limit(1)

      if (!member.length || !member[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found" })
      }

      const m = member[0]

      if (m.status === "active") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invite already accepted" })
      }

      if (new Date() > m.inviteExpiresAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invite has expired" })
      }

      if (ctx.session.user.email !== m.invitedEmail) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You must sign in with the email address this invitation was sent to",
        })
      }

      const [updated] = await db
        .update(propertyMembers)
        .set({
          status: "active",
          userId: ctx.session.user.id,
          acceptedAt: new Date(),
        })
        .where(eq(propertyMembers.id, m.id))
        .returning()

      return { propertyId: m.propertyId, member: updated }
    }),
})
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/routers/invite.ts
git commit -m "feat: add inviteRouter for token validation and invite acceptance"
```

---

### Task 5: Wire routers into appRouter

**Context:** `packages/api/src/routers/index.ts` exports `appRouter` with `properties`, `feedback`, `ai`. Add `team` and `invite`.

**Files:**
- Modify: `packages/api/src/routers/index.ts`

- [ ] **Step 1: Add the two new routers**

Replace the contents of `packages/api/src/routers/index.ts`:

```ts
import { protectedProcedure, publicProcedure, router } from "../index"
import { aiRouter } from "./ai"
import { feedbackRouter } from "./feedback"
import { inviteRouter } from "./invite"
import { propertiesRouter } from "./properties"
import { teamRouter } from "./team"

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
  ai: aiRouter,
  team: teamRouter,
  invite: inviteRouter,
})

export type AppRouter = typeof appRouter
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:/Users/miste/intuitivestay/intuitivestay/apps/portal-web && pnpm tsc --noEmit 2>&1 | head -40
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/routers/index.ts
git commit -m "feat: add team and invite routers to appRouter"
```

---

### Task 6: Extend `getUser()` to detect staff membership

**Context:** `apps/portal-web/src/functions/get-user.ts` returns the session with org-derived `plan`, `subscriptionStatus`, and `properties`. For staff users (who have no org), it returns `subscriptionStatus: "none"` which causes `_portal.tsx` to redirect them to `/choose-plan`. We need to detect staff membership and return `isStaff: true`, `staffPropertyId`, and `staffPermissions` so the portal can render the staff experience.

**Files:**
- Modify: `apps/portal-web/src/functions/get-user.ts`

- [ ] **Step 1: Replace `get-user.ts`**

Replace the entire file:

```ts
import { db } from "@intuitive-stay/db"
import { organisations, properties, propertyMembers } from "@intuitive-stay/db/schema"
import { createServerFn } from "@tanstack/react-start"
import { and, eq } from "drizzle-orm"

import { authMiddleware } from "@/middleware/auth"

export const getUser = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!context.session) return null

    // Check if this user is a property owner
    const org = await db.query.organisations.findFirst({
      where: eq(organisations.ownerId, context.session.user.id),
      columns: { id: true, subscriptionStatus: true, plan: true },
    })

    if (org) {
      const orgProperties = await db
        .select({ id: properties.id, name: properties.name })
        .from(properties)
        .where(eq(properties.organisationId, org.id))

      return {
        ...context.session,
        user: {
          ...context.session.user,
          properties: orgProperties,
        },
        isAdmin: context.session.user.email === process.env.ADMIN_EMAIL,
        isStaff: false,
        staffPropertyId: null,
        staffPermissions: null,
        subscriptionStatus: org.subscriptionStatus ?? "none",
        plan: org.plan ?? null,
      }
    }

    // Check if this user is a staff member
    const membership = await db
      .select()
      .from(propertyMembers)
      .where(
        and(
          eq(propertyMembers.userId, context.session.user.id),
          eq(propertyMembers.status, "active"),
        ),
      )
      .limit(1)

    if (membership.length && membership[0]) {
      return {
        ...context.session,
        user: {
          ...context.session.user,
          properties: [],
        },
        isAdmin: false,
        isStaff: true,
        staffPropertyId: membership[0].propertyId,
        staffPermissions: membership[0].permissions as {
          viewFeedback: boolean
          viewAnalytics: boolean
          viewAiSummary: boolean
          viewWordCloud: boolean
          viewStaffCloud: boolean
          viewAlerts: boolean
        },
        subscriptionStatus: "active",
        plan: null,
      }
    }

    // User has no org and no staff membership
    return {
      ...context.session,
      user: {
        ...context.session.user,
        properties: [],
      },
      isAdmin: context.session.user.email === process.env.ADMIN_EMAIL,
      isStaff: false,
      staffPropertyId: null,
      staffPermissions: null,
      subscriptionStatus: "none",
      plan: null,
    }
  })
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:/Users/miste/intuitivestay/intuitivestay/apps/portal-web && pnpm tsc --noEmit 2>&1 | head -40
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/portal-web/src/functions/get-user.ts
git commit -m "feat: extend getUser to detect staff membership"
```

---

### Task 7: Update `_portal.tsx` for staff routing

**Context:** `_portal.tsx` redirects non-admins with `subscriptionStatus === "none"` to `/choose-plan`. Staff users now return `subscriptionStatus: "active"` so they won't hit that redirect. But staff should also be redirected to their property dashboard if they land on `/`. We need to pass `isStaff` and `staffPermissions` to `AppSidebar`.

**Files:**
- Modify: `apps/portal-web/src/routes/_portal.tsx`

- [ ] **Step 1: Update `RouteComponent` to pass staff props to sidebar**

Replace the `RouteComponent` function in `_portal.tsx`:

```tsx
function RouteComponent() {
  const { session } = Route.useRouteContext();
  const sessionProperties = resolveSessionProperties(session);
  const isStaff = (session as { isStaff?: boolean } | null)?.isStaff === true
  const staffPermissions = (session as { staffPermissions?: Record<string, boolean> | null } | null)?.staffPermissions ?? null

  return (
    <SidebarProvider>
      <ActivePropertyProvider initialProperties={sessionProperties}>
        <AppSidebar
          isAdmin={(session as { isAdmin?: boolean } | null)?.isAdmin === true}
          plan={(session as { plan?: string | null } | null)?.plan ?? null}
          subscriptionStatus={(session as { subscriptionStatus?: string } | null)?.subscriptionStatus ?? "none"}
          isStaff={isStaff}
          staffPermissions={staffPermissions}
        />
        <SidebarInset className="overflow-x-hidden bg-[#f8fafc]">
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center border-b bg-white/90 backdrop-blur-md">
            <div className="flex w-full items-center justify-between gap-3 px-3 md:px-4">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <div className="relative w-full max-w-sm md:max-w-md">
                  <SearchIcon className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search"
                    className="h-9 pr-14 pl-9"
                    aria-label="Search"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded-md border border-border/70 bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    ⌘ F
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 md:gap-2">
                <TopbarThemeSwitcher />
                <TopbarNotifications />
                <TopbarUserMenu />
              </div>
            </div>
          </header>
          <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden pt-3">
            <Outlet />
          </div>
        </SidebarInset>
      </ActivePropertyProvider>
    </SidebarProvider>
  );
}
```

Also update `_portal.index.tsx` to redirect staff to their property dashboard. Replace the `RouteComponent` in `apps/portal-web/src/routes/_portal.index.tsx`:

```tsx
function RouteComponent() {
  const { session } = useRouteContext({ from: "/_portal" })
  const navigate = useNavigate()
  const isAdmin = (session as { isAdmin?: boolean } | null)?.isAdmin === true
  const isStaff = (session as { isStaff?: boolean } | null)?.isStaff === true
  const staffPropertyId = (session as { staffPropertyId?: string | null } | null)?.staffPropertyId ?? null
  const plan = (session as { plan?: string | null } | null)?.plan ?? null
  const properties = (session as { user?: { properties?: Array<{ id: string; name: string }> } } | null)?.user?.properties ?? []

  React.useEffect(() => {
    if (isStaff && staffPropertyId) {
      void navigate({
        to: "/properties/$propertyId/dashboard",
        params: { propertyId: staffPropertyId },
        replace: true,
      })
    } else if (!isAdmin && (plan === "host" || plan === "partner") && properties.length > 0) {
      const firstProperty = properties[0]
      if (firstProperty) {
        void navigate({
          to: "/properties/$propertyId/dashboard",
          params: { propertyId: firstProperty.id },
          replace: true,
        })
      }
    }
  }, [isAdmin, isStaff, staffPropertyId, plan, properties, navigate])

  if (isAdmin) return <AdminDashboard />
  if (isStaff && staffPropertyId) return null
  if ((plan === "host" || plan === "partner") && properties.length > 0) return null
  return <PortfolioDashboard />
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:/Users/miste/intuitivestay/intuitivestay/apps/portal-web && pnpm tsc --noEmit 2>&1 | head -40
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/portal-web/src/routes/_portal.tsx apps/portal-web/src/routes/_portal.index.tsx
git commit -m "feat: pass staff props to sidebar, redirect staff to property dashboard"
```

---

### Task 8: Add staff sidebar branch to `app-sidebar.tsx`

**Context:** `app-sidebar.tsx` receives `isAdmin`, `plan`, `subscriptionStatus` props. Add `isStaff` and `staffPermissions`. Staff sidebar: show "My Property" group with Dashboard always, Feedback if `viewFeedback` is true. No PropertySwitcher, no QR Codes, no Team. Also add a "Team" link to the owner sidebar (non-staff, non-Founder host/partner).

The current owner props signature (line 124 in the current file):
```tsx
export function AppSidebar({
  isAdmin = false,
  plan = null,
  subscriptionStatus = "none",
  ...props
}: React.ComponentProps<typeof Sidebar> & { isAdmin?: boolean; plan?: string | null; subscriptionStatus?: string }) {
```

Add `UsersIcon` is already imported. Need `TeamIcon` — use `UsersIcon` for the Team link.

**Files:**
- Modify: `apps/portal-web/src/components/app-sidebar.tsx`

- [ ] **Step 1: Update the component signature and add staff branch**

Replace the `AppSidebar` export function signature and add the staff branch. Read the file first. The full replacement of the non-admin return block:

```tsx
export function AppSidebar({
  isAdmin = false,
  plan = null,
  subscriptionStatus = "none",
  isStaff = false,
  staffPermissions = null,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  isAdmin?: boolean
  plan?: string | null
  subscriptionStatus?: string
  isStaff?: boolean
  staffPermissions?: {
    viewFeedback: boolean
    viewAnalytics: boolean
    viewAiSummary: boolean
    viewWordCloud: boolean
    viewStaffCloud: boolean
    viewAlerts: boolean
  } | null
}) {
  const location = useLocation()
  const { activePropertyId, properties } = useActiveProperty()

  const hasProperties = properties.length > 0 && Boolean(activePropertyId)
  const propertyParams = { propertyId: activePropertyId }
  const propertyDashboardPath = buildPropertyPath(activePropertyId, "dashboard")
  const propertyFeedbackPath = buildPropertyPath(activePropertyId, "feedback")
  const propertyQrFormPath = buildPropertyPath(activePropertyId, "qr-form")

  if (isAdmin) {
    return (
      <Sidebar
        collapsible="icon"
        className="[background:linear-gradient(180deg,#1e1b4b_0%,#312e81_100%)] border-r-0"
        {...props}
      >
        <SidebarHeader className="gap-0 p-0">
          <div className="flex h-16 items-center border-b border-sidebar-border p-2">
            <SidebarBrand />
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="px-4 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/35">Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarLinkItem
                  label="Dashboard"
                  icon={<LayoutDashboardIcon />}
                  link={<AppSidebarLink to="/" />}
                  isActive={isRouteActive(location.pathname, "/")}
                />
                <SidebarLinkItem
                  label="Approvals"
                  icon={<ShieldCheckIcon />}
                  link={<AppSidebarLink to="/admin/approvals" />}
                  isActive={isRouteActive(location.pathname, "/admin/approvals")}
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarRail />
      </Sidebar>
    )
  }

  // Staff sidebar
  if (isStaff && activePropertyId) {
    return (
      <Sidebar
        collapsible="icon"
        className="[background:linear-gradient(180deg,#1e1b4b_0%,#312e81_100%)] border-r-0"
        {...props}
      >
        <SidebarHeader className="gap-0 p-0">
          <div className="flex h-16 items-center border-b border-sidebar-border p-2">
            <SidebarBrand />
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="px-4 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/35">
              My Property
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarLinkItem
                  label="Dashboard"
                  icon={<LayoutDashboardIcon />}
                  link={
                    <AppSidebarLink
                      to="/properties/$propertyId/dashboard"
                      params={propertyParams}
                    />
                  }
                  isActive={isRouteActive(location.pathname, propertyDashboardPath)}
                />
                {staffPermissions?.viewFeedback && (
                  <SidebarLinkItem
                    label="Feedback"
                    icon={<UsersIcon />}
                    link={
                      <AppSidebarLink
                        to="/properties/$propertyId/feedback"
                        params={propertyParams}
                      />
                    }
                    isActive={isRouteActive(location.pathname, propertyFeedbackPath)}
                  />
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarRail />
      </Sidebar>
    )
  }

  const isFounder = plan === "founder"

  return (
    <Sidebar
      collapsible="icon"
      className="[background:linear-gradient(180deg,#1e1b4b_0%,#312e81_100%)] border-r-0"
      {...props}
    >
      <SidebarHeader className="gap-0 p-0">
        <div className="flex h-16 items-center border-b border-sidebar-border p-2">
          <SidebarBrand />
        </div>
        {!isFounder && (
          <div className="p-2">
            <PropertySwitcher />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        {isFounder ? (
          <SidebarGroup>
            <SidebarGroupLabel className="px-4 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/35">
              My Properties
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarLinkItem
                  label="All Properties"
                  icon={<Building2Icon />}
                  link={<AppSidebarLink to="/properties" />}
                  isActive={isRouteActive(location.pathname, "/properties")}
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          hasProperties && (
            <SidebarGroup>
              <SidebarGroupLabel className="px-4 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/35">
                My Property
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarLinkItem
                    label="Dashboard"
                    icon={<LayoutDashboardIcon />}
                    link={
                      <AppSidebarLink
                        to="/properties/$propertyId/dashboard"
                        params={propertyParams}
                      />
                    }
                    isActive={isRouteActive(location.pathname, propertyDashboardPath)}
                  />
                  <SidebarLinkItem
                    label="Feedback"
                    icon={<UsersIcon />}
                    link={
                      <AppSidebarLink
                        to="/properties/$propertyId/feedback"
                        params={propertyParams}
                      />
                    }
                    isActive={isRouteActive(location.pathname, propertyFeedbackPath)}
                  />
                  <SidebarLinkItem
                    label="QR Codes"
                    icon={<QrCodeIcon />}
                    link={
                      <AppSidebarLink
                        to="/properties/$propertyId/qr-form"
                        params={propertyParams}
                      />
                    }
                    isActive={isRouteActive(location.pathname, propertyQrFormPath)}
                  />
                  <SidebarLinkItem
                    label="Team"
                    icon={<UsersIcon />}
                    link={
                      <AppSidebarLink
                        to="/properties/$propertyId/team"
                        params={propertyParams}
                      />
                    }
                    isActive={isRouteActive(location.pathname, buildPropertyPath(activePropertyId, "team"))}
                  />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        )}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}
```

Note: `ShieldCheckIcon` must be added to imports since the admin sidebar uses it. Check current imports first — if it was removed in the navigation redesign, add it back. The icon is from `lucide-react`.

Also note: Two `UsersIcon` entries in the owner sidebar (Feedback and Team) will look the same. For Team, use a different icon. Change the Team icon import to use `UserPlusIcon` from lucide-react:

```tsx
// In the import block, add:
import {
  Building2Icon,
  LayoutDashboardIcon,
  QrCodeIcon,
  ShieldCheckIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react"
```

Then use `<UserPlusIcon />` for the Team link.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:/Users/miste/intuitivestay/intuitivestay/apps/portal-web && pnpm tsc --noEmit 2>&1 | head -40
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/portal-web/src/components/app-sidebar.tsx
git commit -m "feat: add staff sidebar branch and Team link to owner sidebar"
```

---

### Task 9: Invite acceptance page

**Context:** The invite page lives outside `_portal` layout (no auth guard, no sidebar). Existing outside-portal routes: `login.tsx`, `reset-password.tsx`. The page must:
1. Read `?token=` from URL
2. Call `invite.getDetails({ token })` to validate and show property name
3. If invalid/expired → show error
4. If no current session → show sign-up form (email pre-filled, read-only)
5. On sign-up → call `authClient.signUp.email()` → then call `invite.accept({ token })` → redirect to dashboard

**Files:**
- Create: `apps/portal-web/src/routes/invite.tsx`

- [ ] **Step 1: Create the invite acceptance page**

Create `apps/portal-web/src/routes/invite.tsx`:

```tsx
import * as React from "react"
import { Button } from "@intuitive-stay/ui/components/button"
import { Input } from "@intuitive-stay/ui/components/input"
import { Label } from "@intuitive-stay/ui/components/label"
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router"
import { z } from "zod"

import { authClient } from "@/lib/auth-client"
import { useTRPC } from "@/utils/trpc"
import { useQuery, useMutation } from "@tanstack/react-query"

export const Route = createFileRoute("/invite")({
  validateSearch: z.object({ token: z.string().optional() }),
  component: RouteComponent,
})

function RouteComponent() {
  const { token } = useSearch({ from: "/invite" })
  const navigate = useNavigate()
  const trpc = useTRPC()

  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  const { data: session } = authClient.useSession()

  const { data: details, isLoading } = useQuery(
    trpc.invite.getDetails.queryOptions({ token: token ?? "" }, { enabled: Boolean(token) }),
  )

  const acceptMutation = useMutation(
    trpc.invite.accept.mutationOptions(),
  )

  async function handleAccept() {
    if (!token) return
    setError(null)
    setSubmitting(true)
    try {
      const result = await acceptMutation.mutateAsync({ token })
      void navigate({
        to: "/properties/$propertyId/dashboard",
        params: { propertyId: result.propertyId },
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to accept invite"
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSignUpAndAccept() {
    if (!token || !details || !details.valid) return
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const signUpResult = await authClient.signUp.email({
        email: details.email,
        password,
        name: details.email.split("@")[0] ?? details.email,
      })
      if (signUpResult.error) {
        setError(signUpResult.error.message ?? "Sign up failed")
        return
      }
      const result = await acceptMutation.mutateAsync({ token })
      void navigate({
        to: "/properties/$propertyId/dashboard",
        params: { propertyId: result.propertyId },
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong"
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold">Invalid invite link</h1>
          <p className="mt-2 text-muted-foreground">This invite link is missing a token.</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (!details || !details.valid) {
    const reason = details?.reason
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold">
            {reason === "expired" ? "Invite expired" : reason === "already_accepted" ? "Already accepted" : "Invalid invite"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {reason === "expired"
              ? "This invite link has expired. Ask your property owner to resend the invitation."
              : reason === "already_accepted"
              ? "This invite has already been accepted. Try logging in."
              : "This invite link is not valid."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">You've been invited</h1>
          <p className="mt-1 text-muted-foreground">
            Access the dashboard for <strong>{details.propertyName}</strong>
          </p>
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>
        )}

        {session ? (
          // Already logged in — check if email matches
          session.user.email === details.email ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Signed in as <strong>{session.user.email}</strong>
              </p>
              <Button className="w-full" onClick={handleAccept} disabled={submitting}>
                {submitting ? "Accepting…" : "Accept Invitation"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                You are signed in as <strong>{session.user.email}</strong>, but this invite was sent to{" "}
                <strong>{details.email}</strong>.
              </p>
              <p className="text-sm text-muted-foreground">
                Please sign out and use the email address the invite was sent to.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => authClient.signOut()}
              >
                Sign Out
              </Button>
            </div>
          )
        ) : (
          // Not logged in — show sign-up form
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={details.email} readOnly className="bg-muted" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Create a password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
              />
            </div>
            <Button className="w-full" onClick={handleSignUpAndAccept} disabled={submitting}>
              {submitting ? "Setting up…" : "Create account & accept"}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:/Users/miste/intuitivestay/intuitivestay/apps/portal-web && pnpm tsc --noEmit 2>&1 | head -40
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/portal-web/src/routes/invite.tsx
git commit -m "feat: add invite acceptance page"
```

---

### Task 10: Team management page

**Context:** Route `/_portal/properties/$propertyId/team`. Reads `propertyId` from params. Uses `team.listMembers`, `team.inviteStaff`, `team.updatePermissions`, `team.removeMember`, `team.resendInvite`. Uses shadcn `Dialog` for the invite modal. The dialog import path is `@intuitive-stay/ui/components/dialog`. The `Switch` component is at `@intuitive-stay/ui/components/switch`. The `Badge` component is at `@intuitive-stay/ui/components/badge`.

**Files:**
- Create: `apps/portal-web/src/routes/_portal.properties.$propertyId.team.tsx`

- [ ] **Step 1: Create the Team page**

Create `apps/portal-web/src/routes/_portal.properties.$propertyId.team.tsx`:

```tsx
import * as React from "react"
import { Badge } from "@intuitive-stay/ui/components/badge"
import { Button } from "@intuitive-stay/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@intuitive-stay/ui/components/dialog"
import { Input } from "@intuitive-stay/ui/components/input"
import { Label } from "@intuitive-stay/ui/components/label"
import { Switch } from "@intuitive-stay/ui/components/switch"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { UserPlusIcon } from "lucide-react"

import { useTRPC } from "@/utils/trpc"

export const Route = createFileRoute("/_portal/properties/$propertyId/team")({
  component: RouteComponent,
})

const DEFAULT_PERMISSIONS = {
  viewFeedback: true,
  viewAnalytics: true,
  viewAiSummary: false,
  viewWordCloud: true,
  viewStaffCloud: false,
  viewAlerts: false,
}

const PERMISSION_LABELS: Record<keyof typeof DEFAULT_PERMISSIONS, string> = {
  viewFeedback: "View recent guest feedback",
  viewAnalytics: "View charts & scores",
  viewAiSummary: "View AI daily summary",
  viewWordCloud: "View adjective word cloud",
  viewStaffCloud: "View staff mention cloud",
  viewAlerts: "View open alerts",
}

function PermissionToggles({
  permissions,
  onChange,
}: {
  permissions: typeof DEFAULT_PERMISSIONS
  onChange: (key: keyof typeof DEFAULT_PERMISSIONS, value: boolean) => void
}) {
  return (
    <div className="space-y-3">
      {(Object.keys(DEFAULT_PERMISSIONS) as Array<keyof typeof DEFAULT_PERMISSIONS>).map((key) => (
        <div key={key} className="flex items-center justify-between">
          <Label htmlFor={key} className="text-sm font-normal">
            {PERMISSION_LABELS[key]}
          </Label>
          <Switch
            id={key}
            checked={permissions[key]}
            onCheckedChange={(checked) => onChange(key, checked)}
          />
        </div>
      ))}
    </div>
  )
}

function InviteModal({ propertyId, onSuccess }: { propertyId: string; onSuccess: () => void }) {
  const [open, setOpen] = React.useState(false)
  const [email, setEmail] = React.useState("")
  const [displayName, setDisplayName] = React.useState("")
  const [permissions, setPermissions] = React.useState({ ...DEFAULT_PERMISSIONS })
  const [error, setError] = React.useState<string | null>(null)
  const trpc = useTRPC()

  const inviteMutation = useMutation(trpc.team.inviteStaff.mutationOptions())

  async function handleSubmit() {
    setError(null)
    if (!email) {
      setError("Email is required")
      return
    }
    try {
      await inviteMutation.mutateAsync({ propertyId, email, displayName: displayName || undefined, permissions })
      setOpen(false)
      setEmail("")
      setDisplayName("")
      setPermissions({ ...DEFAULT_PERMISSIONS })
      onSuccess()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to send invite"
      setError(msg)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlusIcon className="mr-2 h-4 w-4" />
          Invite Staff Member
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Staff Member</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}
          <div className="space-y-1">
            <Label htmlFor="invite-email">Email address</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@example.com"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="invite-name">Display name (optional)</Label>
            <Input
              id="invite-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Jane Smith"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Permissions</Label>
            <PermissionToggles
              permissions={permissions}
              onChange={(key, value) => setPermissions((p) => ({ ...p, [key]: value }))}
            />
          </div>
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={inviteMutation.isPending}
          >
            {inviteMutation.isPending ? "Sending…" : "Send Invite"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RouteComponent() {
  const { propertyId } = Route.useParams()
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { data: members, isLoading } = useQuery(
    trpc.team.listMembers.queryOptions({ propertyId }),
  )

  const removeMutation = useMutation(trpc.team.removeMember.mutationOptions())
  const resendMutation = useMutation(trpc.team.resendInvite.mutationOptions())

  function refetch() {
    void queryClient.invalidateQueries(trpc.team.listMembers.queryOptions({ propertyId }))
  }

  function permissionSummary(perms: Record<string, boolean>): string {
    const labels: Record<string, string> = {
      viewFeedback: "Feedback",
      viewAnalytics: "Analytics",
      viewAiSummary: "AI Summary",
      viewWordCloud: "Word Cloud",
      viewStaffCloud: "Staff Cloud",
      viewAlerts: "Alerts",
    }
    const enabled = Object.entries(perms)
      .filter(([, v]) => v)
      .map(([k]) => labels[k] ?? k)
    return enabled.length > 0 ? enabled.join(", ") : "None"
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Team</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage staff access to your property dashboard
          </p>
        </div>
        <InviteModal propertyId={propertyId} onSuccess={refetch} />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !members || members.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <UserPlusIcon className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            Your team will appear here once you invite someone.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Member</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Permissions</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{member.displayName ?? member.invitedEmail}</div>
                    {member.displayName && (
                      <div className="text-xs text-muted-foreground">{member.invitedEmail}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={member.status === "active" ? "default" : "secondary"}>
                      {member.status === "active" ? "Active" : "Pending"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                    {permissionSummary(member.permissions as Record<string, boolean>)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {member.status === "pending" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            await resendMutation.mutateAsync({ memberId: member.id })
                            refetch()
                          }}
                          disabled={resendMutation.isPending}
                        >
                          Resend
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={async () => {
                          await removeMutation.mutateAsync({ memberId: member.id })
                          refetch()
                        }}
                        disabled={removeMutation.isPending}
                      >
                        Remove
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:/Users/miste/intuitivestay/intuitivestay/apps/portal-web && pnpm tsc --noEmit 2>&1 | head -40
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/portal-web/src/routes/_portal.properties.\$propertyId.team.tsx
git commit -m "feat: add Team management page with invite modal"
```

---

### Task 11: Build and deploy

**Files:** None — build and deploy only.

- [ ] **Step 1: Run the full build**

```bash
cd C:/Users/miste/intuitivestay/intuitivestay && pnpm build 2>&1 | tail -30
```

Expected: build succeeds with no TypeScript errors. If it fails, read the full error and fix the relevant file before proceeding.

- [ ] **Step 2: Push to Railway**

```bash
git push origin main
```

Expected: Railway picks up the push and deploys.

- [ ] **Step 3: Verify in production**

Log in as an owner and confirm:
- "Team" appears in the sidebar under My Property (between QR Codes and end of list)
- Team page shows an empty state with "Invite Staff Member" button
- Invite modal opens with email, display name, and permission toggles
- Sending an invite creates a pending row and sends an email

As a staff user (accept an invite):
- Visit `/invite?token=<token>` — see the property name and sign-up form
- Create account → redirected to property dashboard
- Sidebar shows only Dashboard (and Feedback if permitted)
- No QR Codes, no Team, no billing in sidebar
