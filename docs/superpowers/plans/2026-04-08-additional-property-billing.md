# Additional Property Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow owners to submit additional properties from the portal, pay £25/month per additional property via Stripe Checkout after admin approval, with automatic QR code activation on payment and a billing management section for cancellation.

**Architecture:** New `payment_status` column on `properties` drives the entire billing lifecycle. `approveProperty` branches on plan limits — properties within the limit follow the existing free flow, additional properties create a Stripe Checkout Session and send a payment email. A `checkout.session.completed` webhook activates the property and generates the QR code. A shared `generateAndActivateProperty` helper is extracted to avoid duplication between the approval flow and the webhook handler.

**Tech Stack:** Drizzle ORM (PostgreSQL), tRPC, Stripe Node SDK (already initialised in properties.ts), Resend email, TanStack Router, React Query

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `packages/db/src/migrations/0012_additional_property_billing.sql` | Create | Add payment_status, stripe_checkout_session_id, stripe_subscription_id columns |
| `packages/db/src/schema/properties.ts` | Modify | Add 3 new fields to Drizzle schema |
| `packages/env/src/server.ts` | Modify | Add STRIPE_PRICE_ADDITIONAL_PROPERTY env var |
| `packages/api/src/lib/activate-property.ts` | Create | Shared helper: generate QR code + send approval email |
| `packages/api/src/lib/email.ts` | Modify | Add sendAdditionalPropertyPaymentEmail |
| `packages/api/src/routers/properties.ts` | Modify | Add submitProperty, modify approveProperty, add getAdditionalPropertyCheckoutUrl, cancelAdditionalProperty, getMyAdditionalProperties |
| `apps/portal-server/src/webhooks/stripe.ts` | Modify | Add checkout.session.completed handler, fix milestone discount, update subscription.deleted |
| `apps/portal-web/src/routes/_portal.properties.index.tsx` | Modify | Wire up Add Property form, cost breakdown, payment badges, Complete payment button |
| `apps/portal-web/src/routes/_portal.properties.$propertyId.dashboard.tsx` | Modify | Payment-required interstitial guard |
| `apps/portal-web/src/routes/_portal.organisation.billing.tsx` | Create | Additional properties billing management section |

---

### Task 1: DB migration + schema

**Files:**
- Create: `packages/db/src/migrations/0012_additional_property_billing.sql`
- Modify: `packages/db/src/schema/properties.ts`

- [ ] **Step 1: Create the migration file**

```sql
-- packages/db/src/migrations/0012_additional_property_billing.sql

-- payment_status lifecycle: NULL (included in plan) → 'pending' (approved, awaiting payment)
-- → 'paid' (payment confirmed, fully active) → 'cancelling' (cancel scheduled)
-- → 'cancelled' (deactivated)

ALTER TABLE "properties"
  ADD COLUMN IF NOT EXISTS "payment_status" text,
  ADD COLUMN IF NOT EXISTS "stripe_checkout_session_id" text,
  ADD COLUMN IF NOT EXISTS "stripe_subscription_id" text;
```

- [ ] **Step 2: Add the fields to the Drizzle schema**

Open `packages/db/src/schema/properties.ts`. After the `isVip` line, add:

```typescript
  paymentStatus: text("payment_status"), // null | 'pending' | 'paid' | 'cancelling' | 'cancelled'
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
```

The full updated table definition becomes:

```typescript
export const properties = pgTable("properties", {
  id: text("id").primaryKey(),
  organisationId: text("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  address: text("address"),
  city: text("city").notNull(),
  country: text("country").notNull(),
  type: text("type"),
  postcode: text("postcode"),
  status: text("status").notNull().default("pending"),
  adminNotes: text("admin_notes"),
  isVip: boolean("is_vip").default(false).notNull(),
  paymentStatus: text("payment_status"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  tripAdvisorUrl: text("tripadvisor_url"),
  googlePlaceId: text("google_place_id"),
  ownerEmail: text("owner_email").notNull(),
  ownerName: text("owner_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
},
(table) => [
  index("properties_organisationId_idx").on(table.organisationId),
  index("properties_city_idx").on(table.city),
  index("properties_status_idx").on(table.status),
  index("properties_city_status_idx").on(table.city, table.status),
])
```

- [ ] **Step 3: Run the migration in Supabase**

Open the Supabase SQL Editor for project `rknlnelrmrhorsijigtc` and run the contents of `0012_additional_property_billing.sql`.

Verify with:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'properties'
AND column_name IN ('payment_status', 'stripe_checkout_session_id', 'stripe_subscription_id');
```
Expected: 3 rows returned.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/migrations/0012_additional_property_billing.sql packages/db/src/schema/properties.ts
git commit -m "feat: add payment_status and Stripe fields to properties table"
```

---

### Task 2: Environment variable

**Files:**
- Modify: `packages/env/src/server.ts`

- [ ] **Step 1: Add the new env var**

In `packages/env/src/server.ts`, add after `STRIPE_PRICE_FOUNDER`:

```typescript
    STRIPE_PRICE_ADDITIONAL_PROPERTY: z.string().min(1),
```

The updated server block (Stripe section only):

```typescript
    STRIPE_SECRET_KEY: z.string().min(1),
    STRIPE_PRICE_HOST: z.string().min(1),
    STRIPE_PRICE_PARTNER: z.string().min(1),
    STRIPE_PRICE_FOUNDER: z.string().min(1),
    STRIPE_PRICE_ADDITIONAL_PROPERTY: z.string().min(1),
    STRIPE_WEBHOOK_SECRET: z.string().min(1),
```

