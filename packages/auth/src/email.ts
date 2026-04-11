import { env } from "@intuitive-stay/env/server"
import { Resend } from "resend"

const resend = new Resend(env.RESEND_API_KEY)

const FROM = "IntuitiveStay <noreply@intuitivestay.com>"

function wrap(body: string): string {
  const year = new Date().getFullYear()
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#fef3e2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef3e2;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px">
        <tr><td style="background:#f97316;border-radius:16px 16px 0 0;padding:24px 32px">
          <span style="color:white;font-size:18px;font-weight:800">IntuitiveStay</span>
        </td></tr>
        <tr><td style="background:white;border-radius:0 0 16px 16px;padding:32px">
          ${body}
        </td></tr>
        <tr><td style="padding:16px 0;text-align:center;color:#9ca3af;font-size:12px">
          © ${year} IntuitiveStay. All rights reserved.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function p(text: string): string {
  return `<p style="margin:0 0 16px;color:#1c1917;font-size:15px;line-height:1.6">${text}</p>`
}

function btn(label: string, url: string): string {
  return `<p style="margin:24px 0"><a href="${url}" style="display:inline-block;background:#f97316;color:white;font-weight:600;font-size:15px;padding:12px 28px;border-radius:8px;text-decoration:none">${label}</a></p>`
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
      p("Click the link below to reset your IntuitiveStay password. This link expires in 1 hour.") +
      btn("Reset Password →", resetUrl) +
      p("If you didn't request this, you can safely ignore this email."),
    ),
  })
}

export async function sendMagicLinkEmail(
  email: string,
  magicLinkUrl: string,
) {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Your IntuitiveStay sign-in link",
    html: wrap(
      p("Click the button below to sign in. This link expires in 24 hours and can only be used once.") +
      btn("Sign In →", magicLinkUrl) +
      p("If you didn't request this link, you can safely ignore this email."),
    ),
  })
}
