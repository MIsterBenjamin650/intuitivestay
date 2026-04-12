-- Remove unique constraint on property_id (allows multiple QR codes per property)
ALTER TABLE qr_codes DROP CONSTRAINT IF EXISTS qr_codes_property_id_unique;

-- Add label column (nullable — existing codes get null = "General" display)
ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS label text;
