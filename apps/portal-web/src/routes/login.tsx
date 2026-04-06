import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import ForgotPasswordForm from "@/components/forgot-password-form";
import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";

export const Route = createFileRoute("/login")({
  component: RouteComponent,
});

type View = "signin" | "signup" | "forgot";

function RouteComponent() {
  const [view, setView] = useState<View>("signin");

  if (view === "forgot") {
    return <ForgotPasswordForm onBack={() => setView("signin")} />;
  }

  return view === "signin" ? (
    <SignInForm
      onSwitchToSignUp={() => setView("signup")}
      onForgotPassword={() => setView("forgot")}
    />
  ) : (
    <SignUpForm onSwitchToSignIn={() => setView("signin")} />
  );
}
