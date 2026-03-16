import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@intuitive-stay/ui/components/card"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_portal/properties")({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <Card>
        <CardHeader>
          <CardTitle>Properties</CardTitle>
          <CardDescription>
            Manage properties, onboarding state, and default property context.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
          <div className="rounded-lg border border-border/70 p-3">Ben Hostels London</div>
          <div className="rounded-lg border border-border/70 p-3">Ben Hostels York</div>
          <div className="rounded-lg border border-border/70 p-3">Ben Hostels Edinburgh</div>
        </CardContent>
      </Card>
    </div>
  )
}
