# Portal Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat grey portal UI with a vibrant modern design — Inter font, dark indigo sidebar with gradient, and colour-accented stat cards on both dashboards.

**Architecture:** Pure frontend styling changes. No API or database changes required. CSS variables in `packages/ui/src/styles/globals.css` control sidebar token colours; dashboard routes are rewritten in-place using inline stat card and pillar card components.

**Tech Stack:** React, TanStack Router, Tailwind CSS v4 (`@theme inline` syntax), Recharts, shadcn/ui Sidebar components.

---

### Task 1: Switch font from Public Sans to Inter

**Files:**
- Modify: `packages/ui/src/styles/globals.css`
- Modify: `apps/portal-web/src/routes/__root.tsx`

**Context:** The project uses Tailwind v4. The active font is `Public Sans Variable` loaded via `@import "@fontsource-variable/public-sans"` and registered as `--font-sans` in the `@theme inline` block of `globals.css`. Switch to Inter via Google Fonts — no npm package needed.

- [ ] **Step 1: Add Inter font links to the root head**

Open `apps/portal-web/src/routes/__root.tsx`. The `head()` function returns a `links` array. Replace it so Inter is loaded before the app CSS:

```tsx
links: [
  {
    rel: "preconnect",
    href: "https://fonts.googleapis.com",
  },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
  },
  {
    rel: "stylesheet",
    href: appCss,
  },
],
```

- [ ] **Step 2: Update globals.css to use Inter**

Open `packages/ui/src/styles/globals.css`.

Remove this line at the top:
```css
@import "@fontsource-variable/public-sans";
```

Inside the `@theme inline { ... }` block, change:
```css
--font-sans: 'Public Sans Variable', sans-serif;
```
to:
```css
--font-sans: 'Inter', system-ui, sans-serif;
```

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/styles/globals.css apps/portal-web/src/routes/__root.tsx
git commit -m "style: switch portal font from Public Sans to Inter via Google Fonts"
```

---

### Task 2: Sidebar — dark CSS variables

**Files:**
- Modify: `packages/ui/src/styles/globals.css`

**Context:** shadcn's Sidebar component reads colours from CSS variables: `--sidebar`, `--sidebar-foreground`, `--sidebar-accent`, etc. Update these in both `:root` and `.dark` to produce white text on a dark indigo background. The gradient itself is added in Task 3 via a Tailwind class on the `<Sidebar>` component — CSS variables can't hold gradients.

- [ ] **Step 1: Replace sidebar variables in :root**

In `packages/ui/src/styles/globals.css`, inside the `:root { ... }` block, replace all lines beginning with `--sidebar` with:

```css
  --sidebar: #1e1b4b;
  --sidebar-foreground: #ffffff;
  --sidebar-primary: #a5b4fc;
  --sidebar-primary-foreground: #1e1b4b;
  --sidebar-accent: rgba(255, 255, 255, 0.12);
  --sidebar-accent-foreground: #ffffff;
  --sidebar-border: rgba(255, 255, 255, 0.08);
  --sidebar-ring: rgba(255, 255, 255, 0.3);
```

- [ ] **Step 2: Replace sidebar variables in .dark**

Inside the `.dark { ... }` block, replace all lines beginning with `--sidebar` with the same values (the dark sidebar looks identical in light and dark mode):

```css
  --sidebar: #1e1b4b;
  --sidebar-foreground: #ffffff;
  --sidebar-primary: #a5b4fc;
  --sidebar-primary-foreground: #1e1b4b;
  --sidebar-accent: rgba(255, 255, 255, 0.12);
  --sidebar-accent-foreground: #ffffff;
  --sidebar-border: rgba(255, 255, 255, 0.08);
  --sidebar-ring: rgba(255, 255, 255, 0.3);
```

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/styles/globals.css
git commit -m "style: update sidebar CSS variables for dark indigo theme"
```

---

### Task 3: Sidebar — gradient background, brand, labels, active indicator

**Files:**
- Modify: `apps/portal-web/src/components/app-sidebar.tsx`

**Context:** The sidebar renders two `<Sidebar>` components (one for admin, one for owner). Add the gradient class to both. Update `SidebarBrand`, `SidebarGroupLabel` instances, and `SidebarLinkItem` to add the left-edge active indicator bar.

- [ ] **Step 1: Add gradient class to both Sidebar instances**

There are two `<Sidebar collapsible="icon" {...props}>` usages — one in the `if (isAdmin)` branch (~line 150) and one in the owner return (~line 184). Change both to:

