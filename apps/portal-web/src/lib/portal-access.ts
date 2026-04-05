export type PlanTier = "host" | "partner" | "founder"

export type PortalPermission =
  | "view_dashboard"
  | "manage_properties"
  | "view_property_dashboard"
  | "view_feedback"
  | "view_insights"
  | "view_advanced_insights"
  | "view_qr_form"
  | "view_local_market"
  | "view_alerts"
  | "manage_members"
  | "manage_roles"
  | "view_multi_site"
  | "manage_billing"

export type LockedFeatureKey =
  | "advanced-yearly-trends"
  | "sentiment-vibe-maps"
  | "day-of-week-consistency"
  | "venting-box-red-alerts"
  | "reputation-gap-analysis"
  | "local-city-leaderboard"
  | "market-benchmarking"
  | "multi-site-management"
  | "local-market"

const PLAN_WEIGHT: Record<PlanTier, number> = {
  host: 1,
  partner: 2,
  founder: 3,
}

export const ALL_PERMISSIONS: PortalPermission[] = [
  "view_dashboard",
  "manage_properties",
  "view_property_dashboard",
  "view_feedback",
  "view_insights",
  "view_advanced_insights",
  "view_qr_form",
  "view_local_market",
  "view_alerts",
  "manage_members",
  "manage_roles",
  "view_multi_site",
  "manage_billing",
]

export const FEATURE_MIN_PLAN: Record<LockedFeatureKey, PlanTier> = {
  "advanced-yearly-trends": "founder",
  "sentiment-vibe-maps": "partner",
  "day-of-week-consistency": "partner",
  "venting-box-red-alerts": "partner",
  "reputation-gap-analysis": "founder",
  "local-city-leaderboard": "founder",
  "market-benchmarking": "founder",
  "multi-site-management": "founder",
  "local-market": "founder",
}

export type PortalAccess = {
  plan: PlanTier
  permissions: Set<PortalPermission>
}

function normalizePlan(plan: unknown): PlanTier {
  if (typeof plan !== "string") {
    return "host"
  }

  const normalized = plan.toLowerCase().trim()

  if (normalized.includes("founder") || normalized.includes("elite")) {
    return "founder"
  }

  if (normalized.includes("partner") || normalized.includes("growth")) {
    return "partner"
  }

  // "host" is the default — also covers legacy "essentialist" values
  return "host"
}

function normalizePermissions(input: unknown): Set<PortalPermission> {
  if (!Array.isArray(input)) {
    return new Set(ALL_PERMISSIONS)
  }

  const set = new Set<PortalPermission>()
  for (const permission of input) {
    if (typeof permission !== "string") {
      continue
    }

    if ((ALL_PERMISSIONS as string[]).includes(permission)) {
      set.add(permission as PortalPermission)
    }
  }

  if (set.size === 0) {
    return new Set(ALL_PERMISSIONS)
  }

  return set
}

export function resolvePortalAccess(session: unknown): PortalAccess {
  const user =
    typeof session === "object" && session !== null && "user" in session
      ? (session as { user?: Record<string, unknown> }).user
      : undefined

  const plan =
    user?.planTier ??
    user?.plan ??
    user?.subscriptionPlan ??
    user?.tier ??
    "host"

  const permissions =
    user?.permissions ??
    user?.roles ??
    user?.grants ??
    user?.scopes ??
    ALL_PERMISSIONS

  return {
    plan: normalizePlan(plan),
    permissions: normalizePermissions(permissions),
  }
}

export function hasPermission(access: PortalAccess, permission?: PortalPermission) {
  if (!permission) {
    return true
  }

  return access.permissions.has(permission)
}

export function meetsPlan(access: PortalAccess, requiredPlan?: PlanTier) {
  if (!requiredPlan) {
    return true
  }

  return PLAN_WEIGHT[access.plan] >= PLAN_WEIGHT[requiredPlan]
}

export function isFeatureEnabled(access: PortalAccess, feature: LockedFeatureKey) {
  return meetsPlan(access, FEATURE_MIN_PLAN[feature])
}