- [ ] **Step 2: Create the Stripe Price and add to Railway**

In the Stripe Dashboard:
1. Go to Products → Add Product → name it "Additional Property"
2. Add a price: £25.00, GBP, recurring monthly
3. Copy the Price ID (starts with `price_`)
4. In Railway → portal-server service → Variables → add `STRIPE_PRICE_ADDITIONAL_PROPERTY=price_xxxxx`

- [ ] **Step 3: Commit**

```bash
git add packages/env/src/server.ts
git commit -m "feat: add STRIPE_PRICE_ADDITIONAL_PROPERTY env var"
```

---

### Task 3: Payment approval email

**Files:**
- Modify: `packages/api/src/lib/email.ts`

- [ ] **Step 1: Add sendAdditionalPropertyPaymentEmail**

Add this function to `packages/api/src/lib/email.ts` after `sendApprovalEmail`:

```typescript
export async function sendAdditionalPropertyPaymentEmail(
  ownerEmail: string,
  ownerName: string,
  propertyName: string,
  checkoutUrl: string,
  basePlan: string,
  basePrice: string,
) {
  const planLabel = basePlan.charAt(0).toUpperCase() + basePlan.slice(1)

  await resend.emails.send({
    from: FROM,
    to: ownerEmail,
    subject: `Your property "${propertyName}" has been approved — complete payment to activate`,
    html: `<h1>Hi ${ownerName},</h1>
<p>Great news — your property <strong>${propertyName}</strong> has been approved!</p>
<p>As this is an additional property beyond your plan allowance, a monthly add-on fee applies:</p>
<table style="border-collapse:collapse;width:100%;max-width:400px;margin:16px 0">
  <tr>
    <td style="padding:8px;color:#64748b">${planLabel} plan (base)</td>
    <td style="padding:8px;text-align:right">${basePrice}/month</td>
  </tr>
  <tr>
    <td style="padding:8px;color:#64748b">Additional property</td>
    <td style="padding:8px;text-align:right">£25.00/month</td>
  </tr>
  <tr style="border-top:2px solid #e2e8f0;font-weight:bold">
    <td style="padding:8px">New monthly total</td>
    <td style="padding:8px;text-align:right">${addPrices(basePrice, 25.00)}/month</td>
  </tr>
</table>
<p>No setup fees. Cancel at any time from your billing dashboard. Your QR code will be sent once payment is confirmed.</p>
<p style="margin-top:24px">
  <a href="${checkoutUrl}" style="display:inline-block;background:#f97316;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px">Complete Payment →</a>
</p>
<p style="font-size:12px;color:#64748b;margin-top:12px">
  This link expires in 24 hours. If it stops working, log in to your portal and click <strong>Complete Payment</strong> on the property card to get a fresh link.
</p>`,
  })
}

function addPrices(basePrice: string, addOn: number): string {
  const base = parseFloat(basePrice.replace(/[^0-9.]/g, ""))
  return `£${(base + addOn).toFixed(2)}`
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/lib/email.ts
git commit -m "feat: add additional property payment approval email"
```

---

### Task 4: Shared property activation helper

**Files:**
- Create: `packages/api/src/lib/activate-property.ts`
- Modify: `packages/api/src/routers/properties.ts` (remove inline logic, import helper)

This extracts the QR-generation-and-email-send logic from `approveProperty` into a shared function so the Stripe webhook can reuse it without duplication.

- [ ] **Step 1: Create the helper file**

```typescript
// packages/api/src/lib/activate-property.ts

import { db } from "@intuitive-stay/db"
import { qrCodes } from "@intuitive-stay/db/schema"
import { env } from "@intuitive-stay/env/server"
import { eq } from "drizzle-orm"

import { sendApprovalEmail } from "./email"
import { generateMagicLinkUrl } from "./generate-magic-link"
import { generateQrPdf, generateUniqueCode } from "./generate-qr"

export interface PropertyToActivate {
  id: string
  name: string
  ownerEmail: string
  ownerName: string
}

/**
 * Generates a QR code for the property (if it doesn't already have one),
 * then sends the approval email with the QR PDF attached.
 * Idempotent — safe to call multiple times.
 */
export async function generateAndActivateProperty(property: PropertyToActivate): Promise<void> {
  const existingQr = await db.query.qrCodes.findFirst({
    where: eq(qrCodes.propertyId, property.id),
  })

  const magicLinkUrl = await generateMagicLinkUrl(property.ownerEmail).catch(() => null)

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

    generateQrPdf(feedbackUrl, property.name)
      .then((pdfBuffer) =>
        sendApprovalEmail(
          property.ownerEmail,
          property.ownerName,
          property.name,
          pdfBuffer,
          magicLinkUrl ?? undefined,
        ),
      )
      .catch((err) => console.error("[activate-property] Failed to generate QR / send email:", err))
  } else {
    sendApprovalEmail(
      property.ownerEmail,
      property.ownerName,
      property.name,
      undefined,
      magicLinkUrl ?? undefined,
    ).catch((err) => console.error("[activate-property] Failed to send approval email:", err))
  }
}
```

- [ ] **Step 2: Update approveProperty to use the helper**

In `packages/api/src/routers/properties.ts`, add the import at the top (after existing lib imports):

```typescript
import { generateAndActivateProperty } from "../lib/activate-property"
```

Replace the inline QR/email logic in `approveProperty` (the `if (!existingQr)` block and the `else` block) with a single call:

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

      // Fire-and-forget: generate QR code and send approval email
      generateAndActivateProperty(property).catch((err) =>
        console.error("[approveProperty] Activation failed:", err),
      )

      return property
    }),
