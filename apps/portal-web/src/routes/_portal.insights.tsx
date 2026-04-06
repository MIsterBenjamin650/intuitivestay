import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_portal/insights")({
  beforeLoad: () => {
    throw redirect({ to: "/" })
  },
  component: () => null,
})
