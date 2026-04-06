# Staff Invitation System Design

## Goal

Allow property owners to invite staff members (managers, team leads, front desk) to access a read-only view of their property dashboard. Access is granted via email invite, and owners can configure which sections each invited staff member can see.

---

## Roles

| Role | Access |
|---|---|
| Owner | Full access to all dashboard features, can invite staff, configure permissions |
| Staff | Read-only access to property dashboard; sections visible depend on owner-configured permissions |

Staff accounts are separate from owner accounts. A staff user is linked to a property, not an organisation.

---

## User Flow

### Owner invites staff

1. Owner navigates to **Team** page (sidebar: `/_portal/properties/$propertyId/team`)
2. Sees list of current staff members (name, email, role label, permissions, status: Active/Pending)
3. Clicks **"Invite Staff Member"**
4. Modal opens:
   - Email address (required)
   - Display name (optional, pre-filled from email if not provided)
   - Permission toggles (see Permissions section below)
5. Owner clicks **Send Invite**
6. System sends invite email via Resend
7. Pending row appears in team list

### Staff accepts invite

1. Staff receives email with invite link: `https://portal.intuitivestay.com/invite?token=<uuid>`
2. Link opens the invite acceptance page
3. If staff already has an account: they log in and the property is linked to their account
4. If new: they are prompted to create a password (email pre-filled, read-only)
5. On acceptance: staff account is created (or linked), invite marked as accepted, staff redirected to their property dashboard

### Staff dashboard experience

- Staff see only the property dashboard — no sidebar items like QR Codes, Team, or Billing
- Sidebar: "My Property" with Dashboard only (and any other sections the owner has enabled)
- No editing, no form submissions, no alerts management
- Read-only overlay: interactive elements (buttons, forms) are hidden or disabled

---

## Permissions System

Owner can toggle per-staff-member:

| Permission Key | Label | Default |
|---|---|---|
| `viewFeedback` | View recent guest feedback | On |
| `viewAnalytics` | View charts & scores | On |
| `viewAiSummary` | View AI daily summary | Off |
| `viewWordCloud` | View adjective word cloud | On |
| `viewStaffCloud` | View staff mention cloud | Off |
| `viewAlerts` | View open alerts | Off |

Permissions are stored as a JSON object per staff membership row.

---

## Database Schema

### `propertyMembers` table

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| propertyId | uuid FK → properties | |
| userId | uuid FK → users (nullable) | null until invite accepted |
| invitedEmail | text | email address invited |
| displayName | text nullable | |
| role | text | always `"staff"` for now |
| permissions | jsonb | `{ viewFeedback: true, viewAnalytics: true, ... }` |
| status | text | `"pending"` or `"active"` |
| inviteToken | uuid unique | used to accept invite |
| inviteExpiresAt | timestamp | 7 days from creation |
| createdAt | timestamp | |
| acceptedAt | timestamp nullable | |

### Users table (existing)

No changes needed. Staff users are created via Better Auth's standard user creation. The `propertyMembers.userId` FK links the member record to their user account after acceptance.

---

## Invite Email

Sent via Resend using the existing `packages/api/src/lib/email.ts` helper.

**Subject:** `[Property Name] — You've been invited to view the dashboard`

**Body:**
- Property owner's name has invited you to access [Property Name]'s guest feedback dashboard
- "Accept Invitation" button linking to `https://portal.intuitivestay.com/invite?token=<token>`
- Token is valid for 7 days
- Plain text fallback

---

## Invite Acceptance Page

Route: `/_auth/invite` (or `/invite` outside portal layout)

Steps:
1. Load `inviteToken` from query param
2. Validate token exists in DB, status is `pending`, not expired
3. If invalid/expired: show error page with "Ask your property owner for a new invite"
4. Check if a user with `invitedEmail` already exists in `users`:
   - **Yes**: prompt them to log in (redirect to login with `?redirect=/invite?token=...`)
   - **No**: show registration form with email pre-filled (read-only), password field, confirm password
