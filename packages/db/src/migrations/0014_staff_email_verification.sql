ALTER TABLE "staff_profiles" ADD COLUMN IF NOT EXISTS "email_verification_token" text;
ALTER TABLE "staff_profiles" ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp;
ALTER TABLE "staff_profiles" ADD CONSTRAINT IF NOT EXISTS "staff_profiles_verification_token_unique" UNIQUE ("email_verification_token");
