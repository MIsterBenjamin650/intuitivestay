import { relations } from "drizzle-orm";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { properties } from "./properties";

export const qrCodes = pgTable("qr_codes", {
  id: text("id").primaryKey(),
  propertyId: text("property_id")
    .notNull()
    .unique()
    .references(() => properties.id, { onDelete: "cascade" }),
  uniqueCode: text("unique_code").notNull().unique(),
  feedbackUrl: text("feedback_url").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const qrCodesRelations = relations(qrCodes, ({ one }) => ({
  property: one(properties, {
    fields: [qrCodes.propertyId],
    references: [properties.id],
  }),
}));
