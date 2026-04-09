ALTER TABLE "staff_profiles" ADD COLUMN IF NOT EXISTS "activated_at" timestamp;
ALTER TABLE "staff_profiles" ADD COLUMN IF NOT EXISTS "stripe_payment_intent_id" text;
