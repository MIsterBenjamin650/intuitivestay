# Navigation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the owner portal sidebar to 3 items (Dashboard, Feedback, QR Codes), move Plans & Billing into the profile dropdown, remove the Admin group from the owner sidebar, and redirect Host/Partner users from `/` to their property dashboard.

**Architecture:** Pure frontend changes — no backend, no new routes, no new tRPC procedures. We modify `app-sidebar.tsx` to conditionally render the correct nav for each plan type, update `topbar-user-menu.tsx` to add the missing dropdown items, add a redirect in `_portal.index.tsx` for Host/Partner users, add a Founder-only guard in `_portal.properties.tsx`, and convert `_portal.insights.tsx` to a redirect. The `plan` prop is already available in `AppSidebar` from the session.

**Tech Stack:** React, TanStack Router, Tailwind CSS v4, shadcn/ui, TypeScript

---

## File Map

| File | Change |
|---|---|
| `apps/portal-web/src/components/app-sidebar.tsx` | Restructure owner nav: remove Workspace group, trim Current Property group, remove Organisation group, remove Admin group, add Founder branch |
| `apps/portal-web/src/components/topbar-user-menu.tsx` | Add "Account Details" and "Plans & Billing" items to dropdown |
| `apps/portal-web/src/routes/_portal.index.tsx` | Redirect Host/Partner to first property dashboard |
| `apps/portal-web/src/routes/_portal.properties.tsx` | Add Founder-only guard; redirect others to their property dashboard |
| `apps/portal-web/src/routes/_portal.insights.tsx` | Convert to redirect → `/` |

---

### Task 1: Simplify the owner sidebar

**Context:** `app-sidebar.tsx` currently renders a single owner sidebar with a `Workspace` group (Dashboard + Properties), a `Current Property` group (7 items), an `Organisation` group (4 items including Plans & Billing), and an `Admin` group (visible to all owners — a bug). The `plan` prop already comes in from `_portal.tsx`. The file is at `apps/portal-web/src/components/app-sidebar.tsx`.

**Files:**
- Modify: `apps/portal-web/src/components/app-sidebar.tsx`

- [ ] **Step 1: Read and understand the current sidebar**

Read `apps/portal-web/src/components/app-sidebar.tsx` in full before making any changes. The `AppSidebar` function receives `isAdmin`, `plan`, and `subscriptionStatus` props. The owner sidebar is the `return` block starting at line ~191. It renders four `SidebarGroup` sections.

- [ ] **Step 2: Replace the owner sidebar return block**

Replace the entire owner `return` block (from the second `return (` down to the final closing `</Sidebar>`) with the following. This replaces all four existing groups with a clean two-branch structure: Founder gets a property list group; Host/Partner get My Property group with Dashboard, Feedback, QR Codes only.

```tsx
  const isFounder = plan === "founder"

  return (
    <Sidebar
      collapsible="icon"
      className="[background:linear-gradient(180deg,#1e1b4b_0%,#312e81_100%)] border-r-0"
      {...props}
    >
      <SidebarHeader className="gap-0 p-0">
        <div className="flex h-16 items-center border-b border-sidebar-border p-2">
          <SidebarBrand />
        </div>
        {!isFounder && (
          <div className="p-2">
            <PropertySwitcher />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        {isFounder ? (
          <SidebarGroup>
            <SidebarGroupLabel className="px-4 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/35">
              My Properties
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarLinkItem
                  label="All Properties"
                  icon={<Building2Icon />}
                  link={<AppSidebarLink to="/properties" />}
                  isActive={isRouteActive(location.pathname, "/properties")}
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          hasProperties && (
            <SidebarGroup>
              <SidebarGroupLabel className="px-4 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/35">
                My Property
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarLinkItem
                    label="Dashboard"
                    icon={<LayoutDashboardIcon />}
                    link={
                      <AppSidebarLink
                        to="/properties/$propertyId/dashboard"
                        params={propertyParams}
                      />
                    }
                    isActive={isRouteActive(location.pathname, propertyDashboardPath)}
                  />
                  <SidebarLinkItem
                    label="Feedback"
                    icon={<UsersIcon />}
                    link={
                      <AppSidebarLink
                        to="/properties/$propertyId/feedback"
                        params={propertyParams}
                      />
                    }
                    isActive={isRouteActive(location.pathname, propertyFeedbackPath)}
                  />
                  <SidebarLinkItem
                    label="QR Codes"
                    icon={<QrCodeIcon />}
                    link={
                      <AppSidebarLink
                        to="/properties/$propertyId/qr-form"
                        params={propertyParams}
                      />
                    }
                    isActive={isRouteActive(location.pathname, propertyQrFormPath)}
                  />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        )}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
```

- [ ] **Step 3: Remove unused imports and variables**

After the replacement, several imports and variables are no longer used. Remove them:

