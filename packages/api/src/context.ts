import { auth } from "@intuitive-stay/auth";
import { env } from "@intuitive-stay/env/server";
import type { Context as HonoContext } from "hono";

export type CreateContextOptions = {
  context: HonoContext;
};

export async function createContext({ context }: CreateContextOptions) {
  const session = await auth.api.getSession({
    headers: context.req.raw.headers,
  });
  const isAdmin =
    session != null &&
    session.user.email.toLowerCase().trim() === env.ADMIN_EMAIL.toLowerCase().trim();
  return {
    session,
    isAdmin,
    headers: context.req.raw.headers,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
