import { createFileRoute } from "@tanstack/react-router";

import ResetPasswordForm from "@/components/reset-password-form";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { token } = Route.useSearch();

  if (!token) {
    return (
      <div className="mx-auto w-full mt-10 max-w-md p-6 text-center">
        <p className="text-destructive">Invalid or missing reset token.</p>
      </div>
    );
  }

  return <ResetPasswordForm token={token} />;
}
