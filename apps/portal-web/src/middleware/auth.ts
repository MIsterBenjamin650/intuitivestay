import { createMiddleware } from "@tanstack/react-start";

// Portal-server URL — available as a runtime env var in Railway.
// We call portal-server DIRECTLY (server-to-server, no CORS) so the session
// token in the cookie is validated against the database regardless of which
// domain originally set the cookie.
const PORTAL_SERVER_URL =
  process.env.PORTAL_SERVER_URL ?? "https://intuitivestay-production.up.railway.app"

export const authMiddleware = createMiddleware().server(async ({ next, request }) => {
  const cookieHeader = request?.headers?.get("cookie") ?? ""

  console.log("[AUTH] cookie header length:", cookieHeader.length)
  console.log("[AUTH] cookie preview:", cookieHeader.slice(0, 120))
  console.log("[AUTH] PORTAL_SERVER_URL:", PORTAL_SERVER_URL)

  let sessionRaw: unknown = null
  try {
    const res = await fetch(`${PORTAL_SERVER_URL}/api/auth/get-session`, {
      headers: { cookie: cookieHeader },
    })
    console.log("[AUTH] get-session status:", res.status)
    sessionRaw = res.ok ? await res.json() : null
  } catch (err) {
    console.error("[AUTH] get-session fetch error:", err)
  }

  console.log("[AUTH] session present:", sessionRaw !== null)

  return next({ context: { session: sessionRaw } })
});