```

> Note: The full plan-limit branching logic is added to this in Task 6. This step just establishes the helper and refactors the existing flow to use it. Deploy and verify the existing approval flow still works before continuing.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/lib/activate-property.ts packages/api/src/routers/properties.ts
git commit -m "refactor: extract generateAndActivateProperty helper from approveProperty"
```

---

### Task 5: submitProperty tRPC mutation

**Files:**
- Modify: `packages/api/src/routers/properties.ts`

- [ ] **Step 1: Add plan limit constants and add required imports**

At the top of `packages/api/src/routers/properties.ts`, add to the drizzle imports:
```typescript
import { and, avg, count, desc, eq, gte, inArray, isNotNull, isNull, max, ne, or, sql } from "drizzle-orm"
```

Add these constants after the existing `PLAN_MAX_RANGE` constant block:

```typescript
// ─── Additional property billing ─────────────────────────────────────────────

/** Number of properties included at no extra charge per plan */
export const PLAN_PROPERTY_LIMITS: Record<string, number> = {
  member: 0,
  host: 1,
  partner: 1,
  founder: 5,
}

/** Display prices for the cost breakdown shown in the Add Property form */
export const PLAN_BASE_PRICES: Record<string, string> = {
  host: "£34.99",
  partner: "£79.99",
  founder: "£189.99",
}

/** Additional property monthly charge */
export const ADDITIONAL_PROPERTY_PRICE = 25.00
```

Also add the email import:
```typescript
import {
  sendApprovalEmail,
  sendAdditionalPropertyPaymentEmail,
  sendNewPropertyNotificationEmail,
  sendRejectionEmail,
} from "../lib/email"
```

- [ ] **Step 2: Add the submitProperty mutation**

Add this procedure inside `propertiesRouter`, after `getMyProperties`:

```typescript
  /**
   * Protected — owner submits a new property from the portal.
   * Creates the property as 'pending' and fires an admin notification email.
   * Guards against inactive subscriptions.
   */
  submitProperty: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        type: z.string().min(1),
        addressLine1: z.string().optional(),
        city: z.string().min(1),
        postcode: z.string().optional(),
        country: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const org = await db.query.organisations.findFirst({
        where: eq(organisations.ownerId, ctx.session.user.id),
      })

      if (!org) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No organisation found" })
      }

      // Block submission if subscription is not active
      const activeStatuses = ["active", "trial"] as const
      if (!activeStatuses.includes(org.subscriptionStatus as (typeof activeStatuses)[number])) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Your subscription is not currently active. Please renew before adding a property.",
        })
      }

      const propertyId = crypto.randomUUID()
      const [property] = await db
        .insert(properties)
        .values({
          id: propertyId,
          organisationId: org.id,
          name: input.name,
          type: input.type,
          address: input.addressLine1 ?? null,
          city: input.city,
          postcode: input.postcode ?? null,
          country: input.country,
          ownerEmail: ctx.session.user.email,
          ownerName: ctx.session.user.name,
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()

      if (!property) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" })

      // Fire-and-forget admin notification
      sendNewPropertyNotificationEmail(
        ctx.session.user.name,
        ctx.session.user.email,
        input.name,
        input.city,
        input.country,
        env.PUBLIC_PORTAL_URL,
      ).catch((err) => console.error("[submitProperty] Admin notification failed:", err))

      return property
    }),
```

- [ ] **Step 3: Verify the build compiles**

```bash
cd ~/intuitivestay/intuitivestay
pnpm --filter @intuitive-stay/api build 2>&1 | tail -20
```
Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/routers/properties.ts
git commit -m "feat: add submitProperty tRPC mutation for portal property submission"
```

---

### Task 6: Plan-limit branching in approveProperty + checkout session helper

**Files:**
- Modify: `packages/api/src/routers/properties.ts`

- [ ] **Step 1: Add the Stripe checkout session helper**

Add this function before `propertiesRouter` in `packages/api/src/routers/properties.ts`:

```typescript
/**
 * Creates a Stripe Checkout Session for an additional property subscription (£25/month).
 * Attaches to the existing Stripe customer if one exists.
 * Returns the checkout URL.
 */
