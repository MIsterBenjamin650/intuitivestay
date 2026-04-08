import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    WIXBRIDGE_SECRET: z.string().min(16),
    RESEND_API_KEY: z.string().min(1),
    ADMIN_EMAIL: z.string().email(),
    PUBLIC_PORTAL_URL: z.url(),
    STRIPE_SECRET_KEY: z.string().min(1),
    STRIPE_PRICE_HOST: z.string().min(1),
    STRIPE_PRICE_PARTNER: z.string().min(1),
    STRIPE_PRICE_FOUNDER: z.string().min(1),
    STRIPE_WEBHOOK_SECRET: z.string().min(1),
    ANTHROPIC_API_KEY: z.string().min(1),
    APIFY_API_TOKEN: z.string().min(1).optional(),
    CRON_SECRET: z.string().min(16).optional(),
    STRIPE_COUPON_M1: z.string().min(1).optional(),
    STRIPE_COUPON_M2: z.string().min(1).optional(),
    STRIPE_COUPON_M3_HOST: z.string().min(1).optional(),
    STRIPE_COUPON_M3_PARTNER: z.string().min(1).optional(),
    STRIPE_COUPON_M3_FOUNDER: z.string().min(1).optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
