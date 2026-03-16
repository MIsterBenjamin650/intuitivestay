import { createFileRoute } from "@tanstack/react-router"

import { PortalPage } from "@/components/portal-page"

export const Route = createFileRoute("/_portal/organisation/members")({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <PortalPage
      title="Organisation Members"
      description="Invite, remove, and manage who belongs to this organisation."
    />
  )
}
