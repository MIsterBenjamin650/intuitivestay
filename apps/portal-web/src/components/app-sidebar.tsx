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
    <div className="flex min-h-8 items-center px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
      <span className="truncate text-sm font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
        {SIDEBAR_WORDMARK}
      </span>
      <span
        className="hidden size-8 items-center justify-center rounded-md border border-sidebar-primary bg-transparent text-xs font-semibold text-sidebar-foreground dark:text-white group-data-[collapsible=icon]:inline-flex"
        aria-label={SIDEBAR_WORDMARK}
        title={SIDEBAR_WORDMARK}
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
    <SidebarMenuItem>
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
            : undefined
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
  ...props
}: React.ComponentProps<typeof Sidebar>) {
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

  return (
    <Sidebar collapsible="icon" {...props}>
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
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
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
            <SidebarGroupLabel>Current Property</SidebarGroupLabel>
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
          <SidebarGroupLabel>Organisation</SidebarGroupLabel>
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
                badge={<PlanBadge variant="essentialist" className="ml-auto" />}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}
