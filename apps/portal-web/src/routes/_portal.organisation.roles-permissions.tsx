import { createFileRoute } from "@tanstack/react-router"

import { PortalPage } from "@/components/portal-page"

export const Route = createFileRoute("/_portal/organisation/roles-permissions")({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <PortalPage
      title="Roles & Permissions"
      description="Define roles and control access across dashboard, properties, and billing."
    />
  )
}
