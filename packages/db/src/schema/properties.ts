import { relations } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

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
  postcode: text("postcode"),
  status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'rejected'
  adminNotes: text("admin_notes"),
  isVip: boolean("is_vip").default(false).notNull(),
  tripAdvisorUrl: text("tripadvisor_url"),
  googlePlaceId: text("google_place_id"),
  ownerEmail: text("owner_email").notNull(),
  ownerName: text("owner_name").notNull(),
  // ownerEmail/ownerName copied from Wix registration form; add userId FK in a later migration once owner creates their portal account
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
},
(table) => [
  index("properties_organisationId_idx").on(table.organisationId),
  index("properties_city_idx").on(table.city),
  index("properties_status_idx").on(table.status),
  // Composite — leaderboard queries filter by city AND status together
  index("properties_city_status_idx").on(table.city, table.status),
]);

export const propertiesRelations = relations(properties, ({ one }) => ({
  organisation: one(organisations, {
    fields: [properties.organisationId],
    references: [organisations.id],
  }),
}));
