import { createFileRoute } from "@tanstack/react-router"

import { ChoosePlan } from "@/components/choose-plan"

export const Route = createFileRoute("/_portal/choose-plan")({
  component: ChoosePlan,
})