```tsx
<Sidebar
  collapsible="icon"
  className="[background:linear-gradient(180deg,#1e1b4b_0%,#312e81_100%)] border-r-0"
  {...props}
>
```

- [ ] **Step 2: Update SidebarBrand**

Replace the existing `SidebarBrand` function (lines ~57–72) with:

```tsx
function SidebarBrand() {
  return (
    <div className="flex min-h-8 items-center px-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
      <span className="truncate text-[15px] font-bold tracking-[-0.4px] text-white group-data-[collapsible=icon]:hidden">
        Intuitive Stay
      </span>
      <span
        className="hidden size-8 items-center justify-center rounded-md bg-white/10 text-xs font-bold text-white group-data-[collapsible=icon]:inline-flex"
        aria-label="Intuitive Stay"
        title="Intuitive Stay"
      >
        IS
      </span>
    </div>
  )
}
```

- [ ] **Step 3: Update SidebarGroupLabel in all four usages**

The `<SidebarGroupLabel>` component renders with its own internal styling. Override it by passing `className` to each instance. Find all four usages (Workspace, Current Property, Organisation, Admin) and update each to:

```tsx
<SidebarGroupLabel className="px-4 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/35">
  Workspace
</SidebarGroupLabel>

<SidebarGroupLabel className="px-4 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/35">
  Current Property
</SidebarGroupLabel>

<SidebarGroupLabel className="px-4 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/35">
  Organisation
</SidebarGroupLabel>

<SidebarGroupLabel className="px-4 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/35">
  Admin
</SidebarGroupLabel>
```

- [ ] **Step 4: Add active left-bar indicator to SidebarLinkItem**

Replace the existing `SidebarLinkItem` function (lines ~82–124) with:

```tsx
function SidebarLinkItem({
  label,
  icon,
  link,
  isActive,
  muted,
  badge,
  disabled,
}: {
  label: string
  icon: React.ReactNode
  link: React.ReactElement
  isActive: boolean
  muted?: boolean
  badge?: React.ReactNode
  disabled?: boolean
}) {
  return (
    <SidebarMenuItem className="relative">
      {isActive && !disabled && (
        <span className="pointer-events-none absolute left-0 top-1 bottom-1 z-10 w-[3px] rounded-r bg-[#a5b4fc]" />
      )}
      <SidebarMenuButton
        render={disabled ? undefined : link}
        tooltip={label}
        isActive={disabled ? false : isActive}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : undefined}
        className={cn(
          !disabled && muted ? "text-sidebar-foreground/80" : undefined,
          disabled
            ? "cursor-default aria-disabled:opacity-100 hover:bg-transparent hover:text-sidebar-foreground active:bg-transparent active:text-sidebar-foreground focus-visible:ring-0 focus-visible:ring-transparent"
            : undefined,
        )}
      >
        <span className={cn(disabled ? "text-sidebar-foreground/50" : undefined)}>
          {icon}
        </span>
        <span className={cn(disabled ? "text-sidebar-foreground/50" : undefined)}>
          {label}
        </span>
        {badge}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/portal-web/src/components/app-sidebar.tsx
git commit -m "style: dark indigo sidebar with gradient, Inter font, active indicator, updated labels"
```

---

### Task 4: Organisation Dashboard redesign

**Files:**
- Modify: `apps/portal-web/src/routes/_portal.index.tsx`

**Context:** Replace the current minimal dashboard with 3 colour-accented stat cards and an area chart with gradient fill. The `getPortfolioDashboard` tRPC query returns `{ portfolioGcs, activeCount, alertCount, monthlyTrend }` — no backend changes needed.

- [ ] **Step 1: Replace _portal.index.tsx entirely**

