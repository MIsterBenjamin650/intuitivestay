import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, integer, numeric } from "drizzle-orm/pg-core";

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
  consistency: integer("consistency").notNull(),
  recognition: integer("recognition").notNull(),
  gcs: numeric("gcs", { precision: 4, scale: 2 }).notNull(),
  mealTime: text("meal_time"),
  source: text("source").notNull().default("qr_form"),
  namedStaffMember: text("named_staff_member"),
  ventText: text("vent_text"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

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
