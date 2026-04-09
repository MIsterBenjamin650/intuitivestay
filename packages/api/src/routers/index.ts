import { protectedProcedure, publicProcedure, router } from "../index"
import { aiRouter } from "./ai"
import { contactRouter } from "./contact"
import { feedbackRouter } from "./feedback"
import { inviteRouter } from "./invite"
import { propertiesRouter } from "./properties"
import { staffRouter } from "./staff"
import { teamRouter } from "./team"
import { reviewsRouter } from "./reviews"

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
  ai: aiRouter,
  team: teamRouter,
  reviews: reviewsRouter,
  invite: inviteRouter,
  contact: contactRouter,
  staff: staffRouter,
})

export type AppRouter = typeof appRouter
