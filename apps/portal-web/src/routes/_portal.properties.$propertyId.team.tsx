import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_portal/properties/$propertyId/team")({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Team</h1>
      <p className="mt-2 text-muted-foreground">Manage your property team members here.</p>
    </div>
  )
}
