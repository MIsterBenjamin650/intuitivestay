-- Add seen_by_owner flag so the notification badge only shows genuinely unread alerts.
-- Existing rows default to false (unseen) — owners will see a one-time spike on deploy,
-- then the count clears once they visit the Alerts page.

ALTER TABLE "feedback"
  ADD COLUMN IF NOT EXISTS "seen_by_owner" boolean NOT NULL DEFAULT false;

-- Index to speed up the "unread alert count" query: property_id + seen_by_owner
CREATE INDEX IF NOT EXISTS feedback_propertyId_seen_idx
  ON "feedback" ("property_id", "seen_by_owner");
