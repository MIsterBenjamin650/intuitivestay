-- 0013_service_signature_foundation.sql
--
-- Service Signature Phase 1.
-- Adds staff self-registration infrastructure.
-- Phase 2 will link feedback rows to staff profiles.
-- Phase 3 adds the shareable passport and Stripe payment.

-- staff_profiles: one row per staff member per property.
CREATE TABLE IF NOT EXISTS "staff_profiles" (
  "id"          text PRIMARY KEY NOT NULL,
  "name"        text NOT NULL,
  "email"       text NOT NULL,
  "property_id" text NOT NULL
    REFERENCES "properties"("id") ON DELETE CASCADE,
  "created_at"  timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "staff_profiles_property_email_unique"
    UNIQUE ("property_id", "email")
);

CREATE INDEX IF NOT EXISTS "staff_profiles_property_id_idx"
  ON "staff_profiles" ("property_id");

-- Each property gets one active staff invite token.
-- Owners generate it; staff visit /staff-join/{token} to self-register.
ALTER TABLE "properties"
  ADD COLUMN IF NOT EXISTS "staff_invite_token" text UNIQUE;

-- Nullable FK from feedback to the staff member a guest nominated.
-- Always NULL until Phase 2 is deployed.
ALTER TABLE "feedback"
  ADD COLUMN IF NOT EXISTS "staff_profile_id" text
    REFERENCES "staff_profiles"("id") ON DELETE SET NULL;

ALTER TABLE "staff_profiles" ENABLE ROW LEVEL SECURITY;
