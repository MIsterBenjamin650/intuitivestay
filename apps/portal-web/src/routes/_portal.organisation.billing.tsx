import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@intuitive-stay/ui/components/card"
import { createFileRoute } from "@tanstack/react-router"

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

function RouteComponent() {
  const search = Route.useSearch()

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
            Upgrade requested for: <span className="font-medium text-foreground">{search.upgrade}</span>
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
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">Current Plan</CardTitle>
            <CardDescription>Essentialist</CardDescription>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">Usage</CardTitle>
            <CardDescription>3 active properties</CardDescription>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">Invoices</CardTitle>
            <CardDescription>Last invoice paid</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}
