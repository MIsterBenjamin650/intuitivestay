import * as React from "react"
import { PropertySwitcher } from "@/components/property-switcher"
import { useActiveProperty } from "@/lib/active-property-context"
import { buildPropertyPath } from "@/lib/property-routes"
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
import {
  createLink,
  type LinkComponent,
  useLocation,
} from "@tanstack/react-router"
import {
  Building2Icon,
  LayoutDashboardIcon,
  QrCodeIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react"


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
  const propertyQrFormPath = buildPropertyPath(activePropertyId, "qr-form")

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
}
