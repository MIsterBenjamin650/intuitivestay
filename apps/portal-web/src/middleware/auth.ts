import { auth } from "@intuitive-stay/auth";
import { createMiddleware } from "@tanstack/react-start";

export const authMiddleware = createMiddleware().server(async ({ next, request }) => {
  // Use the server-side auth instance to verify sessions directly from the
  // database — avoids the HTTP round-trip that the browser client makes and
  // correctly reads the session cookie from the incoming request headers.
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  return next({
    context: { session },
  });
});
