import { createFileRoute } from "@tanstack/react-router"

import { ChoosePlan } from "@/components/choose-plan"

export const Route = createFileRoute("/_portal/choose-plan")({
  component: function ChoosePlanRoute() {
    const { session } = Route.useRouteContext()
    const ownerEmail = (session as { user?: { email?: string } } | null)?.user?.email ?? ""
    return <ChoosePlan ownerEmail={ownerEmail} />
  },
})
