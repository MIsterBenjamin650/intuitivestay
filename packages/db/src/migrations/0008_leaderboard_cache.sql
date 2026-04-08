CREATE TABLE IF NOT EXISTS "leaderboard_cache" (
  "city"      text PRIMARY KEY NOT NULL,
  "data"      jsonb NOT NULL,
  "cached_at" timestamp NOT NULL DEFAULT now()
);

ALTER TABLE "leaderboard_cache" ENABLE ROW LEVEL SECURITY;
