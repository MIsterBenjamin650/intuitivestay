import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const leaderboardCache = pgTable("leaderboard_cache", {
  city:     text("city").primaryKey(),
  data:     jsonb("data").notNull(),  // serialised rows + cityAvg
  cachedAt: timestamp("cached_at").defaultNow().notNull(),
})
