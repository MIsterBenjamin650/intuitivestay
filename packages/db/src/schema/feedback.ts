import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, integer, numeric, index, boolean } from "drizzle-orm/pg-core";

import { properties } from "./properties";
import { qrCodes } from "./qr-codes";

export const feedback = pgTable("feedback", {
  id: text("id").primaryKey(),
  propertyId: text("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  qrCodeId: text("qr_code_id").references(() => qrCodes.id, {
    onDelete: "set null",
  }),
  resilience: integer("resilience").notNull(),
  empathy: integer("empathy").notNull(),
  anticipation: integer("anticipation").notNull(),
  recognition: integer("recognition").notNull(),
  gcs: numeric("gcs", { precision: 4, scale: 2 }).notNull(), // pre-calculated before insert: (resilience + empathy + anticipation + recognition) / 4
  mealTime: text("meal_time"),
  source: text("source").notNull().default("qr_form"),
  namedStaffMember: text("named_staff_member"),
  ventText: text("vent_text"),
  adjectives: text("adjectives"), // comma-separated guest-chosen words e.g. "clean,friendly,quiet"
  guestEmail: text("guest_email"),
  isUniformScore: boolean("is_uniform_score").default(false).notNull(), // true if all 4 pillars rated identically — flagged as low confidence
  seenByOwner: boolean("seen_by_owner").default(false).notNull(), // cleared to true when owner visits Alerts page — drives the notification badge
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
},
(table) => [
  // Single-column — covers queries filtering by property alone
  index("feedback_propertyId_idx").on(table.propertyId),
  // Composite — covers the vast majority of dashboard queries (property + time range)
  index("feedback_propertyId_submittedAt_idx").on(table.propertyId, table.submittedAt),
  // Standalone time index — covers city-wide aggregations that don't filter by property
  index("feedback_submittedAt_idx").on(table.submittedAt),
  // Low GCS alert queries
  index("feedback_gcs_idx").on(table.gcs),
  // Unread alert count queries (property_id + seen_by_owner)
  index("feedback_propertyId_seen_idx").on(table.propertyId, table.seenByOwner),
],
);

export const feedbackRelations = relations(feedback, ({ one }) => ({
  property: one(properties, {
    fields: [feedback.propertyId],
    references: [properties.id],
  }),
  qrCode: one(qrCodes, {
    fields: [feedback.qrCodeId],
    references: [qrCodes.id],
  }),
}));
