import { relations } from "drizzle-orm"
import { integer, numeric, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

import { properties } from "./properties"

export const onlineReviewsCache = pgTable(
  "online_reviews_cache",
  {
    id: text("id").primaryKey(),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    source: text("source").notNull(), // 'tripadvisor' | 'google'
    avgRating: numeric("avg_rating", { precision: 3, scale: 1 }),
    reviewCount: integer("review_count").notNull().default(0),
    pillarResilience: numeric("pillar_resilience", { precision: 4, scale: 2 }),
    pillarEmpathy: numeric("pillar_empathy", { precision: 4, scale: 2 }),
    pillarAnticipation: numeric("pillar_anticipation", { precision: 4, scale: 2 }),
    pillarRecognition: numeric("pillar_recognition", { precision: 4, scale: 2 }),
    lastScrapedAt: timestamp("last_scraped_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("online_reviews_cache_property_source_idx").on(
      table.propertyId,
      table.source,
    ),
  ],
)

export const onlineReviewsCacheRelations = relations(onlineReviewsCache, ({ one }) => ({
  property: one(properties, {
    fields: [onlineReviewsCache.propertyId],
    references: [properties.id],
  }),
}))
