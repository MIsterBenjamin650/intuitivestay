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
import { createFileRoute } from "@tanstack/react-router"
import { ExternalLinkIcon } from "lucide-react"
import { toast } from "sonner"

import { useTRPC } from "@/utils/trpc"

export const Route = createFileRoute("/_portal/organisation/billing")({
  component: RouteComponent,
})

function RouteComponent() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

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

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your subscription and additional properties.
        </p>
      </div>

      {/* Stripe billing portal link */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-sm">Plan subscription</CardTitle>
          <CardDescription>
            Manage your base plan, payment method, and invoices through the Stripe billing portal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {portalData?.url ? (
            <Button variant="outline" size="sm" asChild>
              <a href={portalData.url} target="_blank" rel="noreferrer">
                <ExternalLinkIcon className="mr-2 h-4 w-4" />
                Open billing portal
              </a>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">No active subscription found.</p>
          )}
        </CardContent>
      </Card>

      {/* Additional properties */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Additional properties</h2>

        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {!isLoading && additionalProperties.length === 0 && (
          <Card size="sm">
            <CardHeader>
              <CardTitle className="text-sm">No additional properties</CardTitle>
              <CardDescription>
                Properties included in your plan appear here once you add paid add-ons.
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
                              Remove property
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
    </div>
  )
}
