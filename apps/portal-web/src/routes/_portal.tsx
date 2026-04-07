import { Input } from "@intuitive-stay/ui/components/input";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@intuitive-stay/ui/components/sidebar";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import { TopbarNotifications } from "@/components/topbar-notifications";
import { TopbarThemeSwitcher } from "@/components/topbar-theme-switcher";
import { TopbarUserMenu } from "@/components/topbar-user-menu";
import { getUser } from "@/functions/get-user";
import { ActivePropertyProvider } from "@/lib/active-property-context";
import type { PropertySummary } from "@/lib/active-property-context";

export const Route = createFileRoute("/_portal")({
  beforeLoad: async ({ location }) => {
    let session: Awaited<ReturnType<typeof getUser>>
    try {
      session = await getUser()
    } catch {
      throw redirect({ to: "/login" })
    }

    if (!session) {
      throw redirect({ to: "/login" })
    }

    const isAdmin = (session as { isAdmin?: boolean })?.isAdmin === true
    const isChoosingPlan = location.pathname === "/choose-plan"
    if (!isAdmin && !isChoosingPlan && session.subscriptionStatus === "none") {
      throw redirect({ to: "/choose-plan" })
    }

    return { session }
  },
  component: RouteComponent,
});

function resolveSessionProperties(session: unknown): PropertySummary[] | undefined {
  const user =
    typeof session === "object" && session !== null && "user" in session
      ? (session as { user?: Record<string, unknown> }).user
      : undefined

  const rawProperties = user?.properties
  if (!Array.isArray(rawProperties)) {
    return undefined
  }

  return rawProperties
    .map((property) => {
      if (typeof property !== "object" || property === null) {
        return null
      }

      const record = property as Record<string, unknown>
      const id = record.id ?? record.propertyId ?? record.slug
      const name = record.name ?? record.title ?? record.label

      if (typeof id !== "string" || typeof name !== "string") {
        return null
      }

      if (!id.trim() || !name.trim()) {
        return null
      }

      return {
        id: id.trim(),
        name: name.trim(),
      }
    })
    .filter((property): property is PropertySummary => property !== null)
}

function RouteComponent() {
  const { session } = Route.useRouteContext();
  const sessionProperties = resolveSessionProperties(session);
  const isStaff = (session as { isStaff?: boolean } | null)?.isStaff === true
  const staffPermissions = (session as {
    staffPermissions?: {
      viewFeedback: boolean
      viewAnalytics: boolean
      viewAiSummary: boolean
      viewWordCloud: boolean
      viewStaffCloud: boolean
      viewAlerts: boolean
    } | null
  } | null)?.staffPermissions ?? null

  return (
    <SidebarProvider>
      <ActivePropertyProvider initialProperties={sessionProperties}>
        <AppSidebar
          isAdmin={(session as { isAdmin?: boolean } | null)?.isAdmin === true}
          plan={(session as { plan?: string | null } | null)?.plan ?? null}
          subscriptionStatus={(session as { subscriptionStatus?: string } | null)?.subscriptionStatus ?? "none"}
          isStaff={isStaff}
          staffPermissions={staffPermissions}
          staffPropertyId={(session as { staffPropertyId?: string | null } | null)?.staffPropertyId ?? null}
        />
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
      </ActivePropertyProvider>
    </SidebarProvider>
  );
}
