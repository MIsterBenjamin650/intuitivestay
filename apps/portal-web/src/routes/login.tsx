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

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 flex items-center justify-center p-4">
      {/* Decorative background orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-orange-200/30 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-amber-200/30 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Brand header */}
        <div className="mb-8 text-center">
          <img
            src="/logo.svg"
            alt="Intuitive Stay"
            className="mx-auto mb-4 h-16 w-16 rounded-2xl shadow-lg shadow-orange-200"
          />
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Intuitive Stay</h1>
          <p className="mt-1 text-sm text-gray-500">Guest experience, measured and improved</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white shadow-xl shadow-orange-100/50 border border-orange-100/60 p-8">
          {view === "forgot" ? (
            <ForgotPasswordForm onBack={() => setView("signin")} />
          ) : view === "signin" ? (
            <SignInForm
              onSwitchToSignUp={() => setView("signup")}
              onForgotPassword={() => setView("forgot")}
            />
          ) : (
            <SignUpForm onSwitchToSignIn={() => setView("signin")} />
          )}
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} Intuitive Stay. All rights reserved.
        </p>
      </div>
    </div>
  );
}
