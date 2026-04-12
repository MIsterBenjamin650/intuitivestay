# PWA Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable instant Red Alert push notifications to owners/managers on their phone the moment a low GCS score (≤ 5) is submitted, without requiring a phone number or native app.

**Architecture:** Use the Web Push API with VAPID keys via the `web-push` npm package (no Firebase/third-party service needed, completely free). A service worker in the portal receives and displays push notifications. Owner push subscriptions are stored in a new DB table linked to their user ID. When `submitFeedback` fires a Red Alert email, it also sends a push notification to all of that property owner's registered devices.

**Tech Stack:** `web-push` (server-side push), Web Push API + Service Worker (browser), Drizzle ORM, tRPC, TanStack Router, Vite

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `packages/db/src/schema/push-subscriptions.ts` | Create | Drizzle schema for push subscription storage |
| `packages/db/src/migrations/0021_push_subscriptions.sql` | Create | DB migration |
| `packages/db/src/schema/index.ts` | Modify | Export new schema |
| `packages/api/src/lib/web-push.ts` | Create | Utility: send a push notification to a subscription |
| `packages/api/src/routers/push.ts` | Create | tRPC: save/delete push subscription |
| `packages/api/src/routers/index.ts` | Modify | Register push router |
| `packages/env/server.ts` | Modify | Add VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY env vars |
| `packages/api/src/routers/feedback.ts` | Modify | Fire push notification alongside email on Red Alert |
| `apps/portal-web/public/sw.js` | Create | Service worker: handles push events and shows notification |
| `apps/portal-web/public/manifest.json` | Create | PWA manifest so browsers can install it |
| `apps/portal-web/src/routes/__root.tsx` | Modify | Link manifest.json and register service worker in head |
| `apps/portal-web/src/hooks/use-push-notifications.ts` | Create | Hook: request permission, register SW, save subscription |
| `apps/portal-web/src/components/push-notification-prompt.tsx` | Create | UI banner prompting owner to enable notifications |
| `apps/portal-web/src/routes/_portal.index.tsx` | Modify | Show push notification prompt on portal home |

---

## Task 1: Generate VAPID Keys

VAPID keys are a one-time generated key pair that authenticate your server to send push notifications. They never change.

**Files:**
- Modify: `packages/env/server.ts`

- [ ] **Step 1: Install web-push globally to generate keys**

```bash
cd /c/Users/miste/intuitivestay/intuitivestay
npx web-push generate-vapid-keys
```

Expected output (your actual values will differ):
```
Public Key:
BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U

Private Key:
UUxI4O8-FbRouAevSmBQ6co62grn2DCOwpfzHHOq-I4
```

- [ ] **Step 2: Add VAPID vars to env schema**

In `packages/env/server.ts`, add to the `server` object inside `createEnv`:

```typescript
VAPID_PUBLIC_KEY: z.string().min(1),
VAPID_PRIVATE_KEY: z.string().min(1),
VAPID_SUBJECT: z.string().min(1), // e.g. "mailto:hello@intuitivestay.com"
```

- [ ] **Step 3: Add to Railway environment variables**

In Railway dashboard, add three new env vars:
- `VAPID_PUBLIC_KEY` — the public key from Step 1
- `VAPID_PRIVATE_KEY` — the private key from Step 1
- `VAPID_SUBJECT` — `mailto:hello@intuitivestay.com`

Also add to your local `.env` file for development.

- [ ] **Step 4: Commit**

```bash
git add packages/env/server.ts
git commit -m "feat: add VAPID env vars for web push notifications"
```

---

## Task 2: Push Subscriptions DB Table

**Files:**
- Create: `packages/db/src/schema/push-subscriptions.ts`
- Create: `packages/db/src/migrations/0021_push_subscriptions.sql`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Create the schema file**

Create `packages/db/src/schema/push-subscriptions.ts`:

```typescript
import { pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { user } from "./auth"

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})
```

- [ ] **Step 2: Export from schema index**

In `packages/db/src/schema/index.ts`, add:

```typescript
export * from "./push-subscriptions"
```

- [ ] **Step 3: Create the migration**

Create `packages/db/src/migrations/0021_push_subscriptions.sql`:

```sql
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "endpoint" text NOT NULL UNIQUE,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
```

- [ ] **Step 4: Run migration against Supabase**

```bash
# Run via Supabase SQL editor or your migration tool
# Paste contents of 0021_push_subscriptions.sql and execute
```

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/push-subscriptions.ts packages/db/src/schema/index.ts packages/db/src/migrations/0021_push_subscriptions.sql
git commit -m "feat: add push_subscriptions table"
```

---

## Task 3: Web Push Utility

**Files:**
- Create: `packages/api/src/lib/web-push.ts`

- [ ] **Step 1: Install web-push package**

```bash
cd /c/Users/miste/intuitivestay/intuitivestay
pnpm add web-push --filter @intuitive-stay/api
pnpm add -D @types/web-push --filter @intuitive-stay/api
```

- [ ] **Step 2: Create the utility**

Create `packages/api/src/lib/web-push.ts`:

```typescript
import webpush from "web-push"
import { env } from "@intuitive-stay/env/server"

