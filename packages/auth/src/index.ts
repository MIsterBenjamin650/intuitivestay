import { expo } from "@better-auth/expo";
import { db } from "@intuitive-stay/db";
import * as schema from "@intuitive-stay/db/schema/auth";
import { env } from "@intuitive-stay/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";

export const pendingMagicLinks = new Map<string, string>();

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",

    schema: schema,
  }),
  trustedOrigins: [
    env.CORS_ORIGIN,
    "intuitive-stay://",
    ...(env.NODE_ENV === "development"
      ? ["exp://", "exp://**", "exp://192.168.*.*:*/**", "http://localhost:8081"]
      : []),
  ],
  emailAndPassword: {
    enabled: true,
  },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  advanced: {
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
      httpOnly: true,
    },
  },
  plugins: [
    expo(),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        pendingMagicLinks.set(email, url);
      },
      expiresIn: 60 * 60 * 24, // 24 hours
    }),
  ],
});
