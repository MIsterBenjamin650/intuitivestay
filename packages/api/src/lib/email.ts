import { env } from "@intuitive-stay/env/server"
import { Resend } from "resend"

const resend = new Resend(env.RESEND_API_KEY)

const FROM = "IntuitiveStay <noreply@intuitivestay.com>"

function addPrices(basePrice: string, addOn: number): string {
  const base = parseFloat(basePrice.replace(/[^0-9.]/g, ""))
  return `£${(base + addOn).toFixed(2)}`
}

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

export async function sendAdditionalPropertyPaymentEmail(
  ownerEmail: string,
  ownerName: string,
  propertyName: string,
  checkoutUrl: string,
  basePlan: string,
  basePrice: string,
) {
  const planLabel = basePlan.charAt(0).toUpperCase() + basePlan.slice(1)

  await resend.emails.send({
    from: FROM,
    to: ownerEmail,
    subject: `Your property "${propertyName}" has been approved — complete payment to activate`,
    html: `<h1>Hi ${ownerName},</h1>
<p>Great news — your property <strong>${propertyName}</strong> has been approved!</p>
<p>As this is an additional property beyond your plan allowance, a monthly add-on fee applies:</p>
<table style="border-collapse:collapse;width:100%;max-width:400px;margin:16px 0">
  <tr>
    <td style="padding:8px;color:#64748b">${planLabel} plan (base)</td>
    <td style="padding:8px;text-align:right">${basePrice}/month</td>
  </tr>
  <tr>
    <td style="padding:8px;color:#64748b">Additional property</td>
    <td style="padding:8px;text-align:right">£25.00/month</td>
  </tr>
  <tr style="border-top:2px solid #e2e8f0;font-weight:bold">
    <td style="padding:8px">New monthly total</td>
    <td style="padding:8px;text-align:right">${addPrices(basePrice, 25.00)}/month</td>
  </tr>
</table>
<p>No setup fees. Cancel at any time from your billing dashboard. Your QR code will be sent once payment is confirmed.</p>
<p style="margin-top:24px">
  <a href="${checkoutUrl}" style="display:inline-block;background:#f97316;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px">Complete Payment →</a>
</p>
<p style="font-size:12px;color:#64748b;margin-top:12px">
  This link expires in 24 hours. If it stops working, log in to your portal and click <strong>Complete Payment</strong> on the property card to get a fresh link.
</p>`,
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
  propertyId: string,
  feedbackId: string,
  gcs: number,
  pillars: { resilience: number; empathy: number; anticipation: number; recognition: number },
) {
  const alertsUrl = `${env.PUBLIC_PORTAL_URL}/properties/${propertyId}/alerts#${feedbackId}`

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
<p>
  <a href="${alertsUrl}" style="display:inline-block;background:#ef4444;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">View this alert →</a>
</p>
<p style="font-size:12px;color:#64748b">This link takes you directly to the feedback entry in your Alerts page.</p>`,
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

export async function sendVelocityAlertEmail(
  propertyName: string,
  submissionCount: number,
  windowMinutes: number,
) {
  await resend.emails.send({
    from: FROM,
    to: env.ADMIN_EMAIL,
    subject: `🚨 Submission spike at ${propertyName}`,
    html: `<h1>Submission Velocity Alert</h1>
<p><strong>${submissionCount}</strong> feedback submissions have been received from <strong>${propertyName}</strong> in the last <strong>${windowMinutes} minutes</strong>.</p>
<p>This may indicate misuse of the QR code. Please log in to review the submissions:</p>
<p><a href="${env.PUBLIC_PORTAL_URL}" style="display:inline-block;background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Open Admin Portal →</a></p>`,
  })
}

