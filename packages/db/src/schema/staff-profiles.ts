// packages/db/src/schema/staff-profiles.ts
import { index, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core"

import { properties } from "./properties"

export const staffProfiles = pgTable(
  "staff_profiles",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    /** The property this staff member is registered at. */
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("staff_profiles_property_id_idx").on(table.propertyId),
    /** Prevent the same email registering twice at the same property. */
    unique("staff_profiles_property_email_unique").on(table.propertyId, table.email),
  ],
)
