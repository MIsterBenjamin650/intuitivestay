import { relations } from "drizzle-orm"
import { pgTable, text, timestamp, date } from "drizzle-orm/pg-core"

import { properties } from "./properties"

export const propertyTiers = pgTable("property_tiers", {
  id: text("id").primaryKey(),
  propertyId: text("property_id")
    .notNull()
    .unique()
    .references(() => properties.id, { onDelete: "cascade" }),
  currentTier: text("current_tier").notNull().default("member"),
  pendingTier: text("pending_tier"),
  pendingDirection: text("pending_direction"),
  pendingFrom: date("pending_from"),
  lastEvaluatedAt: timestamp("last_evaluated_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const propertyTiersRelations = relations(propertyTiers, ({ one }) => ({
  property: one(properties, {
    fields: [propertyTiers.propertyId],
    references: [properties.id],
  }),
}))
