# Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the portal to Supabase, create all business database tables, and rename plan tiers from (Essentialist/Growth Pro/Elite Mastery) to (Host/Partner/Founder) throughout the codebase.

**Architecture:** Add 5 new Drizzle schema files to `packages/db/src/schema/`, push them to Supabase, then do a targeted find-and-replace of tier names across 5 files. No logic changes — pure foundation work.

**Tech Stack:** Drizzle ORM, PostgreSQL (Supabase), TypeScript, pnpm

---

## File Map

**Create:**
- `packages/db/src/schema/organisations.ts`
- `packages/db/src/schema/properties.ts`
- `packages/db/src/schema/qr-codes.ts`
- `packages/db/src/schema/feedback.ts`
- `packages/db/src/schema/property-scores.ts`

**Modify:**
- `packages/db/src/schema/index.ts` — export new schemas
- `apps/portal-server/.env` — point DATABASE_URL at Supabase
- `apps/portal-web/src/lib/portal-access.ts` — rename tier types and values
- `packages/ui/src/components/plan-badge.tsx` — rename variants and labels
- `apps/portal-web/src/components/app-sidebar.tsx` — update hardcoded variant
- `apps/portal-web/src/routes/_portal.organisation.alerts.tsx` — update plan string
- `apps/portal-web/src/routes/_portal.organisation.billing.tsx` — update plan string

---

## Task 1: Point DATABASE_URL at Supabase

**Files:**
- Modify: `apps/portal-server/.env`

- [ ] **Step 1: Get your Supabase connection string**

  1. Open your Supabase dashboard
  2. Click **Settings** (gear icon, bottom left)
  3. Click **Database**
  4. Scroll to **Connection string** → select **URI** tab
  5. Copy the string — it looks like: `postgresql://postgres.[ref]:[password]@aws-0-eu-west-2.pooler.supabase.com:6543/postgres`
  6. Replace `[YOUR-PASSWORD]` with your actual database password

- [ ] **Step 2: Update the .env file**

  Open `apps/portal-server/.env` and replace the DATABASE_URL line:

  ```
  DATABASE_URL=postgresql://postgres.[your-ref]:[your-password]@[your-host].pooler.supabase.com:6543/postgres
  BETTER_AUTH_SECRET=mysecretkey123456789abcdefghijklm
  BETTER_AUTH_URL=http://localhost:5174
  CORS_ORIGIN=http://localhost:5173
  NODE_ENV=development
  ```

  > ⚠️ Make sure `apps/portal-server/.env` is in `.gitignore` — never commit real credentials.

