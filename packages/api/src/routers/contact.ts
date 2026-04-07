import { z } from "zod"

import { protectedProcedure, router } from "../index"
import { sendContactEmail } from "../lib/email"

export const contactRouter = router({
  sendMessage: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        email: z.string().email(),
        message: z.string().min(1).max(2000),
      }),
    )
    .mutation(async ({ input }) => {
      await sendContactEmail(input.name, input.email, input.message)
      return { success: true }
    }),
})
