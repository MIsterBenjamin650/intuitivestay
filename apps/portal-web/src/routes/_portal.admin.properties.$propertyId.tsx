import { createFileRoute, redirect } from "@tanstack/react-router"

import { AdminPropertyDetail } from "@/components/admin-property-detail"

export const Route = createFileRoute("/_portal/admin/properties/$propertyId")({
  beforeLoad: ({ context }) => {
    const isAdmin =
      (context.session as { isAdmin?: boolean } | null)?.isAdmin === true
    if (!isAdmin) {
      throw redirect({ to: "/" })
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { propertyId } = Route.useParams()
  return <AdminPropertyDetail propertyId={propertyId} />
}
