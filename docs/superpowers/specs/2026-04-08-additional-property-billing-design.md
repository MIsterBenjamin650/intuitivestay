# Additional Property Billing — Design Spec

**Date:** 2026-04-08  
**Status:** Approved for implementation

---

## Overview

Owners can add properties beyond those included in their plan for £25/month each, billed on top of their base subscription. The system handles submission, admin approval, Stripe payment, and property activation automatically — no manual steps required.

---

## Plan Limits

| Plan    | Properties included | Additional property cost |
|---------|---------------------|--------------------------|
| Host    | 1                   | £25/month each           |
| Partner | 1                   | £25/month each           |
| Founder | 5                   | £25/month each           |
| Member  | 0 (no active plan)  | n/a — must choose a plan first |

Only `approved` properties with `payment_status = null` (plan-included) or `payment_status = paid` count toward the plan limit. Properties that are `pending` admin review or `awaiting_payment` do not consume a slot until payment is confirmed.

---

## Plan Base Prices (for cost breakdown display in UI)

| Plan    | Base price  |
|---------|-------------|
| Host    | £34.99/month |
| Partner | £TBC/month  |
| Founder | £TBC/month  |

> **Note:** Partner and Founder base prices must be confirmed and hardcoded in the frontend before deployment.

---

## Data Model Changes

### `properties` table — three new columns

| Column | Type | Values |
|--------|------|--------|
| `payment_status` | text, nullable | `null` = included in plan · `pending` = awaiting payment · `paid` = active · `cancelling` = cancel scheduled at period end · `cancelled` = deactivated |
| `stripe_checkout_session_id` | text, nullable | Checkout session ID created at approval time (for reference/debugging) |
| `stripe_subscription_id` | text, nullable | Stripe subscription ID once payment confirmed — used for cancellation |

No changes to the `organisations` table.

---

## Full User Journey

### 1. Owner submits a property

- Owner clicks **Add Property** in the portal properties page
- Form collects: property name, type, address, city, postcode, country
- If this will be an additional (chargeable) property, the form shows a cost breakdown before submission:

  > **Host plan** — £34.99/month  
  > **+ 1 additional property** — £25.00/month  
  > **New monthly total — £59.99/month**

- If the owner's subscription is not `active` or `trial`, submission is blocked:  
  *"Your subscription isn't currently active. Please renew before adding a property."*
- On submit: `submitProperty` tRPC mutation creates the property with `status = pending`, `payment_status = null`. Admin notification email fires (existing behaviour).

### 2. Admin approves

Admin clicks **Approve** in the admin approvals panel. Server runs:

```
approvedCount = count of org's properties where:
  status = 'approved'
  AND (payment_status IS NULL OR payment_status = 'paid')

planLimit = PLAN_LIMITS[org.plan]
// { member: 0, host: 1, partner: 1, founder: 5 }

isAdditional = approvedCount >= planLimit
```

**Path A — within plan limit (`isAdditional = false`):**
- `status → approved`, `payment_status` stays `null`
- QR code generated, standard approval email with QR PDF sent
- Owner accesses dashboard immediately

**Path B — additional property (`isAdditional = true`):**
- `status → approved`, `payment_status → pending`
- Server creates a Stripe Checkout Session:
  - `mode: subscription`
  - `customer: org.stripeCustomerId` (if set; otherwise omit and let Stripe collect it)
  - `line_items: [{ price: STRIPE_PRICE_ADDITIONAL_PROPERTY, quantity: 1 }]`
  - `subscription_data.description: "Additional Property: {property.name}"`
  - `metadata: { propertyId: property.id }`
  - `success_url: {PUBLIC_PORTAL_URL}/properties?payment=success`
  - `cancel_url: {PUBLIC_PORTAL_URL}/properties`
- `stripe_checkout_session_id` stored on the property
- **Payment approval email** sent (no QR code attached):
  - Subject: *"Your property has been approved — complete payment to activate"*
  - Body: property name, cost breakdown, **Complete Payment →** button

### 3. Owner pays

Owner clicks the button in the email (or **Complete Payment →** in the portal). Stripe checkout session opens.

Stripe fires `checkout.session.completed`:
- Server reads `session.metadata.propertyId`
- `payment_status → paid`
- `stripe_subscription_id` stored from `session.subscription`
- QR code generated for the property
- Standard QR code / activation email sent to owner

### 4. What the owner sees in the portal

**Before payment (`payment_status = pending`):**
- Property card shows amber **"Payment required"** badge
- **Complete payment →** button — generates a fresh Stripe checkout session on click (avoids 24h email link expiry)
- Property dashboard, feedback log, and QR code are inaccessible (redirects to a payment-required interstitial)

**After payment (`payment_status = paid`):**
- Property fully accessible
- Billing section lists it as an additional property with monthly cost and next billing date

---

## Cancelling an Additional Property

Owner goes to the **Billing** section of the portal. Additional properties (`payment_status = paid`) are listed with their cost and a **Remove property** button.

**Cancellation flow:**
1. Owner clicks **Remove property**
2. Confirmation dialog: *"[Property name] will be deactivated at the end of your current billing period on [date]. Your other properties won't be affected."*
3. On confirm: server calls `stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true })`
4. `payment_status → cancelling` — property remains accessible until period end
5. Stripe fires `customer.subscription.deleted` at period end → `payment_status → cancelled`, `status → archived`, QR code deactivated

---

## Stripe Subscription Structure

Each additional property has its **own** Stripe subscription (£25/month). This means:
- Owners with multiple additional properties receive multiple invoices per month (one per additional property)
- Each subscription can be cancelled independently without affecting others
- The `subscription_data.description` on each checkout session names the property so invoices are identifiable

This is simpler to implement than a single multi-item subscription and can be consolidated later if needed.

---

## Stripe Webhook Additions

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Read `metadata.propertyId` → `payment_status = paid`, store `stripe_subscription_id`, generate QR code, send activation email |
| `customer.subscription.deleted` | Existing handler sets org `subscriptionStatus = expired` for plan subscriptions. **New:** if `stripe_subscription_id` matches a property → `payment_status = cancelled`, `status = archived` |

---

## Portal UI Changes

### Properties page (`/properties`)
- **Add Property** form wired to `submitProperty` mutation
- Cost breakdown shown when additional charge applies
- Subscription status gate (block if expired/none)
- Property cards show `payment_status` badge:
  - Amber "Payment required" + **Complete payment →** button
  - Orange "Cancellation pending" for `payment_status = cancelling`

### Billing section (`/organisation/billing` or similar)
- Lists additional properties with name, £25/month, next billing date
- **Remove property** button per item with confirmation dialog

### Property dashboard (gated)
- `payment_status = pending` → payment-required interstitial instead of dashboard
- `payment_status = cancelling` → accessible with a dismissible "Cancellation scheduled" banner

---

## New Environment Variable

| Variable | Description |
|----------|-------------|
| `STRIPE_PRICE_ADDITIONAL_PROPERTY` | Stripe Price ID for the £25/month additional property price (create in Stripe dashboard before deployment) |

---

## Out of Scope

- Bulk property submission (one at a time only)
- Trial periods on additional properties
- Pro-rating communication (Stripe handles automatically)
- Consolidating multiple add-on subscriptions into one invoice (future improvement)
- Moving a property between organisations
