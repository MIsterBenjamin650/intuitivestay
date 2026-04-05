import { relations } from "drizzle-orm";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { organisations } from "./organisations";

export const properties = pgTable("properties", {
  id: text("id").primaryKey(),
  organisationId: text("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  address: text("address"),
  city: text("city").notNull(),
  country: text("country").notNull(),
  type: text("type"), // 'hotel' | 'villa' | 'bnb' | 'restaurant' | 'other'
  status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'rejected'
  ownerEmail: text("owner_email").notNull(),
  ownerName: text("owner_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const propertiesRelations = relations(properties, ({ one }) => ({
  organisation: one(organisations, {
    fields: [properties.organisationId],
    references: [organisations.id],
  }),
}));
