-- payment_status lifecycle: NULL (included in plan) → 'pending' (approved, awaiting payment)
-- → 'paid' (payment confirmed, fully active) → 'cancelling' (cancel scheduled)
-- → 'cancelled' (deactivated)

ALTER TABLE "properties"
  ADD COLUMN IF NOT EXISTS "payment_status" text,
  ADD COLUMN IF NOT EXISTS "stripe_checkout_session_id" text,
  ADD COLUMN IF NOT EXISTS "stripe_subscription_id" text;
