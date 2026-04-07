import { db } from "@intuitive-stay/db"
import { organisations, properties, propertyMembers } from "@intuitive-stay/db/schema"
import { createServerFn } from "@tanstack/react-start"
import { and, eq } from "drizzle-orm"

import { authMiddleware } from "@/middleware/auth"

export const getUser = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!context.session || !context.session.user) return null

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