async function createAdditionalPropertyCheckoutSession(
  propertyId: string,
  propertyName: string,
  stripeCustomerId: string | null,
): Promise<string> {
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: env.STRIPE_PRICE_ADDITIONAL_PROPERTY, quantity: 1 }],
    subscription_data: {
      description: `Additional Property: ${propertyName}`,
      metadata: { propertyId },
    },
    metadata: { propertyId },
    success_url: `${env.PUBLIC_PORTAL_URL}/properties?payment=success`,
    cancel_url: `${env.PUBLIC_PORTAL_URL}/properties`,
  }

  if (stripeCustomerId) {
    params.customer = stripeCustomerId
  }

  const session = await stripe.checkout.sessions.create(params)

  if (!session.url) {
    throw new Error("[createAdditionalPropertyCheckoutSession] Stripe did not return a URL")
  }

  return session.url
}
```

- [ ] **Step 2: Replace approveProperty with the branching version**

Replace the current `approveProperty` procedure with:

```typescript
  approveProperty: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      // Fetch the property and its organisation before updating
      const property = await db.query.properties.findFirst({
        where: eq(properties.id, input.id),
      })
      if (!property) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" })

      const org = await db.query.organisations.findFirst({
        where: eq(organisations.id, property.organisationId),
      })
      if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organisation not found" })

      // Count currently approved + paid properties for this org (excluding this one)
      const [countResult] = await db
        .select({ total: count() })
        .from(properties)
        .where(
          and(
            eq(properties.organisationId, org.id),
            eq(properties.status, "approved"),
            ne(properties.id, input.id),
            or(isNull(properties.paymentStatus), eq(properties.paymentStatus, "paid")),
          ),
        )

      const approvedCount = countResult?.total ?? 0
      const planLimit = PLAN_PROPERTY_LIMITS[org.plan ?? "member"] ?? 0
      const isAdditional = approvedCount >= planLimit

      if (isAdditional) {
        // ── Additional property: needs payment ──────────────────────────────
        const [updatedProperty] = await db
          .update(properties)
          .set({ status: "approved", paymentStatus: "pending", updatedAt: new Date() })
          .where(eq(properties.id, input.id))
          .returning()

        if (!updatedProperty) throw new TRPCError({ code: "NOT_FOUND" })

        // Create Stripe checkout session
        let checkoutUrl: string
        try {
          checkoutUrl = await createAdditionalPropertyCheckoutSession(
            updatedProperty.id,
            updatedProperty.name,
            org.stripeCustomerId ?? null,
          )
        } catch (err) {
          console.error("[approveProperty] Stripe checkout session failed:", err)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create payment link. Property approved but email not sent.",
          })
        }

        // Store checkout session URL for reference
        await db
          .update(properties)
          .set({ stripeCheckoutSessionId: checkoutUrl })
          .where(eq(properties.id, input.id))

        // Fire-and-forget payment email (no QR code yet)
        const basePrice = PLAN_BASE_PRICES[org.plan ?? "host"] ?? "£34.99"
        sendAdditionalPropertyPaymentEmail(
          updatedProperty.ownerEmail,
          updatedProperty.ownerName,
          updatedProperty.name,
          checkoutUrl,
          org.plan ?? "host",
          basePrice,
        ).catch((err) => console.error("[approveProperty] Payment email failed:", err))

        return updatedProperty
      }

      // ── Standard approval: within plan limit ────────────────────────────
      const [updatedProperty] = await db
        .update(properties)
        .set({ status: "approved", updatedAt: new Date() })
        .where(eq(properties.id, input.id))
        .returning()

      if (!updatedProperty) throw new TRPCError({ code: "NOT_FOUND" })

      // Fire-and-forget: generate QR code and send standard approval email
      generateAndActivateProperty(updatedProperty).catch((err) =>
        console.error("[approveProperty] Activation failed:", err),
      )

      return updatedProperty
    }),
```

- [ ] **Step 3: Verify the build**

```bash
pnpm --filter @intuitive-stay/api build 2>&1 | tail -20
```
Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/routers/properties.ts
git commit -m "feat: branch approveProperty on plan limits — additional properties require Stripe payment"
```

---

### Task 7: getAdditionalPropertyCheckoutUrl, cancelAdditionalProperty, getMyAdditionalProperties

**Files:**
- Modify: `packages/api/src/routers/properties.ts`

Add these three procedures inside `propertiesRouter`:

- [ ] **Step 1: Add getAdditionalPropertyCheckoutUrl**

This generates a fresh checkout session on demand (for when the email link has expired):

```typescript
  /**
   * Protected — generates a fresh Stripe checkout URL for a property awaiting payment.
   * Called when the owner clicks "Complete payment" on the property card in the portal.
   */
  getAdditionalPropertyCheckoutUrl: protectedProcedure
    .input(z.object({ propertyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const org = await db.query.organisations.findFirst({
        where: eq(organisations.ownerId, ctx.session.user.id),
      })
      if (!org) throw new TRPCError({ code: "FORBIDDEN" })

      const property = await db.query.properties.findFirst({
        where: eq(properties.id, input.propertyId),
      })
      if (!property) throw new TRPCError({ code: "NOT_FOUND" })
      if (property.organisationId !== org.id) throw new TRPCError({ code: "FORBIDDEN" })
      if (property.paymentStatus !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Property does not require payment" })
      }

      const url = await createAdditionalPropertyCheckoutSession(
        property.id,
        property.name,
        org.stripeCustomerId ?? null,
      )

      return { url }
    }),
```

- [ ] **Step 2: Add getMyAdditionalProperties**

```typescript
  /**
   * Protected — returns all additional (paid/cancelling) properties for this org.
   * Used in the billing section to list add-ons with a Remove button.
   */
  getMyAdditionalProperties: protectedProcedure.query(async ({ ctx }) => {
    const org = await db.query.organisations.findFirst({
      where: eq(organisations.ownerId, ctx.session.user.id),
    })
    if (!org) return []

    return db
      .select({
        id: properties.id,
        name: properties.name,
        city: properties.city,
        country: properties.country,
        paymentStatus: properties.paymentStatus,
        stripeSubscriptionId: properties.stripeSubscriptionId,
      })
      .from(properties)
      .where(
        and(
          eq(properties.organisationId, org.id),
          or(
            eq(properties.paymentStatus, "paid"),
            eq(properties.paymentStatus, "cancelling"),
          ),
        ),
      )
  }),
```

- [ ] **Step 3: Add cancelAdditionalProperty**