5. On form submit:
   - Create user via Better Auth's standard user creation
   - Update `propertyMembers` row: set `userId`, `status = "active"`, `acceptedAt = now()`
   - Redirect to `/_portal/properties/$propertyId/dashboard`

Token expiry: if expired, show message with instructions to contact owner. Owner can re-send invite from Team page.

---

## Staff Portal Experience

Staff users log in via the same login page as owners.

After login, Better Auth session identifies the user. The portal layout (`_portal.tsx`) checks:
1. Is this user an owner? → normal owner layout
2. Is this user a staff member (exists in `propertyMembers`)? → staff layout
3. Neither? → redirect to login

Staff layout differences:
- Sidebar shows only items matching their permissions
- No "Invite Staff" button on Team page (they can see the team list but not manage it — controlled by `viewStaffCloud` or a separate permission)
- No QR Code management
- No billing/plan info
- All write operations blocked at the API layer (tRPC procedures check `propertyMembers.role` before allowing mutations)

---

## tRPC Procedures

### `team.inviteStaff`
- Input: `{ propertyId, email, displayName?, permissions }`
- Auth: owner of the property only
- Creates `propertyMembers` row with `status: "pending"`, generates `inviteToken`
- Sends invite email via Resend
- Returns: created member row

### `team.listMembers`
- Input: `{ propertyId }`
- Auth: owner of the property, or staff member of the property
- Returns: all `propertyMembers` rows for the property (with `userId` joined to `users` for display name/email)

### `team.updatePermissions`
- Input: `{ memberId, permissions }`
- Auth: owner of the property only
- Updates `propertyMembers.permissions` JSON
- Returns: updated row

### `team.removeMember`
- Input: `{ memberId }`
- Auth: owner of the property only
- Deletes `propertyMembers` row (user account remains; they just lose property access)

### `team.resendInvite`
- Input: `{ memberId }`
- Auth: owner of the property only
- Regenerates `inviteToken` and `inviteExpiresAt`, re-sends email

### `invite.accept`
- Input: `{ token, password, confirmPassword }` (password only required for new users)
- Auth: public (no session required)
- Validates token, creates or links user, sets `status: "active"`
- Returns: `{ propertyId }` for redirect

---

## Team Page UI

Route: `/_portal/properties/$propertyId/team`

Layout:
- Page title "Team"
- "Invite Staff Member" button (top right, owner only)
- Table of current staff:
  - Name / Email
  - Status badge (Active / Pending)
  - Permissions summary (e.g. "Feedback, Analytics")
  - Actions: Edit permissions, Remove, Resend invite (if pending)
- Empty state: "Your team will appear here once you invite someone"

Invite modal (shadcn `Dialog`):
- Email input
- Display name input (optional)
- Permissions section: labelled toggles for each permission key
- "Send Invite" button

---

## Security

- Invite tokens are UUIDs — unpredictable
- Tokens expire after 7 days
- API-layer auth checks on all mutation procedures (owner-only)
- Staff read access validated per request via `propertyMembers` lookup
- Staff can only see the property they were invited to (no cross-property access)
- Existing Better Auth session handling for login/logout

---

## Error Handling

- Expired token: friendly error page, no token value exposed
- Invalid token: same error page
- Email already invited (pending): show existing pending status, offer resend
- Email already a member (active): show "already a member" message in modal
- Resend email failure: log error, show toast "Failed to send — try again"

---

## Success Criteria

- Owner can invite staff via email from the Team page
- Staff receive invite email and can accept within 7 days
- New staff users can create an account via invite link
- Existing users can accept an invite and be linked to a property
- Owner can configure per-member permissions
- Staff dashboard shows only permitted sections
- Owner can remove a staff member and their access is immediately revoked
- All write operations blocked for staff at API layer
