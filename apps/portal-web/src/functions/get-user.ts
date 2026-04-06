import { db } from "@intuitive-stay/db"
import { organisations } from "@intuitive-stay/db/schema"
import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"

import { authMiddleware } from "@/middleware/auth"

export const getUser = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!context.session) return null

    const org = await db.query.organisations.findFirst({
      where: eq(organisations.ownerId, context.session.user.id),
      columns: { subscriptionStatus: true, plan: true },
    })

    return {
      ...context.session,
      isAdmin: context.session.user.email === process.env.ADMIN_EMAIL,
      subscriptionStatus: org?.subscriptionStatus ?? "none",
      plan: org?.plan ?? null,
    }
  })
