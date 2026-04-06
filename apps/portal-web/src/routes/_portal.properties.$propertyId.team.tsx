import * as React from "react"
import { Badge } from "@intuitive-stay/ui/components/badge"
import { Button } from "@intuitive-stay/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@intuitive-stay/ui/components/dialog"
import { Input } from "@intuitive-stay/ui/components/input"
import { Label } from "@intuitive-stay/ui/components/label"
import { Switch } from "@intuitive-stay/ui/components/switch"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { UserPlusIcon } from "lucide-react"

import { useTRPC } from "@/utils/trpc"

export const Route = createFileRoute("/_portal/properties/$propertyId/team")({
  component: RouteComponent,
})

const DEFAULT_PERMISSIONS = {
  viewFeedback: true,
  viewAnalytics: true,
  viewAiSummary: false,
  viewWordCloud: true,
  viewStaffCloud: false,
  viewAlerts: false,
}

const PERMISSION_LABELS: Record<keyof typeof DEFAULT_PERMISSIONS, string> = {
  viewFeedback: "View recent guest feedback",
  viewAnalytics: "View charts & scores",
  viewAiSummary: "View AI daily summary",
  viewWordCloud: "View adjective word cloud",
  viewStaffCloud: "View staff mention cloud",
  viewAlerts: "View open alerts",
}

function PermissionToggles({
  permissions,
  onChange,
}: {
  permissions: typeof DEFAULT_PERMISSIONS
  onChange: (key: keyof typeof DEFAULT_PERMISSIONS, value: boolean) => void
}) {
  return (
    <div className="space-y-3">
      {(Object.keys(DEFAULT_PERMISSIONS) as Array<keyof typeof DEFAULT_PERMISSIONS>).map((key) => (
        <div key={key} className="flex items-center justify-between">
          <Label htmlFor={key} className="text-sm font-normal">
            {PERMISSION_LABELS[key]}
          </Label>
          <Switch
            id={key}
            checked={permissions[key]}
            onCheckedChange={(checked: boolean) => onChange(key, checked)}
          />
        </div>
      ))}
    </div>
  )
}

function InviteModal({
  propertyId,
  onSuccess,
}: {
  propertyId: string
  onSuccess: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [email, setEmail] = React.useState("")
  const [displayName, setDisplayName] = React.useState("")
  const [permissions, setPermissions] = React.useState({ ...DEFAULT_PERMISSIONS })
  const [error, setError] = React.useState<string | null>(null)
  const trpc = useTRPC()

  const inviteMutation = useMutation(trpc.team.inviteStaff.mutationOptions())

  async function handleSubmit() {
    setError(null)
    if (!email) {
      setError("Email is required")
      return
    }
    try {
      await inviteMutation.mutateAsync({
        propertyId,
        email,
        displayName: displayName || undefined,
        permissions,
      })
      setOpen(false)
      setEmail("")
      setDisplayName("")
      setPermissions({ ...DEFAULT_PERMISSIONS })
      onSuccess()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to send invite"
      setError(msg)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <UserPlusIcon className="mr-2 h-4 w-4" />
            Invite Staff Member
          </Button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Staff Member</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="space-y-1">
            <Label htmlFor="invite-email">Email address</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@example.com"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="invite-name">Display name (optional)</Label>
            <Input
              id="invite-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Jane Smith"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Permissions</Label>
            <PermissionToggles
              permissions={permissions}
              onChange={(key, value) =>
                setPermissions((p) => ({ ...p, [key]: value }))
              }
            />
          </div>
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={inviteMutation.isPending}
          >
            {inviteMutation.isPending ? "Sending…" : "Send Invite"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function permissionSummary(perms: Record<string, boolean>): string {
  const labels: Record<string, string> = {
    viewFeedback: "Feedback",
    viewAnalytics: "Analytics",
    viewAiSummary: "AI Summary",
    viewWordCloud: "Word Cloud",
    viewStaffCloud: "Staff Cloud",
    viewAlerts: "Alerts",
  }
  const enabled = Object.entries(perms)
    .filter(([, v]) => v)
    .map(([k]) => labels[k] ?? k)
  return enabled.length > 0 ? enabled.join(", ") : "None"
}

function RouteComponent() {
  const { propertyId } = Route.useParams()
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { data: members, isLoading } = useQuery(
    trpc.team.listMembers.queryOptions({ propertyId }),
  )

  const removeMutation = useMutation(trpc.team.removeMember.mutationOptions())
  const resendMutation = useMutation(trpc.team.resendInvite.mutationOptions())

  function refetch() {
    void queryClient.invalidateQueries(
      trpc.team.listMembers.queryOptions({ propertyId }),
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Team</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage staff access to your property dashboard
          </p>
        </div>
        <InviteModal propertyId={propertyId} onSuccess={refetch} />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !members || members.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <UserPlusIcon className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            Your team will appear here once you invite someone.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Member
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">
                  Permissions
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {member.displayName ?? member.invitedEmail}
                    </div>
                    {member.displayName && (
                      <div className="text-xs text-muted-foreground">
                        {member.invitedEmail}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={member.status === "active" ? "default" : "secondary"}
                    >
                      {member.status === "active" ? "Active" : "Pending"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                    {permissionSummary(
                      member.permissions as Record<string, boolean>,
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {member.status === "pending" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            await resendMutation.mutateAsync({
                              memberId: member.id,
                            })
                            refetch()
                          }}
                          disabled={resendMutation.isPending}
                        >
                          Resend
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={async () => {
                          await removeMutation.mutateAsync({
                            memberId: member.id,
                          })
                          refetch()
                        }}
                        disabled={removeMutation.isPending}
                      >
                        Remove
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
