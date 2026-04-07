-- Fraud prevention: uniform score flag on feedback
ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "is_uniform_score" boolean DEFAULT false NOT NULL;

-- Fraud prevention: device fingerprint deduplication table
CREATE TABLE IF NOT EXISTS "feedback_fingerprints" (
  "id" text PRIMARY KEY,
  "property_id" text NOT NULL REFERENCES "properties"("id") ON DELETE CASCADE,
  "fingerprint" text NOT NULL,
  "submitted_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "feedback_fingerprints_property_fingerprint_idx"
  ON "feedback_fingerprints" ("property_id", "fingerprint");
