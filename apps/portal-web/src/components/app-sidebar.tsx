import * as React from "react"
import { PropertySwitcher } from "@/components/property-switcher"
import { useActiveProperty } from "@/lib/active-property-context"
import { buildPropertyPath } from "@/lib/property-routes"
import { cn } from "@intuitive-stay/ui/lib/utils"
import { Badge } from "@intuitive-stay/ui/components/badge"
import { PlanBadge } from "@intuitive-stay/ui/components/plan-badge"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@intuitive-stay/ui/components/sidebar"
import { UpgradeBadge } from "@intuitive-stay/ui/components/upgrade-badge"
import {
  createLink,
  type LinkComponent,
  useLocation,
} from "@tanstack/react-router"
import {
  BarChart3Icon,
  BellIcon,
  Building2Icon,
  BuildingIcon,
  CreditCardIcon,
  LayoutDashboardIcon,
  QrCodeIcon,
  ShieldCheckIcon,
  TrendingUpIcon,
  UserCogIcon,
  UsersIcon,
} from "lucide-react"

const SIDEBAR_WORDMARK = "Intuitive Stay"

const SidebarAnchor = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<"a">
>(({ className, ...props }, ref) => {
  return <a ref={ref} className={className} {...props} />
})

SidebarAnchor.displayName = "SidebarAnchor"

const CreatedSidebarLink = createLink(SidebarAnchor)

const AppSidebarLink: LinkComponent<typeof SidebarAnchor> = (props) => {
  return <CreatedSidebarLink preload="intent" {...props} />
}

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

function isRouteActive(pathname: string, to: string) {
  if (to === "/") {
    return pathname === "/"
  }

  return pathname === to || pathname.startsWith(`${to}/`)
}

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

export function AppSidebar({
  isAdmin = false,
  plan = null,
  subscriptionStatus = "none",
  ...props
}: React.ComponentProps<typeof Sidebar> & { isAdmin?: boolean; plan?: string | null; subscriptionStatus?: string }) {
  const location = useLocation()
  const { activePropertyId, properties } = useActiveProperty()

  const hasProperties = properties.length > 0 && Boolean(activePropertyId)
  const propertyParams = { propertyId: activePropertyId }
  const propertyDashboardPath = buildPropertyPath(activePropertyId, "dashboard")
  const propertyFeedbackPath = buildPropertyPath(activePropertyId, "feedback")
  const propertyInsightsPath = buildPropertyPath(activePropertyId, "insights")
  const propertyAdvancedInsightsPath = buildPropertyPath(
    activePropertyId,
    "advanced-insights"
  )
  const propertyQrFormPath = buildPropertyPath(activePropertyId, "qr-form")
  const propertyAlertsPath = buildPropertyPath(activePropertyId, "alerts")
  const propertyLocalMarketPath = buildPropertyPath(activePropertyId, "local-market")

  if (isAdmin) {
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
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="px-4 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/35">Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarLinkItem
                  label="Dashboard"
                  icon={<LayoutDashboardIcon />}
                  link={<AppSidebarLink to="/" />}
                  isActive={isRouteActive(location.pathname, "/")}
                />
                <SidebarLinkItem
                  label="Approvals"
                  icon={<ShieldCheckIcon />}
                  link={<AppSidebarLink to="/admin/approvals" />}
                  isActive={isRouteActive(location.pathname, "/admin/approvals")}
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarRail />
      </Sidebar>
    )
  }

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
        <div className="p-2">
          <PropertySwitcher />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/35">Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarLinkItem
                label="Dashboard"
                icon={<LayoutDashboardIcon />}
                link={<AppSidebarLink to="/" />}
                isActive={isRouteActive(location.pathname, "/")}
              />
              <SidebarLinkItem
                label="Properties"
                icon={<Building2Icon />}
                link={<AppSidebarLink to="/properties" />}
                isActive={isRouteActive(location.pathname, "/properties")}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {hasProperties ? (
          <SidebarGroup>
            <SidebarGroupLabel className="px-4 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/35">Current Property</SidebarGroupLabel>
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
                  muted
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
                  muted
                />
                <SidebarLinkItem
                  label="Insights"
                  icon={<BarChart3Icon />}
                  link={
                    <AppSidebarLink
                      to="/properties/$propertyId/insights"
                      params={propertyParams}
                    />
                  }
                  isActive={isRouteActive(location.pathname, propertyInsightsPath)}
                  muted
                />
                <SidebarLinkItem
                  label="Advanced Insights"
                  icon={<TrendingUpIcon />}
                  link={
                    <AppSidebarLink
                      to="/properties/$propertyId/advanced-insights"
                      params={propertyParams}
                    />
                  }
                  isActive={isRouteActive(location.pathname, propertyAdvancedInsightsPath)}
                  muted
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
                  muted
                />
                <SidebarLinkItem
                  label="Alerts"
                  icon={<BellIcon />}
                  link={
                    <AppSidebarLink
                      to="/properties/$propertyId/alerts"
                      params={propertyParams}
                    />
                  }
                  isActive={isRouteActive(location.pathname, propertyAlertsPath)}
                  muted
                  badge={<Badge className="ml-auto">3</Badge>}
                />
                <SidebarLinkItem
                  label="Local Market"
                  icon={<BuildingIcon />}
                  link={
                    <AppSidebarLink
                      to="/properties/$propertyId/local-market"
                      params={propertyParams}
                    />
                  }
                  isActive={isRouteActive(location.pathname, propertyLocalMarketPath)}
                  disabled
                  badge={<UpgradeBadge className="ml-auto">Upgrade</UpgradeBadge>}
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}

        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/35">Organisation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarLinkItem
                label="Members"
                icon={<UsersIcon />}
                link={<AppSidebarLink to="/organisation/members" />}
                isActive={isRouteActive(location.pathname, "/organisation/members")}
                muted
              />
              <SidebarLinkItem
                label="Roles & Permissions"
                icon={<UserCogIcon />}
                link={<AppSidebarLink to="/organisation/roles-permissions" />}
                isActive={isRouteActive(
                  location.pathname,
                  "/organisation/roles-permissions"
                )}
                muted
              />
              <SidebarLinkItem
                label="Alerts"
                icon={<BellIcon />}
                link={<AppSidebarLink to="/organisation/alerts" />}
                isActive={isRouteActive(location.pathname, "/organisation/alerts")}
                muted
                badge={<Badge className="ml-auto">12</Badge>}
              />
              <SidebarLinkItem
                label="Plans & Billing"
                icon={<CreditCardIcon />}
                link={<AppSidebarLink to="/organisation/billing" />}
                isActive={isRouteActive(location.pathname, "/organisation/billing")}
                muted
                badge={subscriptionStatus !== "none" && plan ? <PlanBadge variant={plan as "host" | "partner" | "founder"} className="ml-auto" /> : undefined}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/35">Admin</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarLinkItem
                label="Approvals"
                icon={<ShieldCheckIcon />}
                link={<AppSidebarLink to="/admin/approvals" />}
                isActive={isRouteActive(location.pathname, "/admin/approvals")}
                muted
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}
