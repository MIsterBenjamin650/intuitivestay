import { protectedProcedure, publicProcedure, router } from "../index"
import { feedbackRouter } from "./feedback"
import { propertiesRouter } from "./properties"

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK"
  }),
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "This is private",
      user: ctx.session.user,
    }
  }),
  properties: propertiesRouter,
  feedback: feedbackRouter,
})

export type AppRouter = typeof appRouter
