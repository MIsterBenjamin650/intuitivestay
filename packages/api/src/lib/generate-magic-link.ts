import { auth, pendingMagicLinks } from "@intuitive-stay/auth"
import { env } from "@intuitive-stay/env/server"

export async function generateMagicLinkUrl(email: string): Promise<string | null> {
  try {
    await auth.api.signInMagicLink({
      body: {
        email,
        callbackURL: env.PUBLIC_PORTAL_URL,
      },
      headers: new Headers(),
    })
    const url = pendingMagicLinks.get(email) ?? null
    pendingMagicLinks.delete(email)
    return url
  } catch {
    return null
  }
}
