import { relations } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

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
  paymentStatus: text("payment_status"), // null | 'pending' | 'paid' | 'cancelling' | 'cancelled'
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  tripAdvisorUrl: text("tripadvisor_url"),
  googlePlaceId: text("google_place_id"),
  reviewPromptThreshold: integer("review_prompt_threshold").notNull().default(8),
  reviewPromptPlatforms: text("review_prompt_platforms").notNull().default("google,tripadvisor"),
  ownerEmail: text("owner_email").notNull(),
  ownerName: text("owner_name").notNull(),
  // ownerEmail/ownerName copied from Wix registration form; add userId FK in a later migration once owner creates their portal account
  /**
   * When set, staff can self-register at /staff-join/{staffInviteToken}.
   * Regenerating this value invalidates all previous invite links.
   */
  staffInviteToken: text("staff_invite_token").unique(),
  /** Business email for the property (e.g. info@thebistro.com) — must be verified before admin review */
  businessEmail: text("business_email"),
  businessEmailVerified: boolean("business_email_verified").notNull().default(false),
  businessEmailToken: text("business_email_token"),
  businessEmailTokenExpires: timestamp("business_email_token_expires", { withTimezone: true }),
  businessWebsite: text("business_website"),
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
