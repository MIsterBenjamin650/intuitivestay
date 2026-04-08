import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { properties } from "./properties"

export const dashboardCache = pgTable(
  "dashboard_cache",
  {
    id:          text("id").primaryKey(),          // "{propertyId}:{days}"
    propertyId:  text("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
    days:        integer("days").notNull(),         // 7 | 30 | 90
    stats:       jsonb("stats").notNull(),          // { totalFeedback, avgGcs }
    gcsHistory:  jsonb("gcs_history").notNull(),    // bucketed pillar history
    wordCloud:   jsonb("word_cloud").notNull(),     // [{ word, count }]
    staffBubbles:jsonb("staff_bubbles").notNull(),  // [{ name, count, sentiment }]
    computedAt:  timestamp("computed_at").defaultNow().notNull(),
  },
  (table) => [
    index("dashboard_cache_propertyId_idx").on(table.propertyId),
  ],
)
