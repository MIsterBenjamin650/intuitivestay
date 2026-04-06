import { db } from "@intuitive-stay/db"
import { organisations, properties } from "@intuitive-stay/db/schema"
import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"

import { authMiddleware } from "@/middleware/auth"

export const getUser = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!context.session) return null

    const org = await db.query.organisations.findFirst({
      where: eq(organisations.ownerId, context.session.user.id),
      columns: { id: true, subscriptionStatus: true, plan: true },
    })

    const orgProperties = org
      ? await db
          .select({ id: properties.id, name: properties.name })
          .from(properties)
          .where(eq(properties.organisationId, org.id))
      : []

    return {
      ...context.session,
      user: {
        ...context.session.user,
        properties: orgProperties,
      },
      isAdmin: context.session.user.email === process.env.ADMIN_EMAIL,
      subscriptionStatus: org?.subscriptionStatus ?? "none",
      plan: org?.plan ?? null,
    }
  })
