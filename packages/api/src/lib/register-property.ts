import { db } from "@intuitive-stay/db"
import { organisations, properties, user } from "@intuitive-stay/db/schema"
import { env } from "@intuitive-stay/env/server"
import { eq } from "drizzle-orm"
import { sendBusinessEmailVerification } from "./email"

export type RegisterPropertyInput = {
  ownerName: string
  /** The business/property email (e.g. info@thebistro.com).
   *  Used as the portal login and for ownership verification. */
  businessEmail: string
  businessWebsite?: string
  propertyName: string
  propertyAddress?: string
  propertyCity: string
  propertyPostcode?: string
  propertyCountry: string
  propertyType?: string
}

export async function registerPropertyFromWix(input: RegisterPropertyInput) {
  // 1. Find or create the portal user account (keyed on business email)
  const existingUser = await db.query.user.findFirst({
    where: eq(user.email, input.businessEmail),
  })

  const userId = existingUser?.id ?? crypto.randomUUID()

  if (!existingUser) {
    await db.insert(user).values({
      id: userId,
      name: input.ownerName,
      email: input.businessEmail,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  // 2. Find or create an organisation for this owner
  let orgId: string

  const existingOrg = await db.query.organisations.findFirst({
    where: eq(organisations.ownerId, userId),
  })

  if (existingOrg) {
    orgId = existingOrg.id
  } else {
    const baseSlug = input.ownerName
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`
    orgId = crypto.randomUUID()

    await db.insert(organisations).values({
      id: orgId,
      name: `${input.ownerName}'s Organisation`,
      slug,
      plan: "member",
      ownerId: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  // 3. Create the property — held pending email verification before admin sees it
  const propertyId = crypto.randomUUID()
  const verificationToken = crypto.randomUUID()
  const tokenExpires = new Date(Date.now() + 48 * 60 * 60 * 1000)

  const [property] = await db
    .insert(properties)
    .values({
      id: propertyId,
      organisationId: orgId,
      name: input.propertyName,
      address: input.propertyAddress ?? null,
      city: input.propertyCity,
      postcode: input.propertyPostcode ?? null,
      country: input.propertyCountry,
      type: input.propertyType ?? null,
      status: "pending",
      ownerEmail: input.businessEmail,
      ownerName: input.ownerName,
      businessEmail: input.businessEmail,
      businessWebsite: input.businessWebsite ?? null,
      businessEmailVerified: false,
      businessEmailToken: verificationToken,
      businessEmailTokenExpires: tokenExpires,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()

  // 4. Send verification email — admin is notified only after the link is clicked
  const verificationUrl = `${env.PUBLIC_PORTAL_URL}/verify-property/${verificationToken}`
  try {
    await sendBusinessEmailVerification(input.businessEmail, input.propertyName, verificationUrl)
  } catch (err) {
    console.error("Failed to send business email verification:", err)
  }

  return property
}
