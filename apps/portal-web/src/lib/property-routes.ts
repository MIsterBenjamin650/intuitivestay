export type PropertyRouteKey =
  | "dashboard"
  | "alerts"
  | "feedback"
  | "insights"
  | "advanced-insights"
  | "qr-form"
  | "local-market"
  | "team"
  | "service-signature"

const PROPERTY_ROUTE_TEMPLATES: Record<PropertyRouteKey, string> = {
  dashboard: "/properties/:propertyId/dashboard",
  alerts: "/properties/:propertyId/alerts",
  feedback: "/properties/:propertyId/feedback",
  insights: "/properties/:propertyId/insights",
  "advanced-insights": "/properties/:propertyId/advanced-insights",
  "qr-form": "/properties/:propertyId/qr-form",
  "local-market": "/properties/:propertyId/local-market",
  team: "/properties/:propertyId/team",
  "service-signature": "/properties/:propertyId/service-signature",
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