```tsx
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useRouteContext } from "@tanstack/react-router"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { AdminDashboard } from "@/components/admin-dashboard"
import { useTRPC } from "@/utils/trpc"

export const Route = createFileRoute("/_portal/")({
  component: RouteComponent,
})

type StatColor = "indigo" | "teal" | "orange"

const COLOR_MAP: Record<StatColor, string> = {
  indigo: "#6366f1",
  teal:   "#14b8a6",
  orange: "#f97316",
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub?: string
  color: StatColor
}) {
  const c = COLOR_MAP[color]
  return (
    <div
      className="rounded-xl bg-white p-4 shadow-sm"
      style={{ borderLeft: `5px solid ${c}` }}
    >
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-[#9ca3af]">
        {label}
      </p>
      <p
        className="text-[28px] font-extrabold leading-none tracking-tight"
        style={{ color: c }}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-1 text-[11px] font-medium text-[#9ca3af]">{sub}</p>
      )}
    </div>
  )
}

function PortfolioDashboard() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(
    trpc.properties.getPortfolioDashboard.queryOptions(),
  )

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Portfolio GCS"
          color="indigo"
          value={
            isLoading
              ? "—"
              : data?.portfolioGcs != null
                ? data.portfolioGcs.toFixed(1)
                : "No data"
          }
          sub="Guest Comfort Score"
        />
        <StatCard
          label="Active Properties"
          color="teal"
          value={isLoading ? "—" : String(data?.activeCount ?? 0)}
          sub="Approved properties"
        />
        <StatCard
          label="Open Alerts"
          color="orange"
          value={isLoading ? "—" : String(data?.alertCount ?? 0)}
          sub="Scores at or below 5.0"
        />
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <p className="text-[14px] font-bold text-[#111827]">
          Guest Satisfaction Over Time
        </p>
        <p className="mb-4 mt-0.5 text-[11px] font-medium text-[#9ca3af]">
          Average GCS across all properties
        </p>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !data?.monthlyTrend.length ? (
          <p className="text-sm text-muted-foreground">
            No feedback yet. Scores will appear once guests start submitting.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.monthlyTrend}>
              <defs>
                <linearGradient id="gcsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 10]}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  fontSize: 12,
                }}
                formatter={(v) => (typeof v === "number" ? v.toFixed(2) : v)}
              />
              <Area
                type="monotone"
                dataKey="score"
                stroke="#6366f1"
                strokeWidth={2.5}
                fill="url(#gcsGradient)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

function RouteComponent() {
  const { session } = useRouteContext({ from: "/_portal" })
  const isAdmin = (session as { isAdmin?: boolean } | null)?.isAdmin === true
  if (isAdmin) return <AdminDashboard />
  return <PortfolioDashboard />
}
```

- [ ] **Step 2: Verify**

Navigate to `/` as a non-admin owner. Should show 3 coloured stat cards (indigo GCS, teal Properties, orange Alerts) and an area chart with indigo gradient fill.

- [ ] **Step 3: Commit**

```bash
git add "apps/portal-web/src/routes/_portal.index.tsx"
git commit -m "style: redesign org dashboard with coloured stat cards and area chart"
```

---

### Task 5: Property Dashboard redesign

**Files:**
- Modify: `apps/portal-web/src/routes/_portal.properties.$propertyId.dashboard.tsx`

**Context:** The `getPropertyDashboard` tRPC query returns `{ name, type, city, country, status, avgGcs, avgResilience, avgEmpathy, avgAnticipation, avgRecognition, totalFeedback }`. Numeric fields from the DB arrive as strings — wrap in `Number()` before calling `.toFixed()`.

- [ ] **Step 1: Replace the property dashboard file entirely**

