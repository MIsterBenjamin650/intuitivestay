import { db } from "@intuitive-stay/db"
import { organisations, properties, propertyMembers } from "@intuitive-stay/db/schema"
import { TRPCError } from "@trpc/server"
import { and, eq } from "drizzle-orm"

/**
 * Verifies the caller either owns the property's org OR is an active staff
 * member of that property. Throws FORBIDDEN if neither is true.
 *
 * Returns `{ isOwner: true }` for org owners so callers that need plan/
 * subscription data can do a second query with the known org relationship.
 * Returns `{ isOwner: false }` for staff members.
 */
export async function assertPropertyAccess(
  userId: string,
  propertyId: string,
): Promise<{ isOwner: boolean }> {
  // Owner path: user's org must contain this property
  const ownerRow = await db
    .select({ orgId: organisations.id })
    .from(organisations)
    .innerJoin(properties, eq(properties.organisationId, organisations.id))
    .where(and(eq(organisations.ownerId, userId), eq(properties.id, propertyId)))
    .limit(1)

  if (ownerRow.length) return { isOwner: true }

  // Staff path: user must be an active member of this property
  const memberRow = await db
    .select({ id: propertyMembers.id })
    .from(propertyMembers)
    .where(
      and(
        eq(propertyMembers.propertyId, propertyId),
        eq(propertyMembers.userId, userId),
        eq(propertyMembers.status, "active"),
      ),
    )
    .limit(1)

  if (memberRow.length) return { isOwner: false }

  throw new TRPCError({ code: "FORBIDDEN" })
}
