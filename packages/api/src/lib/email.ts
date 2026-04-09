import { env } from "@intuitive-stay/env/server"
import { Resend } from "resend"

const resend = new Resend(env.RESEND_API_KEY)

const FROM = "IntuitiveStay <noreply@intuitivestay.com>"

function addPrices(basePrice: string, addOn: number): string {
  const base = parseFloat(basePrice.replace(/[^0-9.]/g, ""))
  return `£${(base + addOn).toFixed(2)}`
}

// ── Shared email shell ────────────────────────────────────────────────────────
// Mirrors the login page: warm cream background, white card, orange header bar.
function wrap(body: string): string {
  const year = new Date().getFullYear()
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#fef3e2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef3e2;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px">

        <!-- Logo header -->
        <tr><td style="background:#f97316;border-radius:16px 16px 0 0;padding:24px 32px">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:36px;height:36px;background:rgba(255,255,255,0.2);border-radius:8px;text-align:center;vertical-align:middle">
              <span style="color:white;font-size:13px;font-weight:800;letter-spacing:-0.5px">IS</span>
            </td>
            <td style="padding-left:10px;color:white;font-size:17px;font-weight:700;letter-spacing:-0.3px">IntuitiveStay</td>
          </tr></table>
        </td></tr>

        <!-- Card body -->
        <tr><td style="background:#ffffff;padding:36px 32px;border-left:1px solid #fed7aa;border-right:1px solid #fed7aa">
          ${body}
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#fef9f5;border:1px solid #fed7aa;border-top:none;border-radius:0 0 16px 16px;padding:18px 32px;text-align:center">
          <p style="margin:0;font-size:11px;color:#a8a29e">© ${year} IntuitiveStay &nbsp;·&nbsp; <a href="${env.PUBLIC_PORTAL_URL}" style="color:#a8a29e;text-decoration:none">intuitivestay.com</a></p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Reusable snippets ─────────────────────────────────────────────────────────
function btn(label: string, href: string, color = "#f97316"): string {
  return `<p style="margin:28px 0 0">
    <a href="${href}" style="display:inline-block;background:${color};color:white;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">${label}</a>
  </p>`
}

function infoTable(rows: Array<[string, string]>): string {
  const trs = rows
    .map(
      ([label, value]) =>
        `<tr>
          <td style="padding:8px 12px;color:#78716c;font-size:13px;white-space:nowrap">${label}</td>
          <td style="padding:8px 12px;color:#1c1917;font-size:13px">${value}</td>
        </tr>`,
    )
    .join("")
  return `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;background:#fef9f5;border:1px solid #fed7aa;border-radius:8px;margin:20px 0">${trs}</table>`
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#1c1917;letter-spacing:-0.4px">${text}</h1>`
}

function p(text: string, small = false): string {
  return `<p style="margin:0 0 14px;font-size:${small ? "12px" : "14px"};line-height:1.6;color:${small ? "#78716c" : "#44403c"}">${text}</p>`
}

// ── Email functions ───────────────────────────────────────────────────────────

export async function sendApprovalEmail(
  ownerEmail: string,
  ownerName: string,
  propertyName: string,
  qrPdfBuffer?: Buffer,
  magicLinkUrl?: string,
) {
  const ctaBlock = magicLinkUrl
    ? btn("Open My Dashboard →", magicLinkUrl) +
      p(`This link expires in 24 hours. After that, <a href="${env.PUBLIC_PORTAL_URL}/login" style="color:#f97316">log in here</a> and use "Forgot password" if you haven't set one yet.`, true)
    : btn("Log in to your dashboard →", `${env.PUBLIC_PORTAL_URL}/login`) +
      p(`If you haven't set a password yet, use the "Forgot password" option on the login page.`, true)

  await resend.emails.send({
    from: FROM,
    to: ownerEmail,
    subject: `Your property "${propertyName}" has been approved`,
    html: wrap(
      h1(`Welcome to IntuitiveStay, ${ownerName}!`) +
      p(`Your property <strong>${propertyName}</strong> has been approved and is now live.`) +
      p(`Click below to access your dashboard:`) +
      ctaBlock +
      `<div style="margin-top:24px;padding:16px;background:#fef9f5;border:1px solid #fed7aa;border-radius:8px">
        ${p(`Your branded QR code is attached to this email as a PDF. Print it and place it at reception, bedside tables, or dining areas.`)}
      </div>`,
    ),
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
    html: wrap(
      h1(`Great news, ${ownerName}!`) +
      p(`Your property <strong>${propertyName}</strong> has been approved. As this is an additional property beyond your plan allowance, a monthly add-on fee applies:`) +
      infoTable([
        [`${planLabel} plan (base)`, `${basePrice}/month`],
        [`Additional property`, `£25.00/month`],
        [`New monthly total`, `${addPrices(basePrice, 25.00)}/month`],
      ]) +
      p(`No setup fees. Cancel at any time from your billing dashboard. Your QR code will be sent once payment is confirmed.`) +
      btn("Complete Payment →", checkoutUrl) +
      p(`This link expires in 24 hours. If it stops working, log in to your portal and click <strong>Complete Payment</strong> on the property card.`, true),
    ),
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
    html: wrap(
      h1(`Hi ${ownerName},`) +
      p(`Thank you for submitting <strong>${propertyName}</strong> to IntuitiveStay.`) +
      p(`We need a little more information before we can approve your property. Please reply to this email with any additional details and we'll be in touch shortly.`),
    ),
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
    html: wrap(
      h1("Reset your password") +
      p("Click the link below to reset your IntuitiveStay password. This link expires in 1 hour.") +
      btn("Reset Password →", resetUrl) +
      p("If you didn't request this, you can safely ignore this email.", true),
    ),
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
    html: wrap(
      h1(`Hi ${ownerName},`) +
      p(`A guest at <strong>${propertyName}</strong> submitted a low Guest Connection Score of <strong>${gcs.toFixed(2)}</strong>.`) +
      infoTable([
        ["Resilience", `${pillars.resilience}/10`],
        ["Empathy", `${pillars.empathy}/10`],
        ["Anticipation", `${pillars.anticipation}/10`],
        ["Recognition", `${pillars.recognition}/10`],
      ]) +
      btn("View this alert →", alertsUrl, "#ef4444") +
      p("This link takes you directly to the feedback entry in your Alerts page.", true),
    ),
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
  const focusItems = focus
    .map(
      (f) =>
        `<div style="margin:10px 0;padding:12px 14px;background:#fef9f5;border-left:3px solid #f97316;border-radius:0 6px 6px 0">
          <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#f97316;text-transform:uppercase;letter-spacing:0.05em">${f.pillar}</p>
          <p style="margin:0;font-size:13px;color:#44403c;line-height:1.5">${f.action}</p>
        </div>`,
    )
    .join("")

  await resend.emails.send({
    from: FROM,
    to: ownerEmail,
    subject: `Your Daily Guest Care Summary — ${date}`,
    html: wrap(
      h1("Daily Guest Care Summary") +
      p(`<strong>${propertyName}</strong> · ${date}`) +
      p(narrative) +
      `<p style="margin:20px 0 8px;font-size:11px;font-weight:700;color:#a8a29e;text-transform:uppercase;letter-spacing:0.07em">Today's Focus</p>` +
      focusItems +
      btn("View your full dashboard →", portalUrl),
    ),
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
    html: wrap(
      h1("New Property Registration") +
      p("A new property has been submitted and email-verified. It is now awaiting your approval.") +
      infoTable([
        ["Owner", ownerName],
        ["Email", ownerEmail],
        ["Property", propertyName],
        ["Location", `${propertyCity}, ${propertyCountry}`],
      ]) +
      btn("Review in Portal →", portalUrl),
    ),
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
    html: wrap(
      h1("New Portal Enquiry") +
      infoTable([
        ["Name", senderName],
        ["Email", senderEmail],
      ]) +
      `<div style="margin-top:16px;padding:16px;background:#fef9f5;border:1px solid #fed7aa;border-radius:8px">
        <p style="margin:0;font-size:13px;color:#44403c;white-space:pre-wrap;line-height:1.6">${message}</p>
      </div>`,
    ),
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
    html: wrap(
      h1(`New ${isTrialing ? "Trial" : "Subscription"}`) +
      infoTable([
        ["Owner", ownerName],
        ["Email", ownerEmail],
        ["Property", propertyName],
        ["Plan", planLabel],
        ["Status", isTrialing ? "Trial started" : "Active subscription"],
      ]),
    ),
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
    html: wrap(
      h1("Submission Velocity Alert") +
      p(`<strong>${submissionCount}</strong> feedback submissions have been received from <strong>${propertyName}</strong> in the last <strong>${windowMinutes} minutes</strong>.`) +
      p("This may indicate misuse of the QR code. Please log in to review the submissions:") +
      btn("Open Admin Portal →", env.PUBLIC_PORTAL_URL, "#ef4444"),
    ),
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
    html: wrap(
      h1(`Hi ${staffName},`) +
      p(`You've registered your Service Signature profile at <strong>${propertyName}</strong>.`) +
      p("Click the button below to verify your email address and activate your profile:") +
      btn("Verify My Email →", verifyUrl) +
      p("If you didn't register for a Service Signature profile, you can safely ignore this email.", true),
    ),
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
    html: wrap(
      h1("You've been invited!") +
      p(`<strong>${inviterName}</strong> has invited you to access the guest feedback dashboard for <strong>${propertyName}</strong>.`) +
      p("Click the button below to accept your invitation and set up your account:") +
      btn("Accept Invitation →", inviteUrl) +
      p("This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.", true),
    ),
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
    html: wrap(
      h1(`Hi ${staffName},`) +
      p(`A guest just nominated you on IntuitiveStay at <strong>${propertyName}</strong>.`) +
      p("View your updated Service Signature to see how your score is growing:") +
      btn("View My Profile →", profileUrl) +
      p("Keep delivering exceptional service — every nomination counts.", true),
    ),
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
    html: wrap(
      h1(`Hi ${staffName},`) +
      p(`Your manager <strong>${authorName}</strong> at <strong>${propertyName}</strong> has written a commendation on your Service Signature.`) +
      p("Log in to your profile to read it:") +
      btn("View My Profile →", profileUrl),
    ),
  })
}

export async function sendProfileLinkEmail(
  staffEmail: string,
  profiles: Array<{ name: string; propertyName: string; staffProfileId: string }>,
) {
  const profileCards = profiles
    .map(
      (p) =>
        `<div style="margin:10px 0;padding:14px 16px;background:#fef9f5;border:1px solid #fed7aa;border-radius:8px">
          <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#1c1917">${p.name} · ${p.propertyName}</p>
          <a href="${env.PUBLIC_PORTAL_URL}/staff-profile/${p.staffProfileId}" style="display:inline-block;background:#f97316;color:white;padding:8px 20px;border-radius:6px;text-decoration:none;font-weight:700;font-size:13px">View Profile →</a>
        </div>`,
    )
    .join("")

  await resend.emails.send({
    from: FROM,
    to: staffEmail,
    subject: "Your Service Signature profile link",
    html: wrap(
      h1("Your Service Signature profile") +
      p(`Here ${profiles.length === 1 ? "is" : "are"} your Service Signature profile ${profiles.length === 1 ? "link" : "links"}:`) +
      profileCards +
      p("Bookmark this link so you can access your profile at any time.", true),
    ),
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
    html: wrap(
      h1("One step to go") +
      p(`We received a request to register <strong>${propertyName}</strong> on IntuitiveStay.`) +
      p("To confirm you have access to this business email address, click the button below. Your submission will then be reviewed by our team.") +
      btn("Verify business email →", verificationUrl) +
      p("This link expires in 48 hours. If you did not submit this property, you can safely ignore this email.", true),
    ),
  })
}
