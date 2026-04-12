import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { properties } from "./properties";
import { feedback } from "./feedback";

export const qrCodes = pgTable("qr_codes", {
  id: text("id").primaryKey(),
  propertyId: text("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  label: text("label"), // e.g. "Table 7", "Room 12", "Bar Area" — null = default/general code
  uniqueCode: text("unique_code").notNull().unique(),
  feedbackUrl: text("feedback_url").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const qrCodesRelations = relations(qrCodes, ({ one, many }) => ({
  property: one(properties, {
    fields: [qrCodes.propertyId],
    references: [properties.id],
  }),
  feedback: many(feedback),
}));
