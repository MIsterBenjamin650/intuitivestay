import { env } from "@intuitive-stay/env/server"
import { Resend } from "resend"

const resend = new Resend(env.RESEND_API_KEY)

const FROM = "IntuitiveStay <noreply@guestconnectionscore.com>"

export async function sendApprovalEmail(
  ownerEmail: string,
  ownerName: string,
  propertyName: string,
  qrPdfBuffer?: Buffer,
  magicLinkUrl?: string,
) {
  const loginSection = magicLinkUrl
    ? `<p><a href="${magicLinkUrl}" style="display:inline-block;background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Open My Dashboard →</a></p>
<p style="font-size:12px;color:#64748b">This link expires in 24 hours. After that, use the Forgot Password option on the login page.</p>`
    : `<p><a href="${env.PUBLIC_PORTAL_URL}">${env.PUBLIC_PORTAL_URL}</a></p>
<p>If you haven't set a password yet, use the "Forgot password" option on the login page.</p>`

  await resend.emails.send({
    from: FROM,
    to: ownerEmail,
    subject: `Your property "${propertyName}" has been approved`,
    html: `<h1>Welcome to IntuItiveStay, ${ownerName}!</h1>
<p>Your property <strong>${propertyName}</strong> has been approved and is now live.</p>
<p>Click below to access your dashboard:</p>
${loginSection}
<p>Your branded QR code is attached to this email as a PDF. Print it and place it at reception, bedside tables, or dining areas.</p>`,
    attachments: qrPdfBuffer
      ? [
          {
            filename: `${propertyName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-qr-code.pdf`,
            content: qrPdfBuffer,
          },
        ]
      : undefined,
  })
}

export async function sendRejectionEmail(
  ownerEmail: string,
  ownerName: string,
  propertyName: string,
) {
  await resend.emails.send({
    from: FROM,
    to: ownerEmail,
    subject: "Update on your IntuItiveStay application",
    html: `<h1>Hi ${ownerName},</h1>
<p>Thank you for submitting <strong>${propertyName}</strong> to IntuItiveStay.</p>
<p>We need a little more information before we can approve your property. Please reply to this email with any additional details and we'll be in touch shortly.</p>`,
  })
}

export async function sendPasswordResetEmail(
  ownerEmail: string,
  resetUrl: string,
) {
  await resend.emails.send({
    from: FROM,
    to: ownerEmail,
    subject: "Reset your IntuItiveStay password",
    html: `<h1>Reset your password</h1>
<p>Click the link below to reset your IntuItiveStay password. This link expires in 1 hour.</p>
<p><a href="${resetUrl}" style="display:inline-block;background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Reset Password →</a></p>
<p style="font-size:12px;color:#64748b">If you didn't request this, you can safely ignore this email.</p>`,
  })
}

export async function sendAlertEmail(
  ownerEmail: string,
  ownerName: string,
  propertyName: string,
  gcs: number,
  pillars: { resilience: number; empathy: number; anticipation: number; recognition: number },
) {
  await resend.emails.send({
    from: FROM,
    to: ownerEmail,
    subject: `⚠️ Low score alert at ${propertyName}`,
    html: `<h1>Hi ${ownerName},</h1>
<p>A guest at <strong>${propertyName}</strong> submitted a low Guest Connection Score of <strong>${gcs.toFixed(2)}</strong>.</p>
<p><strong>Pillar breakdown:</strong></p>
<ul>
  <li>Resilience: ${pillars.resilience}/10</li>
  <li>Empathy: ${pillars.empathy}/10</li>
  <li>Anticipation: ${pillars.anticipation}/10</li>
  <li>Recognition: ${pillars.recognition}/10</li>
</ul>
<p>Log in to your portal to view any additional feedback left by the guest:</p>
<p><a href="${env.PUBLIC_PORTAL_URL}">${env.PUBLIC_PORTAL_URL}</a></p>`,
  })
}

export async function sendDailySummaryEmail(
  ownerEmail: string,
  propertyName: string,
  date: string,
  narrative: string,
  focus: Array<{ pillar: string; action: string }>,
  portalUrl: string,
) {
  const focusHtml = focus
    .map((f) => `<li><strong>${f.pillar}:</strong> ${f.action}</li>`)
    .join("")

  await resend.emails.send({
    from: FROM,
    to: ownerEmail,
    subject: `Your Daily Guest Care Summary — ${date}`,
    html: `<h2>Daily Guest Care Summary</h2>
<p><strong>${propertyName}</strong> · ${date}</p>
<p>${narrative}</p>
<h3>Today's Focus</h3>
<ul>${focusHtml}</ul>
<p><a href="${portalUrl}">View your full dashboard →</a></p>`,
  })
}

export async function sendStaffInviteEmail(
  invitedEmail: string,
  propertyName: string,
  inviterName: string,
  token: string,
) {
  const inviteUrl = `${env.PUBLIC_PORTAL_URL}/invite?token=${token}`

  await resend.emails.send({
    from: FROM,
    to: invitedEmail,
    subject: `${propertyName} — You've been invited to view the dashboard`,
    html: `<h1>You've been invited!</h1>
<p><strong>${inviterName}</strong> has invited you to access the guest feedback dashboard for <strong>${propertyName}</strong>.</p>
<p>Click the button below to accept your invitation and set up your account:</p>
<p><a href="${inviteUrl}" style="display:inline-block;background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Accept Invitation →</a></p>
<p style="font-size:12px;color:#64748b">This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.</p>`,
  })
}
