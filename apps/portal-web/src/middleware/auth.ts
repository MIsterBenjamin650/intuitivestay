import { createMiddleware } from "@tanstack/react-start";

import { authClient } from "@/lib/auth-client";

export const authMiddleware = createMiddleware().server(async ({ next, request }) => {
  // Only forward the cookie header — forwarding all headers (including
  // Accept-Encoding: gzip) causes Node.js fetch to receive a compressed
  // binary response it cannot decompress, returning garbage instead of JSON.
  const cookieHeader = request.headers.get("cookie") ?? ""
  const headers = new Headers()
  headers.set("cookie", cookieHeader)

  const session = await authClient.getSession({
    fetchOptions: { headers },
  }).catch(() => null)

  return next({ context: { session } })
});