```tsx
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { useTRPC } from "@/utils/trpc"

export const Route = createFileRoute(
  "/_portal/properties/$propertyId/dashboard",
)({
  component: RouteComponent,
})

type StatColor = "indigo" | "teal" | "orange" | "purple"

const COLOR_VALUES: Record<StatColor, string> = {
  indigo: "#6366f1",
  teal:   "#14b8a6",
  orange: "#f97316",
  purple: "#8b5cf6",
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub?: string
  color: StatColor
}) {
  const c = COLOR_VALUES[color]
  return (
    <div
      className="rounded-xl bg-white p-4 shadow-sm"
      style={{ borderLeft: `5px solid ${c}` }}
    >
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-[#9ca3af]">
        {label}
      </p>
      <p
        className="text-[28px] font-extrabold leading-none tracking-tight"
        style={{ color: c }}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-1 text-[11px] font-medium text-[#9ca3af]">{sub}</p>
      )}
    </div>
  )
}

function PillarCard({
  label,
  score,
  color,
}: {
  label: string
  score: number | null
  color: StatColor
}) {
  const c = COLOR_VALUES[color]
  const pct = score != null ? Math.round((score / 10) * 100) : 0
  return (
    <div className="rounded-xl bg-white p-4 text-center shadow-sm">
      <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-[#9ca3af]">
        {label}
      </p>
      <div className="mb-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[#f3f4f6]">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: c }}
        />
      </div>
      <p
        className="text-[24px] font-extrabold leading-none tracking-tight"
        style={{ color: c }}
      >
        {score != null ? score.toFixed(2) : "—"}
      </p>
    </div>
  )
}

function RouteComponent() {
  const { propertyId } = Route.useParams()
  const trpc = useTRPC()
  const { data, isLoading, isError } = useQuery(
    trpc.properties.getPropertyDashboard.queryOptions({ propertyId }),
  )

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>
  }

  if (isError || !data) {
    return (
      <div className="p-6 text-sm text-destructive">
        Failed to load property data.
      </div>
    )
  }

  const statusLabel =
    data.status === "approved"
      ? "Approved ✓"
      : String(data.status).charAt(0).toUpperCase() + String(data.status).slice(1)

  const pillars: { label: string; score: number | null; color: StatColor }[] = [
    { label: "Resilience",   score: data.avgResilience != null   ? Number(data.avgResilience)   : null, color: "indigo"  },
    { label: "Empathy",      score: data.avgEmpathy != null      ? Number(data.avgEmpathy)      : null, color: "teal"    },
    { label: "Anticipation", score: data.avgAnticipation != null ? Number(data.avgAnticipation) : null, color: "purple"  },
    { label: "Recognition",  score: data.avgRecognition != null  ? Number(data.avgRecognition)  : null, color: "orange"  },
  ]

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="GCS Score"
          color="indigo"
          value={data.avgGcs != null ? Number(data.avgGcs).toFixed(2) : "—"}
          sub="Out of 10"
        />
        <StatCard
          label="Total Feedback"
          color="teal"
          value={String(data.totalFeedback)}
          sub="All time submissions"
        />
        <StatCard
          label="Status"
          color="purple"
          value={statusLabel}
          sub={[data.type, data.city].filter(Boolean).join(" · ")}
        />
      </div>

      <div>
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.08em] text-[#9ca3af]">
          Pillar Averages
        </p>
        <div className="grid gap-4 md:grid-cols-4">
          {pillars.map(({ label, score, color }) => (
            <PillarCard key={label} label={label} score={score} color={color} />
          ))}
        </div>
      </div>

      {data.totalFeedback === 0 && (
        <p className="text-sm text-muted-foreground">
          No feedback yet. Share the QR code with guests to start collecting data.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Navigate to the property dashboard. Should show GCS (indigo), Total Feedback (teal), Status (purple) stat cards, then 4 pillar cards with coloured progress bars.

- [ ] **Step 3: Commit**

```bash
git add "apps/portal-web/src/routes/_portal.properties.\$propertyId.dashboard.tsx"
git commit -m "style: redesign property dashboard with coloured stat cards and pillar progress bars"
```

---

### Task 6: Content area and topbar polish

**Files:**
- Modify: `apps/portal-web/src/routes/_portal.tsx`

**Context:** The spec calls for a `#f8fafc` content background (very light blue-grey) and a clean white topbar at 54px height. Currently `SidebarInset` uses `bg-background` and the header is `h-16` (64px). Update both.

- [ ] **Step 1: Update SidebarInset background and topbar height**

In `apps/portal-web/src/routes/_portal.tsx`, in the `RouteComponent` function, update `SidebarInset` and `header`:

```tsx
<SidebarInset className="overflow-x-hidden bg-[#f8fafc]">
  <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center border-b bg-white/90 backdrop-blur-md">
    <div className="flex w-full items-center justify-between gap-3 px-3 md:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <div className="relative w-full max-w-sm md:max-w-md">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search"
            className="h-9 pr-14 pl-9"
            aria-label="Search"
          />
          <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded-md border border-border/70 bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
            ⌘ F
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 md:gap-2">
        <TopbarThemeSwitcher />
        <TopbarNotifications />
        <TopbarUserMenu />
      </div>
    </div>
  </header>
  <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden pt-3">
    <Outlet />
  </div>
</SidebarInset>
```

The only changes from the current file are:
- `SidebarInset` gains `bg-[#f8fafc]`
- `header` changes from `h-16` to `h-14`
- `bg-background/90` changes to `bg-white/90`

- [ ] **Step 2: Push to Railway and verify full redesign**

```bash
git add apps/portal-web/src/routes/_portal.tsx
git commit -m "style: set content area to #f8fafc and topbar to 54px white"
git push
```

Wait for Railway to redeploy, then verify:
1. Inter font renders throughout
2. Sidebar has dark indigo gradient with white text
3. Active nav item has left purple bar + highlighted background
4. Org dashboard has 3 coloured stat cards + area chart
5. Property dashboard has 3 stat cards + 4 pillar cards with progress bars
6. Content area background is light blue-grey, not pure white
