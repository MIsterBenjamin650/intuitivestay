import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_SERVER_URL: z.url(),
    VITE_AUTH_URL: z.url(),
    VITE_WIX_PLAN_URL_HOST: z.url(),
    VITE_WIX_PLAN_URL_PARTNER: z.url(),
    VITE_WIX_PLAN_URL_FOUNDER: z.url(),
    VITE_WIX_BILLING_URL: z.url(),
  },
  runtimeEnv: (import.meta as any).env,
  emptyStringAsUndefined: true,
});
