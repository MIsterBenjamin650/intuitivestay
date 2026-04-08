import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@intuitive-stay/ui/components/alert-dialog"
import { Badge } from "@intuitive-stay/ui/components/badge"
import { Button } from "@intuitive-stay/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@intuitive-stay/ui/components/card"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useRouteContext } from "@tanstack/react-router"
import { ExternalLinkIcon } from "lucide-react"
import { toast } from "sonner"

import { useTRPC } from "@/utils/trpc"

export const Route = createFileRoute("/_portal/organisation/billing")({
  component: RouteComponent,
})

const PLAN_LABELS: Record<string, string> = {
  member: "Member",
  host: "Host",
  partner: "Partner",
  founder: "Founder",
}

const PLAN_INCLUDED_PROPERTIES: Record<string, number> = {
  member: 0,
  host: 1,
  partner: 1,
  founder: 5,
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return <Badge className="bg-green-100 text-green-700 border-green-300 hover:bg-green-100">Active</Badge>
  }
  if (status === "trial") {
    return <Badge className="bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-100">Trial</Badge>
  }
  if (status === "cancelled" || status === "inactive") {
    return <Badge variant="outline" className="text-red-600 border-red-300">Inactive</Badge>
  }
  return <Badge variant="outline">{status}</Badge>
}

function RouteComponent() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { session } = useRouteContext({ from: "/_portal" })

  const plan = (session as { plan?: string | null } | null)?.plan ?? null
  const subscriptionStatus = (session as { subscriptionStatus?: string } | null)?.subscriptionStatus ?? "none"

  const { data: additionalProperties = [], isLoading } = useQuery(
    trpc.properties.getMyAdditionalProperties.queryOptions(),
  )

  const { data: portalData } = useQuery(
    trpc.properties.getStripePortalUrl.queryOptions(),
  )

  const { mutate: cancelProperty, isPending: isCancelling } = useMutation(
    trpc.properties.cancelAdditionalProperty.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.properties.getMyAdditionalProperties.queryFilter())
        toast.success("Property cancellation scheduled. You'll retain access until the end of your billing period.")
      },
      onError: (err) => {
        toast.error(err.message)
      },
    }),
  )

  const includedCount = plan ? (PLAN_INCLUDED_PROPERTIES[plan] ?? 0) : 0
  const planLabel = plan ? (PLAN_LABELS[plan] ?? plan) : null

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your subscription and additional properties.
        </p>
      </div>

      {/* Current plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">
                {planLabel ? `${planLabel} plan` : "No plan"}
              </CardTitle>
              <CardDescription className="mt-1">
                {includedCount === 0
                  ? "No properties included — contact us to upgrade"
                  : `${includedCount} ${includedCount === 1 ? "property" : "properties"} included`}
              </CardDescription>
            </div>
            <StatusBadge status={subscriptionStatus} />
          </div>
        </CardHeader>
      </Card>

      {/* Additional properties */}
      <div>
        <h2 className="text-base font-semibold mb-3">Additional properties</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Properties beyond your plan's included allowance, billed at £25/month each.
        </p>

        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {!isLoading && additionalProperties.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">No additional properties</CardTitle>
              <CardDescription>
                When you add a property beyond your plan's limit, it will appear here.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {!isLoading && additionalProperties.length > 0 && (
          <div className="flex flex-col gap-3">
            {additionalProperties.map((property) => (
              <Card key={property.id}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm">{property.name}</CardTitle>
                      <CardDescription>
                        {property.city}, {property.country} · £25.00/month
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {property.paymentStatus === "cancelling" ? (
                        <Badge variant="outline" className="text-orange-600 border-orange-400 bg-orange-50">
                          Cancellation pending
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
                          Active
                        </Badge>
                      )}

                      {property.paymentStatus === "paid" && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive border-destructive/30 hover:bg-destructive/5"
                              disabled={isCancelling}
                            >
                              Remove
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove {property.name}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This property will be deactivated at the end of your current billing period.
                                Your other properties won't be affected. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep property</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => cancelProperty({ propertyId: property.id })}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Yes, remove it
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Stripe portal — secondary action */}
      {portalData?.url && (
        <div className="border-t pt-4">
          <p className="text-sm text-muted-foreground mb-2">Need to update your payment method or download an invoice?</p>
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground h-auto p-0 hover:text-foreground">
            <a href={portalData.url} target="_blank" rel="noreferrer">
              <ExternalLinkIcon className="mr-1.5 h-3.5 w-3.5" />
              Open payment portal
            </a>
          </Button>
        </div>
      )}
    </div>
  )
}
