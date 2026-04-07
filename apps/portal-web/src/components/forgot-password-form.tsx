import { Button } from "@intuitive-stay/ui/components/button";
import { Input } from "@intuitive-stay/ui/components/input";
import { Label } from "@intuitive-stay/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const form = useForm({
    defaultValues: { email: "" },
    onSubmit: async ({ value }) => {
      await authClient.requestPasswordReset(
        {
          email: value.email,
          redirectTo: "/reset-password",
        },
        {
          onSuccess: () => {
            toast.success("If that email exists, a reset link has been sent.");
            onBack();
          },
          onError: (error) => {
            toast.error(error.error.message || "Something went wrong");
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        email: z.email("Invalid email address"),
      }),
    },
  });

  return (
    <div className="mx-auto w-full mt-10 max-w-md p-6">
      <h1 className="mb-2 text-center text-3xl font-bold">Forgot password</h1>
      <p className="mb-6 text-center text-sm text-muted-foreground">
        Enter your email and we'll send you a reset link.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-4"
      >
        <form.Field name="email">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Email</Label>
              <Input
                id={field.name}
                name={field.name}
                type="email"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              {field.state.meta.errors.map((error) => (
                <p key={error?.message} className="text-red-500 text-sm">
                  {error?.message}
                </p>
              ))}
            </div>
          )}
        </form.Field>

        <form.Subscribe
          selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button type="submit" className="w-full" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? "Sending..." : "Send reset link"}
            </Button>
          )}
        </form.Subscribe>
      </form>

      <div className="mt-4 text-center">
        <Button variant="link" onClick={onBack} className="text-sm text-muted-foreground">
          ← Back to sign in
        </Button>
      </div>
    </div>
  );
}
