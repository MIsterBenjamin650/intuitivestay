ALTER TABLE "staff_profiles" ADD COLUMN IF NOT EXISTS "email_verification_token_expires_at" timestamp;
