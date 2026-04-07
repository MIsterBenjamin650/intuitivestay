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
<p style="font-size:12px;color:#64748b">This link expires in 24 hours. After that, <a href="${env.PUBLIC_PORTAL_URL}/login" style="color:#6366f1">log in here</a> using your email address. Use "Forgot password" if you haven't set one yet.</p>`
    : `<p><a href="${env.PUBLIC_PORTAL_URL}/login" style="display:inline-block;background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Log in to your dashboard →</a></p>
<p style="font-size:12px;color:#64748b">If you haven't set a password yet, use the "Forgot password" option on the login page.</p>`

  await resend.emails.send({
    from: FROM,
    to: ownerEmail,
    subject: `Your property "${propertyName}" has been approved`,
    html: `<h1>Welcome to IntuitiveStay, ${ownerName}!</h1>
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
    subject: "Update on your IntuitiveStay application",
    html: `<h1>Hi ${ownerName},</h1>
<p>Thank you for submitting <strong>${propertyName}</strong> to IntuitiveStay.</p>
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
    subject: "Reset your IntuitiveStay password",
    html: `<h1>Reset your password</h1>
<p>Click the link below to reset your IntuitiveStay password. This link expires in 1 hour.</p>
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

export async function sendNewPropertyNotificationEmail(
  ownerName: string,
  ownerEmail: string,
  propertyName: string,
  propertyCity: string,
  propertyCountry: string,
  portalUrl: string,
) {
  await resend.emails.send({
    from: FROM,
    to: env.ADMIN_EMAIL,
    subject: `New property registration: ${propertyName}`,
    html: `<h1>New Property Registration</h1>
<p>A new property has been submitted for approval.</p>
<table style="border-collapse:collapse;width:100%;max-width:500px">
  <tr><td style="padding:8px;font-weight:bold;color:#64748b">Owner</td><td style="padding:8px">${ownerName}</td></tr>
  <tr><td style="padding:8px;font-weight:bold;color:#64748b">Email</td><td style="padding:8px">${ownerEmail}</td></tr>
  <tr><td style="padding:8px;font-weight:bold;color:#64748b">Property</td><td style="padding:8px">${propertyName}</td></tr>
  <tr><td style="padding:8px;font-weight:bold;color:#64748b">Location</td><td style="padding:8px">${propertyCity}, ${propertyCountry}</td></tr>
</table>
<p style="margin-top:24px">
  <a href="${portalUrl}" style="display:inline-block;background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Review in Portal →</a>
</p>`,
  })
}

export async function sendContactEmail(
  senderName: string,
  senderEmail: string,
  message: string,
) {
  await resend.emails.send({
    from: FROM,
    to: env.ADMIN_EMAIL,
    replyTo: senderEmail,
    subject: `Portal enquiry from ${senderName}`,
    html: `<h2>New enquiry from the portal</h2>
<p><strong>Name:</strong> ${senderName}</p>
<p><strong>Email:</strong> ${senderEmail}</p>
<p><strong>Message:</strong></p>
<p style="white-space:pre-wrap">${message}</p>`,
  })
}

export async function sendSubscriptionNotificationEmail(
  ownerEmail: string,
  ownerName: string,
  propertyName: string,
  plan: string,
  isTrialing: boolean,
) {
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1)
  const statusLabel = isTrialing ? "started a free trial" : "subscribed"
  await resend.emails.send({
    from: FROM,
    to: env.ADMIN_EMAIL,
    subject: `🎉 ${ownerName} ${statusLabel} — ${planLabel} plan`,
    html: `<h2>New ${isTrialing ? "Trial" : "Subscription"}</h2>
<table style="border-collapse:collapse;width:100%;max-width:500px">
  <tr><td style="padding:8px;font-weight:bold;color:#64748b">Owner</td><td style="padding:8px">${ownerName}</td></tr>
  <tr><td style="padding:8px;font-weight:bold;color:#64748b">Email</td><td style="padding:8px">${ownerEmail}</td></tr>
  <tr><td style="padding:8px;font-weight:bold;color:#64748b">Property</td><td style="padding:8px">${propertyName}</td></tr>
  <tr><td style="padding:8px;font-weight:bold;color:#64748b">Plan</td><td style="padding:8px">${planLabel}</td></tr>
  <tr><td style="padding:8px;font-weight:bold;color:#64748b">Status</td><td style="padding:8px">${isTrialing ? "Trial started" : "Active subscription"}</td></tr>
</table>`,
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