Remove from imports:
```tsx
// Remove these imports (no longer used):
import { Badge } from "@intuitive-stay/ui/components/badge"
import { PlanBadge } from "@intuitive-stay/ui/components/plan-badge"
import { UpgradeBadge } from "@intuitive-stay/ui/components/upgrade-badge"
import {
  BarChart3Icon,
  BellIcon,
  BuildingIcon,
  CreditCardIcon,
  ShieldCheckIcon,
  TrendingUpIcon,
  UserCogIcon,
} from "lucide-react"
```

Remove these variable declarations from inside `AppSidebar` (they were computing paths no longer used):
```tsx
// Remove these lines:
const propertyInsightsPath = buildPropertyPath(activePropertyId, "insights")
const propertyAdvancedInsightsPath = buildPropertyPath(activePropertyId, "advanced-insights")
const propertyAlertsPath = buildPropertyPath(activePropertyId, "alerts")
const propertyLocalMarketPath = buildPropertyPath(activePropertyId, "local-market")
```

Keep: `propertyDashboardPath`, `propertyFeedbackPath`, `propertyQrFormPath`, `propertyParams`, `hasProperties`, `isFounder`, `location`, `activePropertyId`, `properties`.

- [ ] **Step 4: Verify TypeScript compiles**

Run:
```bash
cd apps/portal-web && pnpm tsc --noEmit 2>&1 | head -40
```

Expected: no errors (or only pre-existing errors unrelated to this file). Fix any errors caused by the changes before proceeding.

- [ ] **Step 5: Commit**

```bash
git add apps/portal-web/src/components/app-sidebar.tsx
git commit -m "feat: simplify owner sidebar to Dashboard, Feedback, QR Codes only"
```

---

### Task 2: Add Account Details and Plans & Billing to profile dropdown

**Context:** `topbar-user-menu.tsx` has a dropdown with just "Settings" and "Logout". The spec requires "Account Details" (replacing Settings) and "Plans & Billing" above the separator, then Sign Out. The `/organisation/billing` route already exists. The file is at `apps/portal-web/src/components/topbar-user-menu.tsx`.

**Files:**
- Modify: `apps/portal-web/src/components/topbar-user-menu.tsx`

- [ ] **Step 1: Add the Link import and CreditCard icon**

At the top of the file, add `Link` to the TanStack Router import and `CreditCardIcon` to the Lucide import:

```tsx
// Replace:
import { useNavigate } from "@tanstack/react-router"
import { LogOutIcon, SettingsIcon } from "lucide-react"

// With:
import { Link, useNavigate } from "@tanstack/react-router"
import { CreditCardIcon, LogOutIcon, SettingsIcon } from "lucide-react"
```

- [ ] **Step 2: Replace the dropdown menu items**

Replace the entire `<DropdownMenuGroup>` block that contains the Settings and Logout items (the second `DropdownMenuGroup`, after the separator):

```tsx
// Replace:
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={(event) => event.preventDefault()}>
            <SettingsIcon />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              authClient.signOut({
                fetchOptions: {
                  onSuccess: () => {
                    navigate({
                      to: "/login",
                    })
                  },
                },
              })
            }}
          >
            <LogOutIcon />
            Logout
          </DropdownMenuItem>
        </DropdownMenuGroup>

// With:
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={(event) => event.preventDefault()}>
            <SettingsIcon />
            Account Details
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link to="/organisation/billing" />}>
            <CreditCardIcon />
            Plans & Billing
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              authClient.signOut({
                fetchOptions: {
                  onSuccess: () => {
                    navigate({ to: "/login" })
                  },
                },
              })
            }}
          >
            <LogOutIcon />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuGroup>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/portal-web && pnpm tsc --noEmit 2>&1 | head -40
```

Expected: no errors. Fix any before proceeding.

- [ ] **Step 4: Commit**

```bash
git add apps/portal-web/src/components/topbar-user-menu.tsx
git commit -m "feat: add Account Details and Plans & Billing to profile dropdown"
```

---

### Task 3: Redirect Host/Partner from `/` to their property dashboard

**Context:** `_portal.index.tsx` currently renders `PortfolioDashboard` for non-admin users regardless of plan. Host and Partner owners should land directly on their single property's dashboard instead. The session (available via `useRouteContext`) has `plan` and `user.properties` (array of `{ id, name }`). We redirect if `plan === "host"` or `plan === "partner"` and properties exist.

**Files:**
- Modify: `apps/portal-web/src/routes/_portal.index.tsx`

- [ ] **Step 1: Add the redirect logic in RouteComponent**

Replace the `RouteComponent` function:

