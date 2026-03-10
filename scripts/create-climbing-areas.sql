-- Climbing Areas (outdoor crag) table for globe/area features
-- Run after update_updated_at_column() exists (e.g. create-groups-and-chat-tables.sql or create-workout-invitation-tables.sql)

CREATE TABLE IF NOT EXISTS climbing_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  geofence_radius_m INTEGER NOT NULL DEFAULT 400,
  region TEXT,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_climbing_areas_slug ON climbing_areas(slug);
CREATE INDEX IF NOT EXISTS idx_climbing_areas_location ON climbing_areas(latitude, longitude);

CREATE TRIGGER update_climbing_areas_updated_at
  BEFORE UPDATE ON climbing_areas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE climbing_areas ENABLE ROW LEVEL SECURITY;

-- Anyone can read climbing areas (curated list)
CREATE POLICY "Anyone can view climbing areas"
  ON climbing_areas FOR SELECT
  USING (true);

-- Only service role / admin can insert/update (curated); no policy for authenticated users
-- If you need app inserts, add: WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE climbing_areas IS 'Curated outdoor climbing areas for feeds, trips, and geofencing';
COMMENT ON COLUMN climbing_areas.geofence_radius_m IS 'Radius in meters for geofence entry/exit';
