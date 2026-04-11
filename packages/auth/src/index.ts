import { expo } from "@better-auth/expo";
import { db } from "@intuitive-stay/db";
import * as schema from "@intuitive-stay/db/schema/auth";
import { env } from "@intuitive-stay/env/server";
import { sendMagicLinkEmail, sendPasswordResetEmail } from "./email";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";

export const pendingMagicLinks = new Map<string, string>();

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",

    schema: schema,
  }),
  session: {
    expiresIn: 60 * 60 * 24 * 30,      // 30 days before a session fully expires
    updateAge: 60 * 60 * 24,            // refresh the session token once per day if user is active
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,                   // cache session in cookie for 5 minutes to reduce DB lookups
    },
  },
  trustedOrigins: [
    env.CORS_ORIGIN,
    "intuitive-stay://",
    ...(env.NODE_ENV === "development"
      ? ["exp://", "exp://**", "exp://192.168.*.*:*/**", "http://localhost:8081"]
      : []),
  ],
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      try {
        await sendPasswordResetEmail(user.email, url)
      } catch (err) {
        console.error("Failed to send password reset email:", err)
      }
    },
  },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  advanced: {
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: true,
      httpOnly: true,
      domain: ".intuitivestay.com",
    },
  },
  plugins: [
    expo(),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail(email, url)
      },
      expiresIn: 60 * 60 * 24, // 24 hours
    }),
  ],
});
