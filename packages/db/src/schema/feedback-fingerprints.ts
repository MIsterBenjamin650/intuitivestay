import { relations } from "drizzle-orm"
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { properties } from "./properties"

/**
 * Stores device fingerprints used to prevent duplicate feedback submissions.
 * A fingerprint can only submit once per property per 24-hour window.
 */
export const feedbackFingerprints = pgTable(
  "feedback_fingerprints",
  {
    id: text("id").primaryKey(),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    fingerprint: text("fingerprint").notNull(),
    submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  },
  (table) => [
    index("feedback_fingerprints_property_fingerprint_idx").on(
      table.propertyId,
      table.fingerprint,
    ),
  ],
)

export const feedbackFingerprintsRelations = relations(feedbackFingerprints, ({ one }) => ({
  property: one(properties, {
    fields: [feedbackFingerprints.propertyId],
    references: [properties.id],
  }),
}))
