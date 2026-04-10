import { eq } from "drizzle-orm"
import { z } from "zod"

import { db } from "@intuitive-stay/db"
import { pushSubscriptions } from "@intuitive-stay/db/schema"

import { protectedProcedure, router } from "../index"

export const pushRouter = router({
  saveSubscription: protectedProcedure
    .input(
      z.object({
        endpoint: z.string().url(),
        p256dh: z.string().min(1),
        auth: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id

      const existing = await db.query.pushSubscriptions.findFirst({
        where: eq(pushSubscriptions.endpoint, input.endpoint),
      })

      if (existing) return { success: true }

      await db.insert(pushSubscriptions).values({
        id: crypto.randomUUID(),
        userId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
      })

      return { success: true }
    }),

  deleteSubscription: protectedProcedure
    .input(z.object({ endpoint: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, input.endpoint))

      return { success: true }
    }),
})
