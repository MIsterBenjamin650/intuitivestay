import * as React from "react"
import { Button } from "@intuitive-stay/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@intuitive-stay/ui/components/card"
import { Input } from "@intuitive-stay/ui/components/input"
import { Label } from "@intuitive-stay/ui/components/label"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"

export const Route = createFileRoute("/_portal/organisation/account")({
  component: RouteComponent,
})

function RouteComponent() {
  useNavigate()
  const { data: session, refetch } = authClient.useSession()

  // Display name form
  const [displayName, setDisplayName] = React.useState(session?.user.name ?? "")
  const [nameLoading, setNameLoading] = React.useState(false)

  // Password form
  const [currentPassword, setCurrentPassword] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [passwordLoading, setPasswordLoading] = React.useState(false)

  // Keep display name in sync once session loads
  React.useEffect(() => {
    if (session?.user.name) {
      setDisplayName(session.user.name)
    }
  }, [session?.user.name])

  async function handleUpdateName(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = displayName.trim()
    if (!trimmed) {
      toast.error("Display name cannot be empty.")
      return
    }
    setNameLoading(true)
    try {
      const result = await authClient.updateUser({ name: trimmed })
      if (result.error) {
        toast.error(result.error.message ?? "Failed to update name.")
      } else {
        toast.success("Display name updated.")
        await refetch()
      }
    } catch {
      toast.error("An unexpected error occurred.")
    } finally {
      setNameLoading(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.")
      return
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.")
      return
    }
    setPasswordLoading(true)
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: false,
      })
      if (result.error) {
        toast.error(result.error.message ?? "Failed to change password.")
      } else {
        toast.success("Password changed successfully.")
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      }
    } catch {
      toast.error("An unexpected error occurred.")
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <Card>
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
          <CardDescription>
            Manage your personal information and security settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Signed in as{" "}
          <span className="font-medium text-foreground">
            {session?.user.email ?? "—"}
          </span>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Display Name */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Display Name</CardTitle>
            <CardDescription>
              This is the name shown across the portal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateName} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="display-name">Name</Label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  disabled={nameLoading}
                />
              </div>
              <Button type="submit" disabled={nameLoading} className="w-full">
                {nameLoading ? "Saving…" : "Save Name"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Change Password</CardTitle>
            <CardDescription>
              Update your password to keep your account secure.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={passwordLoading}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={passwordLoading}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={passwordLoading}
                />
              </div>
              <Button type="submit" disabled={passwordLoading} className="w-full">
                {passwordLoading ? "Updating…" : "Change Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
