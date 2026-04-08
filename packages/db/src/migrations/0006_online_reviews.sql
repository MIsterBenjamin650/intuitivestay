ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "tripadvisor_url" text;
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "google_place_id" text;

CREATE TABLE IF NOT EXISTS "online_reviews_cache" (
  "id" text PRIMARY KEY NOT NULL,
  "property_id" text NOT NULL REFERENCES "properties"("id") ON DELETE CASCADE,
  "source" text NOT NULL,
  "avg_rating" numeric(3,1),
  "review_count" integer NOT NULL DEFAULT 0,
  "pillar_resilience" numeric(4,2),
  "pillar_empathy" numeric(4,2),
  "pillar_anticipation" numeric(4,2),
  "pillar_recognition" numeric(4,2),
  "last_scraped_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "online_reviews_cache_property_source_idx"
  ON "online_reviews_cache" ("property_id", "source");
