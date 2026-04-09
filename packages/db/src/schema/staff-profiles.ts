// packages/db/src/schema/staff-profiles.ts
import { index, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core"

import { properties } from "./properties"

export const staffProfiles = pgTable(
  "staff_profiles",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    emailVerificationToken: text("email_verification_token"),
    emailVerifiedAt: timestamp("email_verified_at"),
    /** Set when staff completes the £9.99 one-time Stripe payment. */
    activatedAt: timestamp("activated_at"),
    /** Stripe PaymentIntent ID stored for audit purposes. */
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("staff_profiles_property_id_idx").on(table.propertyId),
    unique("staff_profiles_property_email_unique").on(table.propertyId, table.email),
    unique("staff_profiles_verification_token_unique").on(table.emailVerificationToken),
  ],
)
