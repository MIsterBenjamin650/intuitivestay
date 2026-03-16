import {
  hasPermission,
  meetsPlan,
  type LockedFeatureKey,
  type PlanTier,
  type PortalAccess,
  type PortalPermission,
} from "@/lib/portal-access"

export type NavScope = "org" | "property"

export type NavItem = {
  id: string
  label: string
  to: string
  scope: NavScope
  permission?: PortalPermission
  requiredPlan?: PlanTier
  lockedFeatureKey?: LockedFeatureKey
  badgeCount?: number
  badgeLabel?: string
  badgeVariant?: "count" | "upgrade"
  children?: NavItem[]
}

export type NavDestination = {
  to: string
  search?: {
    upgrade?: string
    from?: string
  }
}

export type ResolvedNavItem = Omit<NavItem, "children"> & {
  to: string
  destination: NavDestination
  locked: boolean
  badgeCount?: number
  badgeLabel?: string
  badgeVariant?: "count" | "upgrade"
  children?: ResolvedNavItem[]
}

export type PropertyRouteKey =
  | "dashboard"
  | "alerts"
  | "feedback"
  | "insights"
  | "advanced-insights"
  | "qr-form"
  | "local-market"

const PROPERTY_ROUTE_TEMPLATES: Record<PropertyRouteKey, string> = {
  dashboard: "/properties/:propertyId/dashboard",
  alerts: "/properties/:propertyId/alerts",
  feedback: "/properties/:propertyId/feedback",
  insights: "/properties/:propertyId/insights",
  "advanced-insights": "/properties/:propertyId/advanced-insights",
  "qr-form": "/properties/:propertyId/qr-form",
  "local-market": "/properties/:propertyId/local-market",
}

const SEEDED_ORG_ALERT_COUNT = 12
const SEEDED_PROPERTY_ALERT_COUNTS: Record<string, number> = {
  "ben-hostels-london": 5,
  "ben-hostels-york": 4,
  "ben-hostels-edinburgh": 3,
}

function getSeededPropertyAlertCount(propertyId: string) {
  return SEEDED_PROPERTY_ALERT_COUNTS[propertyId] ?? 0
}

export function buildPropertyPath(propertyId: string, page: PropertyRouteKey) {
  return PROPERTY_ROUTE_TEMPLATES[page].replace(":propertyId", propertyId)
}

export function isPropertyPath(pathname: string) {
  return pathname.startsWith("/properties/") && pathname.split("/").length > 3
}

export function getPropertyIdFromPath(pathname: string) {
  if (!pathname.startsWith("/properties/")) {
    return null
  }

  const [, , propertyId] = pathname.split("/")
  return propertyId || null
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    to: "/",
    scope: "org",
    permission: "view_dashboard",
  },
  {
    id: "properties",
    label: "Properties",
    to: "/properties",
    scope: "org",
    permission: "manage_properties",
  },
  {
    id: "current-property",
    label: "Current Property",
    to: "/properties/:propertyId/dashboard",
    scope: "property",
    permission: "view_property_dashboard",
    children: [
      {
        id: "property-dashboard",
        label: "Dashboard",
        to: "/properties/:propertyId/dashboard",
        scope: "property",
        permission: "view_property_dashboard",
      },
      {
        id: "property-feedback",
        label: "Feedback",
        to: "/properties/:propertyId/feedback",
        scope: "property",
        permission: "view_feedback",
      },
      {
        id: "property-insights",
        label: "Insights",
        to: "/properties/:propertyId/insights",
        scope: "property",
        permission: "view_insights",
      },
      {
        id: "property-advanced-insights",
        label: "Advanced Insights",
        to: "/properties/:propertyId/advanced-insights",
        scope: "property",
        permission: "view_advanced_insights",
      },
      {
        id: "property-qr-form",
        label: "QR Form",
        to: "/properties/:propertyId/qr-form",
        scope: "property",
        permission: "view_qr_form",
      },
      {
        id: "property-alerts",
        label: "Alerts",
        to: "/properties/:propertyId/alerts",
        scope: "property",
        permission: "view_alerts",
      },
      {
        id: "property-local-market",
        label: "Local Market",
        to: "/properties/:propertyId/local-market",
        scope: "property",
        permission: "view_local_market",
        requiredPlan: "elite-mastery",
        lockedFeatureKey: "local-market",
      },
    ],
  },
  {
    id: "organisation",
    label: "Organisation",
    to: "/organisation/members",
    scope: "org",
    permission: "manage_members",
    children: [
      {
        id: "organisation-members",
        label: "Members",
        to: "/organisation/members",
        scope: "org",
        permission: "manage_members",
      },
      {
        id: "organisation-roles",
        label: "Roles & Permissions",
        to: "/organisation/roles-permissions",
        scope: "org",
        permission: "manage_roles",
      },
      {
        id: "organisation-alerts",
        label: "Alerts",
        to: "/organisation/alerts",
        scope: "org",
        permission: "view_alerts",
        badgeCount: SEEDED_ORG_ALERT_COUNT,
      },
      {
        id: "organisation-billing",
        label: "Plans & Billing",
        to: "/organisation/billing",
        scope: "org",
        permission: "manage_billing",
        badgeLabel: "Upgrade",
        badgeVariant: "upgrade",
      },
    ],
  },
]

type ResolveNavOptions = {
  access: PortalAccess
  activePropertyId: string
  currentPath: string
}

function resolveTo(to: string, activePropertyId: string) {
  return to.replace(":propertyId", activePropertyId)
}

function resolveItem(item: NavItem, options: ResolveNavOptions): ResolvedNavItem | null {
  if (!hasPermission(options.access, item.permission)) {
    return null
  }

  const locked = !meetsPlan(options.access, item.requiredPlan)
  const to = resolveTo(item.to, options.activePropertyId)

  const destination: NavDestination =
    locked && item.lockedFeatureKey
      ? {
          to: "/organisation/billing",
          search: {
            upgrade: item.lockedFeatureKey,
            from: options.currentPath,
          },
        }
      : { to }

  const seededBadgeCount =
    item.id === "property-alerts"
      ? getSeededPropertyAlertCount(options.activePropertyId)
      : item.badgeCount

  const children =
    item.children
      ?.map((child) => resolveItem(child, options))
      .filter((child): child is ResolvedNavItem => child !== null) ?? undefined

  if (item.children && (!children || children.length === 0)) {
    return null
  }

  return {
    ...item,
    to,
    destination,
    locked,
    badgeCount: seededBadgeCount,
    children,
  }
}

export function resolveNavigation(options: ResolveNavOptions) {
  return NAV_ITEMS.map((item) => resolveItem(item, options)).filter(
    (item): item is ResolvedNavItem => item !== null
  )
}

export function isRouteActive(pathname: string, to: string) {
  if (to === "/") {
    return pathname === "/"
  }

  return pathname === to || pathname.startsWith(`${to}/`)
}