- [ ] **Step 3: Verify connection**

  ```bash
  cd apps/portal-server && pnpm dev
  ```

  Expected: Server starts on port 5174 with no "connection refused" errors. Hit Ctrl+C to stop.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/portal-server/.env.example
  git commit -m "chore: update env example with Supabase DATABASE_URL format"
  ```

  > Do NOT commit the actual `.env` file — only commit an `.env.example` if one exists.

---

## Task 2: Create organisations schema

**Files:**
- Create: `packages/db/src/schema/organisations.ts`

- [ ] **Step 1: Create the file**

  ```typescript
  // packages/db/src/schema/organisations.ts
  import { relations } from "drizzle-orm";
  import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

  import { user } from "./auth";

  export const organisations = pgTable("organisations", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    plan: text("plan").notNull().default("host"), // 'host' | 'partner' | 'founder'
    ownerId: text("owner_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  });

  export const organisationsRelations = relations(organisations, ({ one }) => ({
    owner: one(user, {
      fields: [organisations.ownerId],
      references: [user.id],
    }),
  }));
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  cd packages/db && pnpm check-types 2>/dev/null || npx tsc --noEmit
  ```

  Expected: No errors.

---

## Task 3: Create properties schema

**Files:**
- Create: `packages/db/src/schema/properties.ts`

- [ ] **Step 1: Create the file**

  ```typescript
  // packages/db/src/schema/properties.ts
  import { relations } from "drizzle-orm";
  import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

  import { organisations } from "./organisations";

  export const properties = pgTable("properties", {
    id: text("id").primaryKey(),
    organisationId: text("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    address: text("address"),
    city: text("city").notNull(),
    country: text("country").notNull(),
    type: text("type"), // 'hotel' | 'villa' | 'bnb' | 'restaurant' | 'other'
    status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'rejected'
    ownerEmail: text("owner_email").notNull(),
    ownerName: text("owner_name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  });

  export const propertiesRelations = relations(properties, ({ one }) => ({
    organisation: one(organisations, {
      fields: [properties.organisationId],
      references: [organisations.id],
    }),
  }));
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  cd packages/db && npx tsc --noEmit
  ```

  Expected: No errors.

---

## Task 4: Create qr-codes schema

**Files:**
- Create: `packages/db/src/schema/qr-codes.ts`

- [ ] **Step 1: Create the file**

  ```typescript
  // packages/db/src/schema/qr-codes.ts
  import { relations } from "drizzle-orm";
  import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

  import { properties } from "./properties";

  export const qrCodes = pgTable("qr_codes", {
    id: text("id").primaryKey(),
    propertyId: text("property_id")
      .notNull()
      .unique()
      .references(() => properties.id, { onDelete: "cascade" }),
    uniqueCode: text("unique_code").notNull().unique(),
    feedbackUrl: text("feedback_url").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  });

  export const qrCodesRelations = relations(qrCodes, ({ one }) => ({
    property: one(properties, {
      fields: [qrCodes.propertyId],
      references: [properties.id],
    }),
  }));
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  cd packages/db && npx tsc --noEmit
  ```

  Expected: No errors.

---

## Task 5: Create feedback schema

**Files:**
- Create: `packages/db/src/schema/feedback.ts`

- [ ] **Step 1: Create the file**

  ```typescript
  // packages/db/src/schema/feedback.ts
  import { relations } from "drizzle-orm";
  import { pgTable, text, timestamp, integer, numeric } from "drizzle-orm/pg-core";

  import { properties } from "./properties";
  import { qrCodes } from "./qr-codes";

  export const feedback = pgTable("feedback", {
    id: text("id").primaryKey(),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    qrCodeId: text("qr_code_id").references(() => qrCodes.id, {
      onDelete: "set null",
    }),
    resilience: integer("resilience").notNull(),   // 1-10
    empathy: integer("empathy").notNull(),         // 1-10
    consistency: integer("consistency").notNull(), // 1-10
    recognition: integer("recognition").notNull(), // 1-10
    gcs: numeric("gcs", { precision: 4, scale: 2 }).notNull(), // avg of 4 pillars
    mealTime: text("meal_time"), // 'breakfast' | 'lunch' | 'dinner' | 'none'
    source: text("source").notNull().default("qr_form"), // 'qr_form' | 'google' | 'booking_com' etc.
    namedStaffMember: text("named_staff_member"), // from Name Drop™ prompt, nullable
    ventText: text("vent_text"),                  // from Vent Box™ prompt, nullable
    submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  });

  export const feedbackRelations = relations(feedback, ({ one }) => ({
    property: one(properties, {
      fields: [feedback.propertyId],
      references: [properties.id],
    }),
    qrCode: one(qrCodes, {
      fields: [feedback.qrCodeId],
      references: [qrCodes.id],
    }),
  }));
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  cd packages/db && npx tsc --noEmit
  ```

  Expected: No errors.

---

## Task 6: Create property-scores schema

**Files:**
- Create: `packages/db/src/schema/property-scores.ts`

- [ ] **Step 1: Create the file**

  ```typescript
  // packages/db/src/schema/property-scores.ts
  import { relations } from "drizzle-orm";
  import { pgTable, text, timestamp, integer, numeric } from "drizzle-orm/pg-core";

  import { properties } from "./properties";

  export const propertyScores = pgTable("property_scores", {
    id: text("id").primaryKey(),
    propertyId: text("property_id")
      .notNull()
      .unique()
      .references(() => properties.id, { onDelete: "cascade" }),
    avgGcs: numeric("avg_gcs", { precision: 4, scale: 2 }),
    avgResilience: numeric("avg_resilience", { precision: 4, scale: 2 }),
    avgEmpathy: numeric("avg_empathy", { precision: 4, scale: 2 }),
    avgConsistency: numeric("avg_consistency", { precision: 4, scale: 2 }),
    avgRecognition: numeric("avg_recognition", { precision: 4, scale: 2 }),
    totalFeedback: integer("total_feedback").default(0).notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  });

  export const propertyScoresRelations = relations(propertyScores, ({ one }) => ({
    property: one(properties, {
      fields: [propertyScores.propertyId],
      references: [properties.id],
    }),
  }));
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  cd packages/db && npx tsc --noEmit
  ```

  Expected: No errors.

---

## Task 7: Export all schemas from index

**Files:**
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Replace index.ts contents**

  ```typescript
  // packages/db/src/schema/index.ts
  export * from "./auth";
  export * from "./organisations";
  export * from "./properties";
  export * from "./qr-codes";
  export * from "./feedback";
  export * from "./property-scores";
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  cd packages/db && npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 3: Commit all schema work**

  ```bash
  git add packages/db/src/schema/
  git commit -m "feat(db): add organisations, properties, qr-codes, feedback, property-scores schemas"
  ```

---

## Task 8: Push schema to Supabase

**Files:**
- No file changes — this runs the migration

- [ ] **Step 1: Push schema to Supabase**

  From the repo root:

  ```bash
  cd packages/db && pnpm db:push
  ```

  Expected output includes lines like:
  ```
  [✓] Changes applied
  ```
  And lists all 5 new tables created.

- [ ] **Step 2: Verify tables exist in Supabase**

  1. Open your Supabase dashboard
  2. Click **Table Editor** in the left sidebar
  3. Confirm you can see: `organisations`, `properties`, `qr_codes`, `feedback`, `property_scores`
  4. Also confirm the auth tables are still there: `user`, `session`, `account`, `verification`

- [ ] **Step 3: Commit migration files if generated**

  ```bash
  git add packages/db/src/migrations/ 2>/dev/null || true
  git commit -m "chore(db): apply schema to Supabase" --allow-empty
  ```

---

## Task 9: Rename tier names in portal-access.ts

**Files:**
- Modify: `apps/portal-web/src/lib/portal-access.ts`

- [ ] **Step 1: Replace the entire file**

  ```typescript
  // apps/portal-web/src/lib/portal-access.ts
  export type PlanTier = "host" | "partner" | "founder"

  export type PortalPermission =
    | "view_dashboard"
    | "manage_properties"
    | "view_property_dashboard"
    | "view_feedback"
    | "view_insights"
    | "view_advanced_insights"
    | "view_qr_form"
    | "view_local_market"
    | "view_alerts"
    | "manage_members"
    | "manage_roles"
    | "view_multi_site"
    | "manage_billing"

  export type LockedFeatureKey =
    | "advanced-yearly-trends"
    | "sentiment-vibe-maps"
    | "day-of-week-consistency"
    | "venting-box-red-alerts"
    | "reputation-gap-analysis"
    | "local-city-leaderboard"
    | "market-benchmarking"
    | "multi-site-management"
    | "local-market"

  const PLAN_WEIGHT: Record<PlanTier, number> = {
    host: 1,
    partner: 2,
    founder: 3,
  }

  export const ALL_PERMISSIONS: PortalPermission[] = [
    "view_dashboard",
    "manage_properties",
    "view_property_dashboard",
    "view_feedback",
    "view_insights",
    "view_advanced_insights",
    "view_qr_form",
    "view_local_market",
    "view_alerts",
    "manage_members",
    "manage_roles",
    "view_multi_site",
    "manage_billing",
  ]

  export const FEATURE_MIN_PLAN: Record<LockedFeatureKey, PlanTier> = {
    "advanced-yearly-trends": "founder",
    "sentiment-vibe-maps": "partner",
    "day-of-week-consistency": "partner",
    "venting-box-red-alerts": "partner",
    "reputation-gap-analysis": "founder",
    "local-city-leaderboard": "founder",
    "market-benchmarking": "founder",
    "multi-site-management": "founder",
    "local-market": "founder",
  }

  export type PortalAccess = {
    plan: PlanTier
    permissions: Set<PortalPermission>
  }

  function normalizePlan(plan: unknown): PlanTier {
    if (typeof plan !== "string") {
      return "host"
    }

    const normalized = plan.toLowerCase().trim()

    if (normalized.includes("founder") || normalized.includes("elite")) {
      return "founder"
    }

    if (normalized.includes("partner") || normalized.includes("growth")) {
      return "partner"
    }

    return "host"
  }

  function normalizePermissions(input: unknown): Set<PortalPermission> {
    if (!Array.isArray(input)) {
      return new Set(ALL_PERMISSIONS)
    }

    const set = new Set<PortalPermission>()
    for (const permission of input) {
      if (typeof permission !== "string") {
        continue
      }

      if ((ALL_PERMISSIONS as string[]).includes(permission)) {
        set.add(permission as PortalPermission)
      }
    }

    if (set.size === 0) {
      return new Set(ALL_PERMISSIONS)
    }

    return set
  }

  export function resolvePortalAccess(session: unknown): PortalAccess {
    const user =
      typeof session === "object" && session !== null && "user" in session
        ? (session as { user?: Record<string, unknown> }).user
        : undefined

    const plan =
      user?.planTier ??
      user?.plan ??
      user?.subscriptionPlan ??
      user?.tier ??
      "host"

    const permissions =
      user?.permissions ??
      user?.roles ??
      user?.grants ??
      user?.scopes ??
      ALL_PERMISSIONS

    return {
      plan: normalizePlan(plan),
      permissions: normalizePermissions(permissions),
    }
  }

  export function hasPermission(access: PortalAccess, permission?: PortalPermission) {
    if (!permission) {
      return true
    }

    return access.permissions.has(permission)
  }

  export function meetsPlan(access: PortalAccess, requiredPlan?: PlanTier) {
    if (!requiredPlan) {
      return true
    }

    return PLAN_WEIGHT[access.plan] >= PLAN_WEIGHT[requiredPlan]
  }

  export function isFeatureEnabled(access: PortalAccess, feature: LockedFeatureKey) {
    return meetsPlan(access, FEATURE_MIN_PLAN[feature])
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  cd apps/portal-web && npx tsc --noEmit
  ```

  Expected: No errors (or only pre-existing errors unrelated to this file).

---

## Task 10: Rename tier names in plan-badge.tsx

**Files:**
- Modify: `packages/ui/src/components/plan-badge.tsx`

- [ ] **Step 1: Replace the entire file**

  ```typescript
  // packages/ui/src/components/plan-badge.tsx
  import { mergeProps } from "@base-ui/react/merge-props"
  import { useRender } from "@base-ui/react/use-render"
  import { cva, type VariantProps } from "class-variance-authority"

  import { cn } from "@intuitive-stay/ui/lib/utils"

  const planBadgeVariants = cva(
    "group/plan-badge inline-flex w-fit shrink-0 items-center justify-center overflow-hidden whitespace-nowrap rounded-full border border-transparent px-2 py-0.5 text-[10px] font-semibold transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
    {
      variants: {
        variant: {
          host: "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-200",
          partner: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
          founder: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
        },
      },
      defaultVariants: {
        variant: "host",
      },
    }
  )

  type PlanBadgeVariant = NonNullable<VariantProps<typeof planBadgeVariants>["variant"]>

  const PLAN_BADGE_LABELS: Record<PlanBadgeVariant, string> = {
    host: "Host",
    partner: "Partner",
    founder: "Founder",
  }

  type PlanBadgeProps = Omit<useRender.ComponentProps<"span">, "children"> &
    VariantProps<typeof planBadgeVariants>

  function PlanBadge({
    className,
    variant = "host",
    render,
    ...props
  }: PlanBadgeProps) {
    const resolvedVariant = variant ?? "host"

    return useRender({
      defaultTagName: "span",
      props: mergeProps<"span">(
        {
          className: cn(planBadgeVariants({ variant: resolvedVariant }), className),
          children: PLAN_BADGE_LABELS[resolvedVariant],
        },
        props
      ),
      render,
      state: {
        slot: "plan-badge",
        variant: resolvedVariant,
      },
    })
  }

  export { PlanBadge, planBadgeVariants }
  export type { PlanBadgeVariant }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  cd packages/ui && npx tsc --noEmit
  ```

  Expected: No errors.

---

## Task 11: Update remaining tier references

**Files:**
- Modify: `apps/portal-web/src/components/app-sidebar.tsx`
- Modify: `apps/portal-web/src/routes/_portal.organisation.alerts.tsx`
- Modify: `apps/portal-web/src/routes/_portal.organisation.billing.tsx`

- [ ] **Step 1: Update app-sidebar.tsx**

  Find the line (around line 307):
  ```tsx
  <PlanBadge variant="essentialist" className="ml-auto" />
  ```
  Replace with:
  ```tsx
  <PlanBadge variant="host" className="ml-auto" />
  ```

- [ ] **Step 2: Update organisation.alerts.tsx**

  In `apps/portal-web/src/routes/_portal.organisation.alerts.tsx`, make these two changes:

  Line 62 — change:
  ```tsx
  {redAlertsEnabled ? "Enabled for current plan." : "Growth Pro or above required."}
  ```
  to:
  ```tsx
  {redAlertsEnabled ? "Enabled for current plan." : "Partner or above required."}
  ```

  Line 69 — change:
  ```tsx
  Upgrade to Growth Pro
  ```
  to:
  ```tsx
  Upgrade to Partner
  ```

- [ ] **Step 3: Update organisation.billing.tsx**

  In `apps/portal-web/src/routes/_portal.organisation.billing.tsx`, line 51 — change:
  ```tsx
  <CardDescription>Essentialist</CardDescription>
  ```
  to:
  ```tsx
  <CardDescription>Host</CardDescription>
  ```

- [ ] **Step 4: Verify TypeScript compiles across the whole project**

  From the repo root:
  ```bash
  pnpm --filter portal-web exec tsc --noEmit
  ```

  Expected: No type errors related to plan tiers.

- [ ] **Step 5: Start the portal and visually verify**

  ```bash
  pnpm dev
  ```

  Open http://localhost:5173 in your browser. Log in and confirm:
  - The plan badge in the sidebar shows "Host" (not "Essentialist")
  - The billing page shows "Host" plan
  - The alerts page references "Partner" (not "Growth Pro")

  Hit Ctrl+C to stop.

- [ ] **Step 6: Commit all tier rename work**

  ```bash
  git add \
    apps/portal-web/src/lib/portal-access.ts \
    apps/portal-web/src/components/app-sidebar.tsx \
    apps/portal-web/src/routes/_portal.organisation.alerts.tsx \
    apps/portal-web/src/routes/_portal.organisation.billing.tsx \
    packages/ui/src/components/plan-badge.tsx
  git commit -m "feat: rename plan tiers to Host, Partner, Founder throughout codebase"
  ```

---

## Phase 1 Complete ✓

At this point you have:
- ✅ Supabase connected as the live database
- ✅ All 5 business tables created in Supabase
- ✅ Plan tiers renamed to Host / Partner / Founder everywhere
- ✅ Portal still runs correctly with updated terminology

**Next:** Phase 2 — The Wix Bridge (`docs/superpowers/plans/2026-04-05-phase-2-wix-bridge.md`)
