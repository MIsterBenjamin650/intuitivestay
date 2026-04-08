-- Enable Row Level Security on all public tables.
-- The server connects via the service role which bypasses RLS automatically,
-- so no policies are needed — this simply blocks direct anon/API access.

ALTER TABLE "user"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "account"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "verification"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organisations"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "properties"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "feedback"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "feedback_fingerprints"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "qr_codes"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "property_scores"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "property_tiers"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "property_members"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_daily_summaries"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "online_reviews_cache"   ENABLE ROW LEVEL SECURITY;