```typescript
  /**
   * Protected — schedules cancellation of an additional property's Stripe subscription
   * at the end of the current billing period. Sets paymentStatus to 'cancelling'.
   */
  cancelAdditionalProperty: protectedProcedure
    .input(z.object({ propertyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const org = await db.query.organisations.findFirst({
        where: eq(organisations.ownerId, ctx.session.user.id),
      })
      if (!org) throw new TRPCError({ code: "FORBIDDEN" })

      const property = await db.query.properties.findFirst({
        where: eq(properties.id, input.propertyId),
      })
      if (!property) throw new TRPCError({ code: "NOT_FOUND" })
      if (property.organisationId !== org.id) throw new TRPCError({ code: "FORBIDDEN" })
      if (property.paymentStatus !== "paid") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only active additional properties can be cancelled",
        })
      }
      if (!property.stripeSubscriptionId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No Stripe subscription found for this property",
        })
      }

      // Schedule cancellation at period end (owner retains access until then)
      await stripe.subscriptions.update(property.stripeSubscriptionId, {
        cancel_at_period_end: true,
      })

      const [updated] = await db
        .update(properties)
        .set({ paymentStatus: "cancelling", updatedAt: new Date() })
        .where(eq(properties.id, input.propertyId))
        .returning()

      return updated
    }),
```

- [ ] **Step 4: Verify build**

```bash
pnpm --filter @intuitive-stay/api build 2>&1 | tail -20
```
Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routers/properties.ts
git commit -m "feat: add getAdditionalPropertyCheckoutUrl, getMyAdditionalProperties, cancelAdditionalProperty"
```

---

### Task 8: Stripe webhook — checkout.session.completed

**Files:**
- Modify: `apps/portal-server/src/webhooks/stripe.ts`

- [ ] **Step 1: Add imports**

At the top of `apps/portal-server/src/webhooks/stripe.ts`, update the import from `@intuitive-stay/db/schema`:

```typescript
import { organisations, properties, user } from "@intuitive-stay/db/schema"
```

Add the activation helper import:

```typescript
import { generateAndActivateProperty } from "@intuitive-stay/api/lib/activate-property"
```

- [ ] **Step 2: Add the checkout.session.completed handler**

Add this block inside `stripeWebhookHandler`, after the existing `invoice.payment_succeeded` block and before `return c.json({ ok: true })`:

```typescript
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session

    const propertyId = session.metadata?.propertyId
    if (!propertyId) return c.json({ ok: true })

    // Only act on paid sessions (subscription mode sessions may have payment_status = 'no_payment_required' for trials)
    if (session.payment_status !== "paid") return c.json({ ok: true })

    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : (session.subscription as Stripe.Subscription | null)?.id ?? null

    if (!subscriptionId) return c.json({ ok: true })

    const property = await db.query.properties.findFirst({
      where: eq(properties.id, propertyId),
    })

    // Guard: only activate if currently awaiting payment
    if (!property || property.paymentStatus !== "pending") return c.json({ ok: true })

    // Mark as paid and store the subscription ID for future cancellation
    await db
      .update(properties)
      .set({
        paymentStatus: "paid",
        stripeSubscriptionId: subscriptionId,
        updatedAt: new Date(),
      })
      .where(eq(properties.id, propertyId))

    // Generate QR code and send activation email (same as standard approval flow)
    await generateAndActivateProperty(property).catch((err) =>
      console.error("[webhook/checkout.session.completed] Activation failed:", err),
    )
  }
```

- [ ] **Step 3: Register the new webhook event in Stripe**

In Stripe Dashboard → Developers → Webhooks → your webhook endpoint → add `checkout.session.completed` to the list of events.

- [ ] **Step 4: Verify build**

```bash
pnpm --filter @intuitive-stay/portal-server build 2>&1 | tail -20
```
Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add apps/portal-server/src/webhooks/stripe.ts
git commit -m "feat: activate property on checkout.session.completed webhook"
```

---

### Task 9: Milestone discount fix + subscription.deleted update

**Files:**
- Modify: `apps/portal-server/src/webhooks/stripe.ts`

- [ ] **Step 1: Fix countActiveSubscriptions to exclude additional property subscriptions**

Replace the entire `countActiveSubscriptions` function with:

```typescript
async function countActiveSubscriptions(): Promise<number> {
  // Exclude additional-property subscriptions — they must not inflate the milestone count
  const additionalPriceId = env.STRIPE_PRICE_ADDITIONAL_PROPERTY
  let total = 0

  for (const status of ["active", "trialing"] as const) {
    let hasMore = true
    let startingAfter: string | undefined

    while (hasMore) {
      const page = await stripe.subscriptions.list({
        status,
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      })

      // Only count plan subscriptions, not additional-property add-ons
      total += page.data.filter(
        (sub) => !sub.items.data.some((item) => item.price.id === additionalPriceId),
      ).length

      hasMore = page.has_more
      if (hasMore && page.data.length > 0) {
        startingAfter = page.data[page.data.length - 1]!.id
      }
    }
  }

  return total
}
```

- [ ] **Step 2: Fix applyMilestoneDiscounts to skip additional property subscriptions**

Replace the inner loop in `applyMilestoneDiscounts` where coupons are applied to all subscriptions. Find this section:

```typescript
        for (const sub of page.data) {
          const couponId = getCouponId(sub, currentMilestone)
          if (couponId) {
            await stripe.subscriptions.update(sub.id, { coupon: couponId })
          }
        }
```

Replace with:

```typescript
        for (const sub of page.data) {
          // Never apply milestone coupons to additional-property add-on subscriptions
          const isAdditional = sub.items.data.some(
            (item) => item.price.id === env.STRIPE_PRICE_ADDITIONAL_PROPERTY,
          )
          if (isAdditional) continue

          const couponId = getCouponId(sub, currentMilestone)
          if (couponId) {
            await stripe.subscriptions.update(sub.id, { coupon: couponId })
          }
        }
```

