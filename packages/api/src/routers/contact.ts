import { z } from "zod"

import { protectedProcedure, router } from "../index"
import { sendContactEmail } from "../lib/email"

export const contactRouter = router({
  sendMessage: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        message: z.string().min(1).max(2000),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Use the authenticated session email — never trust user-supplied email
      const email = ctx.session.user.email
      await sendContactEmail(input.name, email, input.message)
      return { success: true }
    }),
})
