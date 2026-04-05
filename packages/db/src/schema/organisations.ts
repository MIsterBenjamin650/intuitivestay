import { relations } from "drizzle-orm";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const organisations = pgTable("organisations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan").notNull().default("host"), // 'host' | 'partner' | 'founder'
  ownerId: text("owner_id").references(() => user.id, { onDelete: "set null" }), // nullable: null means owner account was deleted
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const organisationsRelations = relations(organisations, ({ one }) => ({
  owner: one(user, {
    fields: [organisations.ownerId],
    references: [user.id],
  }),
}));