webpush.setVapidDetails(
  env.VAPID_SUBJECT,
  env.VAPID_PUBLIC_KEY,
  env.VAPID_PRIVATE_KEY,
)

export type PushSubscriptionRecord = {
  endpoint: string
  p256dh: string
  auth: string
}

export async function sendPushNotification(
  subscription: PushSubscriptionRecord,
  payload: { title: string; body: string; url?: string },
): Promise<void> {
  await webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    },
    JSON.stringify(payload),
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/lib/web-push.ts
git commit -m "feat: add web push notification utility"
```

---

## Task 4: Push tRPC Router

**Files:**
- Create: `packages/api/src/routers/push.ts`
- Modify: `packages/api/src/routers/index.ts`

- [ ] **Step 1: Create the push router**

Create `packages/api/src/routers/push.ts`:

```typescript
import { eq } from "drizzle-orm"
import { z } from "zod"

import { db } from "@intuitive-stay/db"
import { pushSubscriptions } from "@intuitive-stay/db/schema"

import { protectedProcedure, router } from "../index"

export const pushRouter = router({
  saveSubscription: protectedProcedure
    .input(
      z.object({
        endpoint: z.string().url(),
        p256dh: z.string().min(1),
        auth: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id

      // Upsert — if this endpoint already exists for this user, do nothing
      const existing = await db.query.pushSubscriptions.findFirst({
        where: eq(pushSubscriptions.endpoint, input.endpoint),
      })

      if (existing) return { success: true }

      await db.insert(pushSubscriptions).values({
        id: crypto.randomUUID(),
        userId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
      })

      return { success: true }
    }),

  deleteSubscription: protectedProcedure
    .input(z.object({ endpoint: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, input.endpoint))

      return { success: true }
    }),
})
```

- [ ] **Step 2: Register in routers index**

In `packages/api/src/routers/index.ts`, add import and register:

```typescript
import { pushRouter } from "./push"
// ... existing imports ...

export const appRouter = router({
  // ... existing routes ...
  push: pushRouter,
})
```

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/routers/push.ts packages/api/src/routers/index.ts
git commit -m "feat: add push subscription tRPC router"
```

---

## Task 5: Service Worker and PWA Manifest

**Files:**
- Create: `apps/portal-web/public/sw.js`
- Create: `apps/portal-web/public/manifest.json`

- [ ] **Step 1: Create the service worker**

Create `apps/portal-web/public/sw.js`:

```javascript
self.addEventListener("push", (event) => {
  if (!event.data) return

  const data = event.data.json()
  const title = data.title ?? "IntuitiveStay Alert"
  const options = {
    body: data.body ?? "",
    icon: "/favicon.png",
    badge: "/favicon.png",
    data: { url: data.url ?? "/" },
    requireInteraction: true,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? "/"
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    }),
  )
})
```

- [ ] **Step 2: Create the PWA manifest**

Create `apps/portal-web/public/manifest.json`:

```json
{
  "name": "IntuitiveStay",
  "short_name": "IntuitiveStay",
  "description": "Guest feedback and service intelligence for independent hospitality",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#E07820",
  "icons": [
    {
      "src": "/favicon.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/favicon.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

- [ ] **Step 3: Link manifest in __root.tsx**

In `apps/portal-web/src/routes/__root.tsx`, inside the `head()` links array, add:

```typescript
{
  rel: "manifest",
  href: "/manifest.json",
},
```

- [ ] **Step 4: Commit**

```bash
git add apps/portal-web/public/sw.js apps/portal-web/public/manifest.json apps/portal-web/src/routes/__root.tsx
git commit -m "feat: add PWA service worker and manifest"
```

---

## Task 6: usePushNotifications Hook

**Files:**
- Create: `apps/portal-web/src/hooks/use-push-notifications.ts`

- [ ] **Step 1: Create the hook**

Create `apps/portal-web/src/hooks/use-push-notifications.ts`:

```typescript
import { useState, useEffect } from "react"
import { useTRPC } from "@/utils/trpc"
import { useMutation } from "@tanstack/react-query"

// This must match the VAPID_PUBLIC_KEY env var — paste your public key here
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ""

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

export type PushState = "unsupported" | "default" | "granted" | "denied" | "loading"

