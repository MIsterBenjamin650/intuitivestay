import * as React from "react"
import { PropertySwitcher } from "@/components/property-switcher"
import { useActiveProperty } from "@/lib/active-property-context"
import { isRouteActive, resolveNavigation, type ResolvedNavItem } from "@/lib/navigation"
import { resolvePortalAccess } from "@/lib/portal-access"
import { cn } from "@intuitive-stay/ui/lib/utils"
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
import { useLocation, useNavigate, useRouter } from "@tanstack/react-router"
import {
  BarChart3Icon,
  BellIcon,
  Building2Icon,
  BuildingIcon,
  CreditCardIcon,
  LayoutDashboardIcon,
  LockIcon,
  QrCodeIcon,
  TrendingUpIcon,
  UserCogIcon,
  UsersIcon,
} from "lucide-react"

const ICONS: Record<string, React.ReactNode> = {
  dashboard: <LayoutDashboardIcon />,
  properties: <Building2Icon />,
  "property-dashboard": <LayoutDashboardIcon />,
  "property-alerts": <BellIcon />,
  "property-feedback": <UsersIcon />,
  "property-insights": <BarChart3Icon />,
  "property-advanced-insights": <TrendingUpIcon />,
  "property-qr-form": <QrCodeIcon />,
  "property-local-market": <BuildingIcon />,
  "organisation-members": <UsersIcon />,
  "organisation-roles": <UserCogIcon />,
  "organisation-alerts": <BellIcon />,
  "organisation-billing": <CreditCardIcon />,
}

const SIDEBAR_WORDMARK = "Intuitive Stay"

function SidebarBrand() {
  return (
    <div className="flex min-h-8 items-center px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
      <span className="truncate text-sm font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
        {SIDEBAR_WORDMARK}
      </span>
      <span
        className="hidden size-8 items-center justify-center rounded-md border border-sidebar-primary bg-transparent text-xs font-semibold text-white group-data-[collapsible=icon]:inline-flex"
        aria-label={SIDEBAR_WORDMARK}
        title={SIDEBAR_WORDMARK}
      >
        IS
      </span>
    </div>
  )
}

function SidebarEntry({
  item,
  pathname,
  muted,
}: {
  item: ResolvedNavItem
  pathname: string
  muted?: boolean
}) {
  const router = useRouter()
  const navigate = useNavigate()
  const hasCountBadge = typeof item.badgeCount === "number" && item.badgeCount > 0
  const hasTextBadge = Boolean(item.badgeLabel)
  const isLocalMarketUpgrade =
    item.id === "property-local-market" && item.locked && item.badgeVariant === "upgrade"

  const textBadgeClassName = cn(
    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
    item.badgeVariant === "upgrade"
      ? "text-white bg-gradient-to-r from-orange-500 via-fuchsia-500 to-violet-500"
      : undefined,
    item.badgeVariant === "plan-essentialist"
      ? "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-200"
      : undefined,
    item.badgeVariant === "plan-growth-pro"
      ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
      : undefined,
    item.badgeVariant === "plan-elite-mastery"
      ? "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
      : undefined,
    hasCountBadge ? "ml-1" : "ml-auto"
  )

  const preloadRoute = React.useCallback(() => {
    void router.preloadRoute({
      to: item.destination.to as never,
      search: item.destination.search as never,
    })
  }, [item.destination.search, item.destination.to, router])

  const navigateToRoute = React.useCallback(() => {
    void navigate({
      to: item.destination.to as never,
      search: item.destination.search as never,
    })
  }, [item.destination.search, item.destination.to, navigate])

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={item.label}
        isActive={isRouteActive(pathname, item.to)}
        className={cn(muted ? "text-sidebar-foreground/80" : undefined)}
        onMouseEnter={preloadRoute}
        onFocus={preloadRoute}
        onClick={navigateToRoute}
      >
        {ICONS[item.id]}
        <span>{item.label}</span>
        {hasCountBadge ? (
          <span className="ml-auto inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
            {item.badgeCount}
          </span>
        ) : null}
        {hasTextBadge ? (
          <span className={textBadgeClassName}>
            {item.badgeLabel}
          </span>
        ) : null}
        {item.locked && !isLocalMarketUpgrade ? (
          <span
            className={cn(
              "inline-flex items-center text-primary",
              hasCountBadge || hasTextBadge ? "ml-1" : "ml-auto"
            )}
          >
            <LockIcon />
          </span>
        ) : null}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export function AppSidebar({
  session,
  ...props
}: React.ComponentProps<typeof Sidebar> & { session: unknown }) {
  const location = useLocation()
  const { activePropertyId, properties } = useActiveProperty()

  const access = React.useMemo(() => resolvePortalAccess(session), [session])
  const navigation = React.useMemo(
    () =>
      resolveNavigation({
        access,
        activePropertyId,
        currentPath: location.pathname,
      }),
    [access, activePropertyId, location.pathname]
  )

  const currentPropertySection = navigation.find((item) => item.id === "current-property")
  const organisationSection = navigation.find((item) => item.id === "organisation")
  const dashboardItem = navigation.find((item) => item.id === "dashboard")
  const propertiesItem = navigation.find((item) => item.id === "properties")

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
              {dashboardItem ? <SidebarEntry item={dashboardItem} pathname={location.pathname} /> : null}
              {propertiesItem ? <SidebarEntry item={propertiesItem} pathname={location.pathname} /> : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {properties.length > 0 && currentPropertySection?.children?.length ? (
          <SidebarGroup>
            <SidebarGroupLabel>{currentPropertySection.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {currentPropertySection.children.map((item) => (
                  <SidebarEntry key={item.id} item={item} pathname={location.pathname} muted />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}

        {organisationSection?.children?.length ? (
          <SidebarGroup>
            <SidebarGroupLabel>{organisationSection.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {organisationSection.children.map((item) => (
                  <SidebarEntry key={item.id} item={item} pathname={location.pathname} muted />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
