import { env } from "@intuitive-stay/env/server"
import { Resend } from "resend"

const resend = new Resend(env.RESEND_API_KEY)

const FROM = "IntuItiveStay <onboarding@intuitivestay.com>"

export async function sendApprovalEmail(
  ownerEmail: string,
  ownerName: string,
  propertyName: string,
) {
  await resend.emails.send({
    from: FROM,
    to: ownerEmail,
    subject: `Your property "${propertyName}" has been approved`,
    html: `<h1>Welcome to IntuItiveStay, ${ownerName}!</h1>
<p>Your property <strong>${propertyName}</strong> has been approved and is now live.</p>
<p>Log in to your portal to view your dashboard and download your QR code:</p>
<p><a href="${env.PUBLIC_PORTAL_URL}">${env.PUBLIC_PORTAL_URL}</a></p>
<p>If you haven't set a password yet, use the "Forgot password" option on the login page.</p>`,
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
