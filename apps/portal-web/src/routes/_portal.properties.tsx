import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/_portal/properties")({
  component: () => <Outlet />,
})