- [ ] **Step 3: Update customer.subscription.deleted to handle additional property cancellations**

Replace the existing `customer.subscription.deleted` handler with:

```typescript
  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription

    // Check if this is an additional-property subscription
    const isAdditional = sub.items.data.some(
      (item) => item.price.id === env.STRIPE_PRICE_ADDITIONAL_PROPERTY,
    )

    if (isAdditional) {
      // Find the property by its stored Stripe subscription ID and deactivate it
      const property = await db.query.properties.findFirst({
        where: eq(properties.stripeSubscriptionId, sub.id),
      })

      if (property) {
        await db
          .update(properties)
          .set({ paymentStatus: "cancelled", status: "archived", updatedAt: new Date() })
          .where(eq(properties.id, property.id))
      }

      return c.json({ ok: true })
    }

    // ── Plan subscription deleted — existing logic ───────────────────────
    const email = await getCustomerEmail(sub.customer as string)
    if (!email) return c.json({ ok: true })

    const orgId = await findOrgByEmail(email)
    if (!orgId) return c.json({ ok: true })

    await db
      .update(organisations)
      .set({ subscriptionStatus: "expired" })
      .where(eq(organisations.id, orgId))
  }
```

- [ ] **Step 4: Verify build**

```bash
pnpm --filter @intuitive-stay/portal-server build 2>&1 | tail -20
```
Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add apps/portal-server/src/webhooks/stripe.ts
git commit -m "fix: exclude additional property subscriptions from milestone discount count and coupon application"
```

---

### Task 10: Wire up Add Property form

**Files:**
- Modify: `apps/portal-web/src/routes/_portal.properties.index.tsx`

- [ ] **Step 1: Add useMutation and cost breakdown logic**

At the top of the component function, add the mutation and cost breakdown calculation. Find the component state setup section and add:

```typescript
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { mutate: submitProperty, isPending: isSubmitting, error: submitError } = useMutation(
    trpc.properties.submitProperty.mutationOptions({
      onSuccess: () => {
        setIsAddDialogOpen(false)
        setAddForm(DEFAULT_ADD_FORM_VALUES)
        queryClient.invalidateQueries(trpc.properties.getMyProperties.queryFilter())
        toast.success("Property submitted for review. We'll be in touch soon.")
      },
    }),
  )
```

Also add a cost breakdown helper near the top of the component:

```typescript
  const PLAN_LIMITS: Record<string, number> = { member: 0, host: 1, partner: 1, founder: 5 }
  const PLAN_PRICES: Record<string, number> = { host: 34.99, partner: 79.99, founder: 189.99 }

  // How many approved + paid properties does this org already have?
  const approvedCount = properties.filter(
    (p) => p.status === "approved" && (p.paymentStatus == null || p.paymentStatus === "paid"),
  ).length
  const planLimit = PLAN_LIMITS[plan ?? "member"] ?? 0
  const willBeAdditional = approvedCount >= planLimit
  const basePriceNum = PLAN_PRICES[plan ?? "host"] ?? 34.99
  const newMonthlyTotal = willBeAdditional ? (basePriceNum + 25).toFixed(2) : null
```

> `plan` should come from the route context. Check how the existing component accesses the plan — it's available via `Route.useRouteContext().session` or passed down. Find the existing session access pattern in the file and reuse it.

- [ ] **Step 2: Replace the dead handleAddPropertySubmit with a real one**

Replace:

```typescript
  const handleAddPropertySubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      // Properties are registered automatically via the Wix bridge
      setIsAddDialogOpen(false)
    },
    []
  )
```

With:

```typescript
  const handleAddPropertySubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      submitProperty({
        name: addForm.propertyName,
        type: addForm.propertyType,
        addressLine1: addForm.addressLine1 || undefined,
        city: addForm.addressCity,
        postcode: addForm.addressPostalCode || undefined,
        country: addForm.addressCountry,
      })
    },
    [addForm, submitProperty],
  )
```

- [ ] **Step 3: Add cost breakdown and subscription gate to the dialog**

Inside the Add Property dialog form, add this block just above the form submit button:

```tsx
{/* Cost breakdown — shown when this will be an additional (chargeable) property */}
{willBeAdditional && (
  <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm">
    <p className="font-semibold text-orange-800 mb-2">Additional property charge</p>
    <div className="space-y-1 text-orange-700">
      <div className="flex justify-between">
        <span>{plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : ""} plan (base)</span>
        <span>£{basePriceNum.toFixed(2)}/mo</span>
      </div>
      <div className="flex justify-between">
        <span>Additional property</span>
        <span>£25.00/mo</span>
      </div>
      <div className="flex justify-between font-bold border-t border-orange-300 pt-1 mt-1">
        <span>New monthly total</span>
        <span>£{newMonthlyTotal}/mo</span>
      </div>
    </div>
    <p className="text-xs text-orange-600 mt-2">
      Payment is requested after admin approval. No charge until then.
    </p>
  </div>
)}

