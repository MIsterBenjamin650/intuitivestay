CREATE TABLE IF NOT EXISTS "staff_commendations" (
  "id" text PRIMARY KEY,
  "staff_profile_id" text NOT NULL REFERENCES "staff_profiles"("id") ON DELETE CASCADE,
  "property_id" text NOT NULL REFERENCES "properties"("id") ON DELETE CASCADE,
  "author_name" text NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "staff_commendations_staff_profile_id_idx" ON "staff_commendations" ("staff_profile_id");
