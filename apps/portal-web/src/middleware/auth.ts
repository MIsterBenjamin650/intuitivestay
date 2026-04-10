import { createMiddleware } from "@tanstack/react-start";

// Portal-server URL — available as a runtime env var in Railway.
// We call portal-server DIRECTLY (server-to-server, no CORS) so the session
// token in the cookie is validated against the database regardless of which
// domain originally set the cookie.
const PORTAL_SERVER_URL =
  process.env.PORTAL_SERVER_URL ?? "https://intuitivestay-production.up.railway.app"

export const authMiddleware = createMiddleware().server(async ({ next, request }) => {
  const cookieHeader = request?.headers?.get("cookie") ?? ""

  console.log("[auth] cookie length:", cookieHeader.length, "| has session token:", cookieHeader.includes("better-auth"))

  let rawResponse: Response | null = null
  const session = await fetch(`${PORTAL_SERVER_URL}/api/auth/get-session`, {
    headers: { cookie: cookieHeader },
  })
    .then((r) => { rawResponse = r; return r.ok ? r.json() : null })
    .catch((err) => { console.log("[auth] fetch error:", String(err)); return null })

  console.log("[auth] get-session status:", rawResponse ? (rawResponse as Response).status : "no response", "| session:", session ? "present" : "null")

  return next({ context: { session } })
});
