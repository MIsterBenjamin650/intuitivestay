CREATE TABLE IF NOT EXISTS "dashboard_cache" (
  "id"           text PRIMARY KEY NOT NULL,
  "property_id"  text NOT NULL REFERENCES "properties"("id") ON DELETE CASCADE,
  "days"         integer NOT NULL,
  "stats"        jsonb NOT NULL,
  "gcs_history"  jsonb NOT NULL,
  "word_cloud"   jsonb NOT NULL,
  "staff_bubbles" jsonb NOT NULL,
  "computed_at"  timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dashboard_cache_propertyId_idx ON "dashboard_cache" ("property_id");

ALTER TABLE "dashboard_cache" ENABLE ROW LEVEL SECURITY;
