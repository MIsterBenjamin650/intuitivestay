import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@intuitive-stay/ui/components/card";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_portal/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="grid gap-4 md:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Portfolio GCS</CardDescription>
            <CardTitle>81.4</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Active Properties</CardDescription>
            <CardTitle>3</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Open Alerts</CardDescription>
            <CardTitle>5</CardTitle>
          </CardHeader>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Organisation Dashboard</CardTitle>
          <CardDescription>
            Cross-property satisfaction health, trends, and priority actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Main dashboard intentionally aggregates all properties. Drill into each
          property from the sidebar.
        </CardContent>
      </Card>
    </div>
  );
}
