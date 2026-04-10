import { auth } from "@intuitive-stay/auth";
import { createMiddleware } from "@tanstack/react-start";

export const authMiddleware = createMiddleware().server(async ({ next, request }) => {
  // Call the auth library directly (in-process) instead of making an HTTP
  // round-trip to /api/auth/get-session. This avoids proxy/network issues
  // and is far more reliable for SSR session validation.
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null)

  return next({ context: { session } })
});