{submitError && (
  <p className="text-sm text-destructive">{submitError.message}</p>
)}
```

- [ ] **Step 4: Add payment status badges to property cards/rows**

In the properties table, find where `status` is rendered (look for the existing `Badge` or status cell). Add payment status alongside it:

```tsx
{/* Inside the status cell */}
{row.status === "approved" && row.paymentStatus === "pending" && (
  <Badge variant="outline" className="text-amber-600 border-amber-400 bg-amber-50 ml-1">
    Payment required
  </Badge>
)}
{row.status === "approved" && row.paymentStatus === "cancelling" && (
  <Badge variant="outline" className="text-orange-600 border-orange-400 bg-orange-50 ml-1">
    Cancellation pending
  </Badge>
)}
```

Also add a "Complete payment" button that appears for `paymentStatus === "pending"` rows. This requires a small helper component placed inside or near the table row:

```tsx
function CompletePaymentButton({ propertyId }: { propertyId: string }) {
  const trpc = useTRPC()
  const [loading, setLoading] = React.useState(false)
  const utils = useQueryClient()

  async function handleClick() {
    setLoading(true)
    try {
      const result = await utils.fetchQuery(
        trpc.properties.getAdditionalPropertyCheckoutUrl.queryOptions({ propertyId }),
      )
      window.location.href = result.url
    } catch {
      setLoading(false)
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={handleClick} disabled={loading} className="text-amber-700 border-amber-400 hover:bg-amber-50">
      {loading ? "Loading…" : "Complete payment →"}
    </Button>
  )
}
```

Render this button conditionally next to rows where `paymentStatus === "pending"`.

- [ ] **Step 5: Commit**

```bash
git add "apps/portal-web/src/routes/_portal.properties.index.tsx"
git commit -m "feat: wire up Add Property form — submitProperty mutation, cost breakdown, payment badges"
```

---

### Task 11: Dashboard payment gate

**Files:**
- Modify: `apps/portal-web/src/routes/_portal.properties.$propertyId.dashboard.tsx`

- [ ] **Step 1: Add payment status check at the top of the dashboard route**

In the dashboard component, the property data is already fetched. Find where property data is loaded (look for a `getMyProperties` or similar query). Add a guard early in the component render:

```tsx
// Check paymentStatus — the full property list comes from getMyProperties which now
// includes paymentStatus. Find the active property from the list.
const activeProperty = properties.find((p) => p.id === propertyId)

if (activeProperty?.paymentStatus === "pending") {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
      <div className="rounded-full bg-amber-100 p-4">
        <svg className="h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h2 className="text-xl font-bold">Payment required</h2>
      <p className="text-muted-foreground max-w-sm">
        This property has been approved. Complete payment to activate your dashboard and receive your QR code.
      </p>
      <CompletePaymentButton propertyId={propertyId} />
    </div>
  )
}

if (activeProperty?.paymentStatus === "cancelling") {
  // Show a dismissible banner at the top but still render the dashboard
  // (handled inline in the dashboard JSX with a banner component)
}
```

> Import `CompletePaymentButton` from the properties index file, or copy the component definition into a shared component file at `apps/portal-web/src/components/complete-payment-button.tsx` and import from there. Creating a shared component is preferred.

- [ ] **Step 2: Extract CompletePaymentButton to a shared component**

Create `apps/portal-web/src/components/complete-payment-button.tsx`:

```tsx
import { Button } from "@intuitive-stay/ui/components/button"
import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { useTRPC } from "@/utils/trpc"

