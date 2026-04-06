import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core"
import { properties } from "./properties"
import { user } from "./auth"

export const propertyMembers = pgTable(
  "property_members",
  {
    id: text("id").primaryKey(),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    invitedEmail: text("invited_email").notNull(),
    displayName: text("display_name"),
    role: text("role").notNull().default("staff"),
    permissions: jsonb("permissions").notNull().$default(() => ({
      viewFeedback: true,
      viewAnalytics: true,
      viewAiSummary: false,
      viewWordCloud: true,
      viewStaffCloud: false,
      viewAlerts: false,
    })),
    status: text("status").notNull().default("pending"),
    inviteToken: text("invite_token").notNull().unique(),
    inviteExpiresAt: timestamp("invite_expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    acceptedAt: timestamp("accepted_at"),
  },
)
