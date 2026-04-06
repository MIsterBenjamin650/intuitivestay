import { db } from "@intuitive-stay/db"
import { organisations, user } from "@intuitive-stay/db/schema"
import { env } from "@intuitive-stay/env/server"
import { eq } from "drizzle-orm"
import type { Context } from "hono"
import Stripe from "stripe"

const stripe = new Stripe(env.STRIPE_SECRET_KEY)

const PRICE_TO_PLAN: Record<string, string> = {
  [env.STRIPE_PRICE_HOST]: "host",
  [env.STRIPE_PRICE_PARTNER]: "partner",
  [env.STRIPE_PRICE_FOUNDER]: "founder",
}

async function findOrgByEmail(email: string): Promise<string | null> {
  const result = await db
    .select({ orgId: organisations.id })
    .from(organisations)
    .innerJoin(user, eq(organisations.ownerId, user.id))
    .where(eq(user.email, email))
    .limit(1)
  return result[0]?.orgId ?? null
}

async function getCustomerEmail(customerId: string): Promise<string | null> {
  const customer = await stripe.customers.retrieve(customerId)
  if (customer.deleted) return null
  return (customer as Stripe.Customer).email ?? null
}

export async function stripeWebhookHandler(c: Context) {
  const body = await c.req.text()
  const sig = c.req.header("stripe-signature") ?? ""

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET)
  } catch {
    return c.json({ error: "Invalid signature" }, 400)
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated"
  ) {
    const sub = event.data.object as Stripe.Subscription
    const email = await getCustomerEmail(sub.customer as string)
    if (!email) return c.json({ ok: true })

    const orgId = await findOrgByEmail(email)
    if (!orgId) return c.json({ ok: true })

    const priceId = sub.items.data[0]?.price.id ?? ""
    const plan = PRICE_TO_PLAN[priceId] ?? "host"
    const isTrialing = sub.status === "trialing"
    const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000) : null
    // current_period_end is on the SubscriptionItem in Stripe v22
    const rawPeriodEnd = sub.items.data[0]?.current_period_end
    const periodEnd = rawPeriodEnd ? new Date(rawPeriodEnd * 1000) : null

    await db
      .update(organisations)
      .set({
        plan,
        subscriptionStatus: isTrialing ? "trial" : "active",
        trialEndsAt: isTrialing ? trialEnd : null,
        subscriptionEndsAt: isTrialing ? null : periodEnd,
        stripeCustomerId: sub.customer as string,
      })
      .where(eq(organisations.id, orgId))
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription
    const email = await getCustomerEmail(sub.customer as string)
    if (!email) return c.json({ ok: true })

    const orgId = await findOrgByEmail(email)
    if (!orgId) return c.json({ ok: true })

    await db
      .update(organisations)
      .set({ subscriptionStatus: "expired" })
      .where(eq(organisations.id, orgId))
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice
    if (!invoice.customer) return c.json({ ok: true })

    const email = await getCustomerEmail(invoice.customer as string)
    if (!email) return c.json({ ok: true })

    const orgId = await findOrgByEmail(email)
    if (!orgId) return c.json({ ok: true })

    const graceEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    await db
      .update(organisations)
      .set({ subscriptionStatus: "grace", subscriptionEndsAt: graceEnd })
      .where(eq(organisations.id, orgId))
  }

  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice
    // In Stripe v22, subscription is accessed via invoice.parent.subscription_details.subscription
    const subscriptionRef = invoice.parent?.subscription_details?.subscription
    if (!subscriptionRef || !invoice.customer) return c.json({ ok: true })

    const email = await getCustomerEmail(invoice.customer as string)
    if (!email) return c.json({ ok: true })

    const orgId = await findOrgByEmail(email)
    if (!orgId) return c.json({ ok: true })

    const subscriptionId =
      typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef.id
    const sub = await stripe.subscriptions.retrieve(subscriptionId)
    // current_period_end is on the SubscriptionItem in Stripe v22
    const rawPeriodEnd = sub.items.data[0]?.current_period_end
    const periodEnd = rawPeriodEnd ? new Date(rawPeriodEnd * 1000) : null

    await db
      .update(organisations)
      .set({ subscriptionStatus: "active", subscriptionEndsAt: periodEnd })
      .where(eq(organisations.id, orgId))
  }

  return c.json({ ok: true })
}