export function usePushNotifications() {
  const trpc = useTRPC()
  const [state, setState] = useState<PushState>("default")

  const saveMutation = useMutation(
    trpc.push.saveSubscription.mutationOptions(),
  )

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported")
      return
    }
    const permission = Notification.permission
    if (permission === "granted") setState("granted")
    else if (permission === "denied") setState("denied")
    else setState("default")
  }, [])

  async function enable() {
    if (!("serviceWorker" in navigator)) return
    setState("loading")

    try {
      const registration = await navigator.serviceWorker.register("/sw.js")
      await navigator.serviceWorker.ready

      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setState("denied")
        return
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      const json = subscription.toJSON()
      await saveMutation.mutateAsync({
        endpoint: json.endpoint!,
        p256dh: json.keys!.p256dh,
        auth: json.keys!.auth,
      })

      setState("granted")
    } catch (err) {
      console.error("Push subscription failed:", err)
      setState("default")
    }
  }

  return { state, enable }
}
```

- [ ] **Step 2: Add VAPID public key to portal web env**

In `apps/portal-web/.env` (and in Vercel/Railway environment for the frontend), add:

```
VITE_VAPID_PUBLIC_KEY=<your public key from Task 1>
```

Note: `VITE_` prefix is required for Vite to expose this to the browser. The public key is safe to expose — only the private key must be kept secret.

- [ ] **Step 3: Commit**

```bash
git add apps/portal-web/src/hooks/use-push-notifications.ts
git commit -m "feat: add usePushNotifications hook"
```

---

## Task 7: Push Notification Prompt UI

**Files:**
- Create: `apps/portal-web/src/components/push-notification-prompt.tsx`
- Modify: `apps/portal-web/src/routes/_portal.index.tsx`

- [ ] **Step 1: Create the prompt component**

Create `apps/portal-web/src/components/push-notification-prompt.tsx`:

```typescript
import { Bell, X } from "lucide-react"
import { useState } from "react"
import { usePushNotifications } from "@/hooks/use-push-notifications"
import { Button } from "@intuitive-stay/ui/components/button"

export function PushNotificationPrompt() {
  const { state, enable } = usePushNotifications()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || state === "unsupported" || state === "granted" || state === "denied") {
    return null
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 mb-4">
      <div className="flex items-center gap-3">
        <Bell className="h-5 w-5 text-orange-500 shrink-0" />
        <div>
          <p className="text-sm font-medium text-orange-900">Enable Red Alert notifications</p>
          <p className="text-xs text-orange-700">
            Get an instant notification on this device when a guest submits a low score.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          onClick={enable}
          disabled={state === "loading"}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          {state === "loading" ? "Enabling…" : "Enable"}
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="text-orange-400 hover:text-orange-600"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add prompt to portal index page**

In `apps/portal-web/src/routes/_portal.index.tsx`, import and add the component near the top of the page content (after the existing redirect logic, before the main content):

```typescript
import { PushNotificationPrompt } from "@/components/push-notification-prompt"

// Inside the component's return JSX, add before main content:
<PushNotificationPrompt />
```

- [ ] **Step 3: Commit**

```bash
git add apps/portal-web/src/components/push-notification-prompt.tsx apps/portal-web/src/routes/_portal.index.tsx
git commit -m "feat: add push notification prompt UI"
```

---

## Task 8: Fire Push on Red Alert

**Files:**
- Modify: `packages/api/src/routers/feedback.ts`

- [ ] **Step 1: Update submitFeedback to send push alongside email**

In `packages/api/src/routers/feedback.ts`, after the existing `sendAlertEmail(...)` call (inside the `if (gcs <= 5)` block), add:

```typescript
import { sendPushNotification } from "../lib/web-push"
import { pushSubscriptions } from "@intuitive-stay/db/schema"
import { eq } from "drizzle-orm"
```

Then inside the `if (gcs <= 5)` block, after the `sendAlertEmail(...)` call:

```typescript
// Send push notification to all of owner's registered devices
if (property) {
  // Find the organisation owner's userId via organisationId
  const org = await db.query.organisations.findFirst({
    where: eq(organisations.id, property.organisationId),
  })

  if (org?.ownerId) {
    const subs = await db.query.pushSubscriptions.findMany({
      where: eq(pushSubscriptions.userId, org.ownerId),
    })

    for (const sub of subs) {
      sendPushNotification(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        {
          title: "🔴 Red Alert — Low Guest Score",
          body: `${property.name} received a GCS of ${gcs}/10. Tap to review.`,
          url: `/properties/${property.id}/dashboard`,
        },
      ).catch((err) => {
        // If subscription is expired/invalid, clean it up
        if (err?.statusCode === 410) {
          db.delete(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, sub.endpoint))
            .catch(console.error)
        } else {
          console.error("Push notification failed:", err)
        }
      })
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/routers/feedback.ts packages/api/src/lib/web-push.ts
git commit -m "feat: fire push notification on Red Alert alongside email"
```

---

## Task 9: End-to-End Test

- [ ] **Step 1: Deploy to Railway**

```bash
git push origin main
```

Wait for Railway to deploy.

- [ ] **Step 2: Enable notifications on your device**

1. Open the portal on your phone browser
2. The orange "Enable Red Alert notifications" banner should appear
3. Tap Enable → Allow the browser permission prompt
4. Banner should disappear

- [ ] **Step 3: Submit a test low-score feedback**

Use a property's QR code URL directly and submit scores of 1 across all pillars (GCS will be ≤ 5).

- [ ] **Step 4: Verify**

Within a few seconds your phone should buzz with a notification titled "🔴 Red Alert — Low Guest Score". Tapping it should open the portal dashboard.

- [ ] **Step 5: Verify auto-cleanup of expired subscriptions**

If a subscription returns 410 (expired), the code removes it from DB automatically. This can be verified in the Railway logs.
