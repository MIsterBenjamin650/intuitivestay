import { env } from "@intuitive-stay/env/server"
import { db } from "@intuitive-stay/db"
import { organisations, properties, propertyMembers } from "@intuitive-stay/db/schema"
import { createServerFn } from "@tanstack/react-start"
import { and, eq } from "drizzle-orm"

import { authMiddleware } from "@/middleware/auth"

export const getUser = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    // authClient.getSession may return either:
    //   { data: { session, user }, error } — wrapped format
    //   { session, user }                  — direct format (with throw:true)
    // Handle both so we are not relying on an assumed internal format.
    const raw = context.session as Record<string, unknown> | null
    if (!raw) return null
    const sessionData = (raw.data as Record<string, unknown> | null | undefined) ?? raw
    const user = sessionData?.user as { id: string; email: string; name: string } | undefined
    if (!user?.id) return null

    const userId = user.id

    // Check if this user is a property owner
    const org = await db.query.organisations.findFirst({
      where: eq(organisations.ownerId, userId),
      columns: { id: true, subscriptionStatus: true, plan: true, onboardingCompletedAt: true },
    })

    if (org) {
      const orgProperties = await db
        .select({ id: properties.id, name: properties.name })
        .from(properties)
        .where(eq(properties.organisationId, org.id))

      return {
        ...context.session,
        user: {
          ...user,
          properties: orgProperties,
        },
        isAdmin: user.email.toLowerCase().trim() === env.ADMIN_EMAIL.toLowerCase().trim(),
        isStaff: false,
        staffPropertyId: null,
        staffPermissions: null,
        subscriptionStatus: org.subscriptionStatus ?? "none",
        plan: org.plan ?? null,
        needsOnboarding: org.onboardingCompletedAt === null,
      }
    }

    // Check if this user is a staff member
    const membership = await db
      .select()
      .from(propertyMembers)
      .where(
        and(
          eq(propertyMembers.userId, userId),
          eq(propertyMembers.status, "active"),
        ),
      )
      .limit(1)

    if (membership.length && membership[0]) {
      return {
        ...context.session,
        user: {
          ...user,
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
        ...user,
        properties: [],
      },
      isAdmin: user.email.toLowerCase().trim() === env.ADMIN_EMAIL.toLowerCase().trim(),
      isStaff: false,
      staffPropertyId: null,
      staffPermissions: null,
      subscriptionStatus: "none",
      plan: null,
    }
  })
