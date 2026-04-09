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
import { toast } from "sonner"

import { useTRPC, useTRPCClient } from "@/utils/trpc"

export const Route = createFileRoute("/_portal/admin/approvals")({
  component: ApprovalsPage,
})

function ApprovalsPage() {
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()
  const queryClient = useQueryClient()

  const {
    data: pendingProperties,
    isLoading,
    isError,
    error,
  } = useQuery(trpc.properties.getPendingProperties.queryOptions())

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      trpcClient.properties.approveProperty.mutate({ id }),
    onSuccess: (property) => {
      queryClient.invalidateQueries(trpc.properties.getPendingProperties.queryFilter())
      toast.success(`"${property.name}" approved`)
    },
    onError: () => toast.error("Failed to approve property"),
  })

  const rejectMutation = useMutation({
    mutationFn: (id: string) =>
      trpcClient.properties.rejectProperty.mutate({ id }),
    onSuccess: (property) => {
      queryClient.invalidateQueries(trpc.properties.getPendingProperties.queryFilter())
      toast.success(`"${property.name}" rejected`)
    },
    onError: () => toast.error("Failed to reject property"),
  })

  if (isError) {
    return (
      <div className="p-6">
        <p className="text-destructive">
          {(error as { message?: string })?.message ?? "Access denied or error loading data"}
        </p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Pending Approvals</h1>
        <p className="text-muted-foreground">
          Review and approve or reject property registrations
        </p>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading...</p>}

      {!isLoading && pendingProperties?.length === 0 && (
        <p className="text-muted-foreground">No pending properties.</p>
      )}

      <div className="space-y-4">
        {pendingProperties?.map((property) => (
          <Card key={property.id}>
            <CardHeader>
              <CardTitle>{property.name}</CardTitle>
              <CardDescription>
                {property.ownerName} · {property.ownerEmail}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {[property.address, property.city, property.postcode, property.country, property.type]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {(property as { businessEmail?: string | null }).businessEmail && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Business email:</span>{" "}
                  {(property as { businessEmail?: string | null }).businessEmail}
                </p>
              )}
              {(property as { businessWebsite?: string | null }).businessWebsite && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Website:</span>{" "}
                  <a
                    href={(property as { businessWebsite?: string | null }).businessWebsite!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-500 hover:underline"
                  >
                    {(property as { businessWebsite?: string | null }).businessWebsite}
                  </a>
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Submitted: {new Date(property.createdAt).toLocaleDateString()}
              </p>
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={() => approveMutation.mutate(property.id)}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => rejectMutation.mutate(property.id)}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                >
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