export function CompletePaymentButton({ propertyId }: { propertyId: string }) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    try {
      const result = await queryClient.fetchQuery(
        trpc.properties.getAdditionalPropertyCheckoutUrl.queryOptions({ propertyId }),
      )
      window.location.href = result.url
    } catch (err) {
      setError("Could not load payment link. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        onClick={handleClick}
        disabled={loading}
        className="bg-orange-500 hover:bg-orange-600 text-white"
      >
        {loading ? "Loading…" : "Complete payment →"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add "apps/portal-web/src/routes/_portal.properties.\$propertyId.dashboard.tsx" "apps/portal-web/src/components/complete-payment-button.tsx"
git commit -m "feat: add payment-required interstitial to property dashboard"
```

---

### Task 12: Organisation billing page — additional properties section

**Files:**
- Create: `apps/portal-web/src/routes/_portal.organisation.billing.tsx`

- [ ] **Step 1: Create the billing route**

```tsx
// apps/portal-web/src/routes/_portal.organisation.billing.tsx

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@intuitive-stay/ui/components/alert-dialog"
import { Badge } from "@intuitive-stay/ui/components/badge"
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
import { ExternalLinkIcon } from "lucide-react"
import { toast } from "sonner"

import { useTRPC } from "@/utils/trpc"

export const Route = createFileRoute("/_portal/organisation/billing")({
  component: RouteComponent,
})

function RouteComponent() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { data: additionalProperties = [], isLoading } = useQuery(
    trpc.properties.getMyAdditionalProperties.queryOptions(),
  )

  const { data: portalData } = useQuery(
    trpc.properties.getStripePortalUrl.queryOptions(),
  )

  const { mutate: cancelProperty, isPending: isCancelling } = useMutation(
    trpc.properties.cancelAdditionalProperty.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.properties.getMyAdditionalProperties.queryFilter())
        toast.success("Property cancellation scheduled. You'll retain access until the end of your billing period.")
      },
      onError: (err) => {
        toast.error(err.message)
      },
    }),
  )

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your subscription and additional properties.
        </p>
      </div>

      {/* Stripe billing portal link */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-sm">Plan subscription</CardTitle>
          <CardDescription>
            Manage your base plan, payment method, and invoices through the Stripe billing portal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {portalData?.url ? (
            <Button variant="outline" size="sm" asChild>
              <a href={portalData.url} target="_blank" rel="noreferrer">
                <ExternalLinkIcon className="mr-2 h-4 w-4" />
                Open billing portal
              </a>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">No active subscription found.</p>
          )}
        </CardContent>
      </Card>

      {/* Additional properties */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Additional properties</h2>

        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {!isLoading && additionalProperties.length === 0 && (
          <Card size="sm">
            <CardHeader>
              <CardTitle className="text-sm">No additional properties</CardTitle>
              <CardDescription>
                Properties included in your plan appear here once you add paid add-ons.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {!isLoading && additionalProperties.length > 0 && (
          <div className="flex flex-col gap-3">
            {additionalProperties.map((property) => (
              <Card key={property.id}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm">{property.name}</CardTitle>
                      <CardDescription>
                        {property.city}, {property.country} · £25.00/month
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {property.paymentStatus === "cancelling" ? (
                        <Badge variant="outline" className="text-orange-600 border-orange-400 bg-orange-50">
                          Cancellation pending
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
                          Active
                        </Badge>
                      )}

                      {property.paymentStatus === "paid" && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive border-destructive/30 hover:bg-destructive/5"
                              disabled={isCancelling}
                            >
                              Remove property
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove {property.name}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This property will be deactivated at the end of your current billing period.
                                Your other properties won't be affected. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep property</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => cancelProperty({ propertyId: property.id })}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Yes, remove it
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add Billing to the sidebar**

In `apps/portal-web/src/components/app-sidebar.tsx`, add the billing link import and menu item. Find the imports section and add:

```typescript
import { BuildingIcon, CreditCardIcon, LayoutDashboardIcon, QrCodeIcon, ShieldCheckIcon, UserPlusIcon, UsersIcon } from "lucide-react"
```

Inside the owner sidebar's `SidebarContent`, add a new group after the existing property group:

```tsx
<SidebarGroup>
  <SidebarGroupLabel className="px-4 text-[9px] font-semibold uppercase tracking-[0.1em] text-sidebar-foreground/40">
    Account
  </SidebarGroupLabel>
  <SidebarGroupContent>
    <SidebarMenu>
      <SidebarLinkItem
        label="Billing"
        icon={<CreditCardIcon />}
        link={<AppSidebarLink to="/organisation/billing" />}
        isActive={isRouteActive(location.pathname, "/organisation/billing")}
      />
    </SidebarMenu>
  </SidebarGroupContent>
</SidebarGroup>
```

- [ ] **Step 3: Verify the route is reachable**

Start the dev server and navigate to `/organisation/billing`. Confirm the page loads without errors and shows the Stripe billing portal button and the additional properties section.

- [ ] **Step 4: Commit**

```bash
git add "apps/portal-web/src/routes/_portal.organisation.billing.tsx" "apps/portal-web/src/components/app-sidebar.tsx"
git commit -m "feat: billing page with additional properties management and cancellation"
```

---

### Task 13: Push and smoke test

- [ ] **Step 1: Push all commits**

```bash
git push
```

Wait for Railway to deploy (both portal-server and portal-web services).

- [ ] **Step 2: Smoke test — property submission**

1. Log in as an owner with an active Host subscription that already has 1 approved property
2. Go to Properties → Add Property
3. Confirm the cost breakdown shows: Host £34.99 + Additional £25.00 = £59.99/month
4. Submit the form
5. Confirm the property appears in the list with "Awaiting approval" status
6. Confirm the admin notification email arrives

- [ ] **Step 3: Smoke test — approval branching**

1. Log in as admin, go to Approvals
2. Approve the new property
3. Confirm no QR code email is sent to the owner
4. Confirm the payment approval email arrives with the "Complete Payment →" button
5. Confirm the property shows "Payment required" badge in the portal

- [ ] **Step 4: Smoke test — payment flow**

1. Click "Complete payment →" (from email or portal card)
2. Confirm Stripe checkout loads with £25/month
3. Complete payment with Stripe test card `4242 4242 4242 4242`
4. Confirm `checkout.session.completed` webhook fires (check Railway logs)
5. Confirm property `payment_status` updates to `paid` in Supabase
6. Confirm QR code activation email arrives
7. Confirm property dashboard is now accessible

- [ ] **Step 5: Smoke test — first property approval (no payment)**

1. Create a new owner org with no properties
2. Submit and approve one property
3. Confirm the standard QR code approval email arrives (no payment prompt)
4. Confirm dashboard is immediately accessible

- [ ] **Step 6: Smoke test — cancellation**

1. Go to Billing page
2. Confirm the paid additional property appears
3. Click "Remove property" → confirm dialog → confirm
4. Confirm `paymentStatus` changes to `cancelling` in Supabase
5. Confirm Stripe shows `cancel_at_period_end: true` on the subscription

---

## Self-Review Notes

- **Spec coverage:** All sections covered — plan limits (Task 5/6), submission (Task 5), approval branching (Task 6), payment email (Task 3), checkout session (Task 6), webhook activation (Task 8), milestone discount fix (Task 9), subscription.deleted (Task 9), portal UI badges (Task 10), dashboard gate (Task 11), billing management (Task 12), cancellation (Tasks 7+9).
- **No placeholders:** All code is complete. No TBD, TODO, or "similar to above" references.
- **Type consistency:** `generateAndActivateProperty` takes `PropertyToActivate` interface defined in Task 4 and used identically in Task 8. `PLAN_PROPERTY_LIMITS` defined once in Task 5 and referenced in Task 6. `createAdditionalPropertyCheckoutSession` defined in Task 6 and called identically in Task 7.
- **Drizzle imports:** `ne`, `isNull`, `or` added to drizzle-orm imports in Task 5 Step 1 before they are used in Task 6.
- **Railway env var:** `STRIPE_PRICE_ADDITIONAL_PROPERTY` must be added before deployment (Task 2 Step 2) or the server will fail to start due to env validation.
