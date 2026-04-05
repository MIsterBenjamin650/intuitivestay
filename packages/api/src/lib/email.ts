import { env } from "@intuitive-stay/env/server"
import { Resend } from "resend"

const resend = new Resend(env.RESEND_API_KEY)

const FROM = "IntuItiveStay <onboarding@intuitivestay.com>"

export async function sendApprovalEmail(
  ownerEmail: string,
  ownerName: string,
  propertyName: string,
  qrPdfBuffer?: Buffer,
) {
  await resend.emails.send({
    from: FROM,
    to: ownerEmail,
    subject: `Your property "${propertyName}" has been approved`,
    html: `<h1>Welcome to IntuItiveStay, ${ownerName}!</h1>
<p>Your property <strong>${propertyName}</strong> has been approved and is now live.</p>
<p>Log in to your portal to view your dashboard and download your QR code:</p>
<p><a href="${env.PUBLIC_PORTAL_URL}">${env.PUBLIC_PORTAL_URL}</a></p>
<p>Your branded QR code is attached to this email as a PDF. Print it and place it at reception, bedside tables, or dining areas.</p>
<p>If you haven't set a password yet, use the "Forgot password" option on the login page.</p>`,
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

export async function sendAlertEmail(
  ownerEmail: string,
  ownerName: string,
  propertyName: string,
  gcs: number,
  pillars: { resilience: number; empathy: number; consistency: number; recognition: number },
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
  <li>Consistency: ${pillars.consistency}/10</li>
  <li>Recognition: ${pillars.recognition}/10</li>
</ul>
<p>Log in to your portal to view any additional feedback left by the guest:</p>
<p><a href="${env.PUBLIC_PORTAL_URL}">${env.PUBLIC_PORTAL_URL}</a></p>`,
  })
}
