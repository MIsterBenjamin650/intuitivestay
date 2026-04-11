import { relations } from "drizzle-orm"
import { pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { user } from "./auth"

export const organisations = pgTable("organisations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan").notNull().default("member"), // 'member' | 'host' | 'partner' | 'founder'
  subscriptionStatus: text("subscription_status").notNull().default("none"), // 'none' | 'trial' | 'active' | 'grace' | 'expired'
  trialEndsAt: timestamp("trial_ends_at"),
  subscriptionEndsAt: timestamp("subscription_ends_at"),
  stripeCustomerId: text("stripe_customer_id"),
  ownerId: text("owner_id").references(() => user.id, { onDelete: "set null" }),
  onboardingCompletedAt: timestamp("onboarding_completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

export const organisationsRelations = relations(organisations, ({ one }) => ({
  owner: one(user, {
    fields: [organisations.ownerId],
    references: [user.id],
  }),
}))
