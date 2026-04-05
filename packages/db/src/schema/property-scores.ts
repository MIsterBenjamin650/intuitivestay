import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, integer, numeric } from "drizzle-orm/pg-core";

import { properties } from "./properties";

export const propertyScores = pgTable("property_scores", {
  id: text("id").primaryKey(),
  propertyId: text("property_id")
    .notNull()
    .unique()
    .references(() => properties.id, { onDelete: "cascade" }),
  avgGcs: numeric("avg_gcs", { precision: 4, scale: 2 }),
  avgResilience: numeric("avg_resilience", { precision: 4, scale: 2 }),
  avgEmpathy: numeric("avg_empathy", { precision: 4, scale: 2 }),
  avgConsistency: numeric("avg_consistency", { precision: 4, scale: 2 }),
  avgRecognition: numeric("avg_recognition", { precision: 4, scale: 2 }),
  totalFeedback: integer("total_feedback").default(0).notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const propertyScoresRelations = relations(propertyScores, ({ one }) => ({
  property: one(properties, {
    fields: [propertyScores.propertyId],
    references: [properties.id],
  }),
}));
