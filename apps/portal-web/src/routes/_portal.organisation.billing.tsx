import { useQuery } from "@tanstack/react-query"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@intuitive-stay/ui/components/card"
import { Button } from "@intuitive-stay/ui/components/button"
import { createFileRoute, useRouteContext } from "@tanstack/react-router"

import { useTRPC } from "@/utils/trpc"

type BillingSearch = {
  upgrade?: string
  from?: string
}

export const Route = createFileRoute("/_portal/organisation/billing")({
  validateSearch: (search: Record<string, unknown>): BillingSearch => ({
    upgrade: typeof search.upgrade === "string" ? search.upgrade : undefined,
    from: typeof search.from === "string" ? search.from : undefined,
  }),
  component: RouteComponent,
})

type SubscriptionStatus = "active" | "trial" | "expired" | "grace" | "none" | string

function statusBadge(status: SubscriptionStatus) {
  const map: Record<string, { label: string; className: string }> = {
    active: { label: "Active", className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
    trial: { label: "Trial", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
    expired: { label: "Expired", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
    grace: { label: "Grace Period", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
    none: { label: "None", className: "bg-muted text-muted-foreground" },
  }
  const { label, className } = map[status] ?? { label: status, className: "bg-muted text-muted-foreground" }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

function RouteComponent() {
  const search = Route.useSearch()
  const { session } = useRouteContext({ from: "/_portal" })

  const trpc = useTRPC()
  const { data: portfolio } = useQuery(trpc.properties.getPortfolioDashboard.queryOptions())
  const { data: stripeData } = useQuery(trpc.properties.getStripePortalUrl.queryOptions())

  const rawPlan = (session as { plan?: string } | null)?.plan ?? null
  const subscriptionStatus: SubscriptionStatus =
    (session as { subscriptionStatus?: string } | null)?.subscriptionStatus ?? "none"

  const planLabel = rawPlan
    ? rawPlan.charAt(0).toUpperCase() + rawPlan.slice(1)
    : "Free"

  const activeCount = portfolio?.activeCount ?? 0
  const stripeUrl = stripeData?.url ?? null

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <Card>
        <CardHeader>
          <CardTitle>Billing</CardTitle>
          <CardDescription>
            Subscription plan, usage, and invoice history in one place.
          </CardDescription>
        </CardHeader>
        {search.upgrade ? (
          <CardContent className="text-sm text-muted-foreground">
            Upgrade requested for:{" "}
            <span className="font-medium text-foreground">{search.upgrade}</span>
            {search.from ? (
              <>
                {" "}
                (from <span className="font-medium text-foreground">{search.from}</span>)
              </>
            ) : null}
          </CardContent>
        ) : null}
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Current Plan */}
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">Current Plan</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <span className="font-medium text-foreground">{planLabel}</span>
              {statusBadge(subscriptionStatus)}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Usage */}
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">Active Properties</CardTitle>
            <CardDescription>
              {activeCount === 1 ? "1 active property" : `${activeCount} active properties`}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Manage Subscription */}
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">Manage Subscription</CardTitle>
            <CardDescription>
              {stripeUrl
                ? "Access invoices, payment methods, and plan changes."
                : "No active subscription."}
            </CardDescription>
          </CardHeader>
          {stripeUrl ? (
            <CardContent>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(stripeUrl, "_blank")}
              >
                Open Billing Portal
              </Button>
            </CardContent>
          ) : null}
        </Card>
      </div>
    </div>
  )
}
