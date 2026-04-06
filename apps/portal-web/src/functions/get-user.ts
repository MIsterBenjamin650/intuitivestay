import { createServerFn } from "@tanstack/react-start";

import { authMiddleware } from "@/middleware/auth";

export const getUser = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!context.session) return null;
    return {
      ...context.session,
      isAdmin: context.session.user.email === process.env.ADMIN_EMAIL,
    };
  });
