import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { properties } from "./properties"
import { staffProfiles } from "./staff-profiles"

export const staffCommendations = pgTable(
  "staff_commendations",
  {
    id: text("id").primaryKey(),
    staffProfileId: text("staff_profile_id")
      .notNull()
      .references(() => staffProfiles.id, { onDelete: "cascade" }),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    /** Owner's display name stored at write time — persists even if user renames. */
    authorName: text("author_name").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("staff_commendations_staff_profile_id_idx").on(table.staffProfileId),
  ],
)
