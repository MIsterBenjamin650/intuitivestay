import { db } from "@intuitive-stay/db"
import { organisations, properties, user } from "@intuitive-stay/db/schema"
import { env } from "@intuitive-stay/env/server"
import { eq } from "drizzle-orm"
import { sendNewPropertyNotificationEmail } from "./email"

export type RegisterPropertyInput = {
  ownerName: string
  ownerEmail: string
  propertyName: string
  propertyAddress?: string
  propertyCity: string
  propertyPostcode?: string
  propertyCountry: string
  propertyType?: string
}

export async function registerPropertyFromWix(input: RegisterPropertyInput) {
  // 1. Find or create the portal user account
  const existingUser = await db.query.user.findFirst({
    where: eq(user.email, input.ownerEmail),
  })

  const userId = existingUser?.id ?? crypto.randomUUID()

  if (!existingUser) {
    await db.insert(user).values({
      id: userId,
      name: input.ownerName,
      email: input.ownerEmail,
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
    // Append random suffix to guarantee uniqueness
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

  // 3. Create the property (status: pending — awaiting admin approval)
  const propertyId = crypto.randomUUID()
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
      ownerEmail: input.ownerEmail,
      ownerName: input.ownerName,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()

  // 4. Notify admin of new submission
  try {
    await sendNewPropertyNotificationEmail(
      input.ownerName,
      input.ownerEmail,
      input.propertyName,
      input.propertyCity,
      input.propertyCountry,
      env.PUBLIC_PORTAL_URL,
    )
  } catch (err) {
    console.error("Failed to send admin notification email:", err)
  }

  return property
}
