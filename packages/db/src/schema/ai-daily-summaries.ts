import { relations } from "drizzle-orm"
import { pgTable, text, timestamp, date, jsonb, unique } from "drizzle-orm/pg-core"

import { properties } from "./properties"

export const aiDailySummaries = pgTable(
  "ai_daily_summaries",
  {
    id: text("id").primaryKey(),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    narrative: text("narrative").notNull(),
    focusPoints: jsonb("focus_points").notNull(),
    generatedAt: timestamp("generated_at").defaultNow().notNull(),
  },
  (table) => [unique().on(table.propertyId, table.date)],
)

export const aiDailySummariesRelations = relations(aiDailySummaries, ({ one }) => ({
  property: one(properties, {
    fields: [aiDailySummaries.propertyId],
    references: [properties.id],
  }),
}))
