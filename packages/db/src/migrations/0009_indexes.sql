-- Performance indexes for scale (targeting 1,000+ properties, high feedback volume)

-- FEEDBACK — most critical table for dashboard queries
-- Composite (property + time) covers the vast majority of dashboard aggregations
CREATE INDEX IF NOT EXISTS feedback_propertyId_submittedAt_idx ON feedback (property_id, submitted_at);
-- Standalone time index for city-wide aggregations (leaderboard)
CREATE INDEX IF NOT EXISTS feedback_submittedAt_idx ON feedback (submitted_at);
-- GCS index for low-score alert queries
CREATE INDEX IF NOT EXISTS feedback_gcs_idx ON feedback (gcs);

-- PROPERTIES — used in leaderboard, admin views, org lookups
CREATE INDEX IF NOT EXISTS properties_organisationId_idx ON properties (organisation_id);
CREATE INDEX IF NOT EXISTS properties_city_idx ON properties (city);
CREATE INDEX IF NOT EXISTS properties_status_idx ON properties (status);
-- Composite — leaderboard always filters city AND status="approved" together
CREATE INDEX IF NOT EXISTS properties_city_status_idx ON properties (city, status);

-- PROPERTY_MEMBERS — staff lookup and user membership queries
CREATE INDEX IF NOT EXISTS property_members_propertyId_idx ON property_members (property_id);
CREATE INDEX IF NOT EXISTS property_members_userId_idx ON property_members (user_id);
