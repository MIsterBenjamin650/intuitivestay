import { createMiddleware } from "@tanstack/react-start";

// Portal-server URL — available as a runtime env var in Railway.
// We call portal-server DIRECTLY (server-to-server, no CORS) so the session
// token in the cookie is validated against the database regardless of which
// domain originally set the cookie.
const PORTAL_SERVER_URL =
  process.env.PORTAL_SERVER_URL ?? "https://intuitivestay-production.up.railway.app"

export const authMiddleware = createMiddleware().server(async ({ next, request }) => {
  const cookieHeader = request?.headers?.get("cookie") ?? ""

  const session = await fetch(`${PORTAL_SERVER_URL}/api/auth/get-session`, {
    headers: { cookie: cookieHeader },
  })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)

  return next({ context: { session } })
});