```tsx
function RouteComponent() {
  const { session } = useRouteContext({ from: "/_portal" })
  const navigate = useNavigate()
  const isAdmin = (session as { isAdmin?: boolean } | null)?.isAdmin === true
  const plan = (session as { plan?: string | null } | null)?.plan ?? null
  const properties = (session as { user?: { properties?: Array<{ id: string; name: string }> } } | null)?.user?.properties ?? []

  React.useEffect(() => {
    if (!isAdmin && (plan === "host" || plan === "partner") && properties.length > 0) {
      const firstProperty = properties[0]
      if (firstProperty) {
        void navigate({
          to: "/properties/$propertyId/dashboard",
          params: { propertyId: firstProperty.id },
          replace: true,
        })
      }
    }
  }, [isAdmin, plan, properties, navigate])

  if (isAdmin) return <AdminDashboard />
  if ((plan === "host" || plan === "partner") && properties.length > 0) {
    return null
  }
  return <PortfolioDashboard />
}
```

Also add `useNavigate` to the import at the top of the file:

```tsx
// Replace:
import { createFileRoute, useRouteContext } from "@tanstack/react-router"
// With:
import { createFileRoute, useNavigate, useRouteContext } from "@tanstack/react-router"
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/portal-web && pnpm tsc --noEmit 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/portal-web/src/routes/_portal.index.tsx
git commit -m "feat: redirect Host/Partner users from / to their property dashboard"
```

---

### Task 4: Guard /properties for Founder-only

**Context:** `_portal.properties.tsx` renders the properties list. Host and Partner users should not see this page; they have only one property and navigate via the sidebar. If a non-Founder navigates directly to `/properties`, they should be redirected to their property dashboard. The `beforeLoad` hook in TanStack Router is the right place for this guard.

**Files:**
- Modify: `apps/portal-web/src/routes/_portal.properties.tsx`

- [ ] **Step 1: Add beforeLoad redirect guard**

In `_portal.properties.tsx`, add a `beforeLoad` function to the route definition. Insert it before `validateSearch`:

```tsx
// Replace:
export const Route = createFileRoute("/_portal/properties")({
  validateSearch,
  component: RouteComponent,
})

// With:
export const Route = createFileRoute("/_portal/properties")({
  beforeLoad: async ({ context }) => {
    const session = context.session as {
      plan?: string | null
      user?: { properties?: Array<{ id: string }> }
    } | null
    const plan = session?.plan ?? null
    if (plan !== "founder") {
      const properties = session?.user?.properties ?? []
      const firstId = properties[0]?.id
      if (firstId) {
        throw redirect({
          to: "/properties/$propertyId/dashboard",
          params: { propertyId: firstId },
        })
      }
      throw redirect({ to: "/" })
    }
  },
  validateSearch,
  component: RouteComponent,
})
```

Also add `redirect` to the TanStack Router import:

```tsx
// Replace:
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
// With:
import { Link, createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/portal-web && pnpm tsc --noEmit 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/portal-web/src/routes/_portal.properties.tsx
git commit -m "feat: guard /properties route for Founder plan only"
```

---

### Task 5: Redirect /insights to dashboard

**Context:** `_portal.insights.tsx` renders a `FounderInsightsOverview` component. The spec says this route should redirect to `/` (the dashboard). Convert it to a redirect-only route.

**Files:**
- Modify: `apps/portal-web/src/routes/_portal.insights.tsx`

- [ ] **Step 1: Replace the file with a redirect route**

Replace the entire contents of `apps/portal-web/src/routes/_portal.insights.tsx`:

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_portal/insights")({
  beforeLoad: () => {
    throw redirect({ to: "/" })
  },
  component: () => null,
})
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/portal-web && pnpm tsc --noEmit 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/portal-web/src/routes/_portal.insights.tsx
git commit -m "feat: redirect /insights to dashboard"
```

---

### Task 6: Build and deploy

**Files:** None — build and deploy only.

- [ ] **Step 1: Run the full build**

```bash
cd C:/Users/miste/intuitivestay/intuitivestay && pnpm build 2>&1 | tail -30
```

Expected: build succeeds with no TypeScript errors. If it fails, read the full error and fix the relevant file before proceeding.

- [ ] **Step 2: Push to Railway**

```bash
git push origin main
```

Expected: Railway picks up the push and deploys. Visit the Railway dashboard to confirm the deployment succeeds.

- [ ] **Step 3: Verify in production**

Log in as a Host or Partner user and confirm:
- Sidebar shows only: Dashboard, Feedback, QR Codes (under "My Property")
- No Admin, Organisation, Workspace, Insights, Alerts, or Plans & Billing items in sidebar
- Profile dropdown shows: Account Details, Plans & Billing, Sign Out
- Navigating to `/` redirects to the property dashboard
- Navigating to `/insights` redirects to `/`
- Navigating to `/properties` redirects to the property dashboard

Log in as a Founder user and confirm:
- Sidebar shows "My Properties" with "All Properties" link
- Profile dropdown works correctly
- `/properties` loads the full property list