export async function sendStaffVerificationEmail(
  staffEmail: string,
  staffName: string,
  propertyName: string,
  token: string,
) {
  const verifyUrl = `${env.PUBLIC_PORTAL_URL}/staff-verify/${token}`

  await resend.emails.send({
    from: FROM,
    to: staffEmail,
    subject: `Verify your Service Signature profile — ${propertyName}`,
    html: `<h1>Hi ${staffName},</h1>
<p>You've registered your Service Signature profile at <strong>${propertyName}</strong>.</p>
<p>Click the button below to verify your email address and activate your profile:</p>
<p><a href="${verifyUrl}" style="display:inline-block;background:#f97316;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Verify My Email →</a></p>
<p style="font-size:12px;color:#64748b">If you didn't register for a Service Signature profile, you can safely ignore this email.</p>`,
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

export async function sendStaffNominationEmail(
  staffEmail: string,
  staffName: string,
  propertyName: string,
  staffProfileId: string,
) {
  const profileUrl = `${env.PUBLIC_PORTAL_URL}/staff-profile/${staffProfileId}`

  await resend.emails.send({
    from: FROM,
    to: staffEmail,
    subject: `You've received a guest nomination — ${propertyName}`,
    html: `<h1>Hi ${staffName},</h1>
<p>A guest just nominated you on IntuitiveStay at <strong>${propertyName}</strong>.</p>
<p>View your updated Service Signature to see how your score is growing:</p>
<p><a href="${profileUrl}" style="display:inline-block;background:#f97316;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">View My Profile →</a></p>
<p style="font-size:12px;color:#64748b">Keep delivering exceptional service — every nomination counts.</p>`,
  })
}

export async function sendStaffCommendationEmail(
  staffEmail: string,
  staffName: string,
  authorName: string,
  propertyName: string,
  staffProfileId: string,
) {
  const profileUrl = `${env.PUBLIC_PORTAL_URL}/staff-profile/${staffProfileId}`

  await resend.emails.send({
    from: FROM,
    to: staffEmail,
    subject: `New commendation from ${authorName} — ${propertyName}`,
    html: `<h1>Hi ${staffName},</h1>
<p>Your manager <strong>${authorName}</strong> at <strong>${propertyName}</strong> has written a commendation on your Service Signature.</p>
<p>Log in to your profile to read it:</p>
<p><a href="${profileUrl}" style="display:inline-block;background:#f97316;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">View My Profile →</a></p>`,
  })
}

export async function sendProfileLinkEmail(
  staffEmail: string,
  profiles: Array<{ name: string; propertyName: string; staffProfileId: string }>,
) {
  const profileLinks = profiles
    .map(
      (p) =>
        `<div style="margin:12px 0;padding:12px;border:1px solid #e2e8f0;border-radius:8px">
  <p style="margin:0 0 8px;font-weight:bold">${p.name} · ${p.propertyName}</p>
  <a href="${env.PUBLIC_PORTAL_URL}/staff-profile/${p.staffProfileId}" style="display:inline-block;background:#f97316;color:white;padding:8px 20px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px">View Profile →</a>
</div>`,
    )
    .join("")

  await resend.emails.send({
    from: FROM,
    to: staffEmail,
    subject: "Your Service Signature profile link",
    html: `<h1>Your Service Signature profile</h1>
<p>Here ${profiles.length === 1 ? "is" : "are"} your Service Signature profile ${profiles.length === 1 ? "link" : "links"}:</p>
${profileLinks}
<p style="font-size:12px;color:#64748b;margin-top:24px">Bookmark this link so you can access your profile at any time.</p>`,
  })
}

export async function sendBusinessEmailVerification(
  businessEmail: string,
  propertyName: string,
  verificationUrl: string,
) {
  await resend.emails.send({
    from: FROM,
    to: businessEmail,
    subject: `Verify your business email for "${propertyName}"`,
    html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto">
<h1 style="font-size:22px;color:#1c1917">One step to go</h1>
<p style="color:#44403c">We received a request to register <strong>${propertyName}</strong> on IntuitiveStay.</p>
<p style="color:#44403c">To confirm you have access to this business email address, click the button below. Your submission will then be reviewed by our team.</p>
<p style="margin:28px 0">
  <a href="${verificationUrl}" style="display:inline-block;background:#f97316;color:white;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">Verify business email →</a>
</p>
<p style="font-size:12px;color:#78716c">This link expires in 48 hours. If you did not submit this property, you can safely ignore this email.</p>
</div>`,
  })
}
