-- User area follows, visits, and trip plans
-- Run after create-climbing-areas.sql

-- User follows an area (to see feed, etc.)
CREATE TABLE IF NOT EXISTS user_area_follows (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  area_id UUID NOT NULL REFERENCES climbing_areas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, area_id)
);

CREATE INDEX IF NOT EXISTS idx_user_area_follows_area_id ON user_area_follows(area_id);

ALTER TABLE user_area_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own area follows"
  ON user_area_follows FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- User presence at an area (for "who's at the crag" and "just rolled up" notification)
CREATE TABLE IF NOT EXISTS user_area_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  area_id UUID NOT NULL REFERENCES climbing_areas(id) ON DELETE CASCADE,
  first_entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_area_visits_user_area ON user_area_visits(user_id, area_id);
CREATE INDEX IF NOT EXISTS idx_user_area_visits_area_last_seen ON user_area_visits(area_id, last_seen_at DESC);

CREATE TRIGGER update_user_area_visits_updated_at
  BEFORE UPDATE ON user_area_visits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE user_area_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert update delete their own area visits"
  ON user_area_visits FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can view own visits or friends' visits (for "who's at the crag")
CREATE POLICY "Users can view own or friends area visits"
  ON user_area_visits FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM user_friendships uf
      WHERE (uf.user_id = auth.uid() AND uf.friend_id = user_area_visits.user_id)
         OR (uf.friend_id = auth.uid() AND uf.user_id = user_area_visits.user_id)
    )
  );

-- Trip plans (area-centric)
CREATE TABLE IF NOT EXISTS user_area_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  area_id UUID NOT NULL REFERENCES climbing_areas(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_user_area_plans_user ON user_area_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_user_area_plans_area ON user_area_plans(area_id);
CREATE INDEX IF NOT EXISTS idx_user_area_plans_dates ON user_area_plans(area_id, start_date, end_date);

CREATE TRIGGER update_user_area_plans_updated_at
  BEFORE UPDATE ON user_area_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE user_area_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own area plans"
  ON user_area_plans FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Friends can view each other's plans (for overlap)
CREATE POLICY "Users can view friends area plans"
  ON user_area_plans FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM user_friendships uf
      WHERE (uf.user_id = auth.uid() AND uf.friend_id = user_area_plans.user_id)
         OR (uf.friend_id = auth.uid() AND uf.user_id = user_area_plans.user_id)
    )
  );

COMMENT ON TABLE user_area_follows IS 'Users following climbing areas to see feeds';
COMMENT ON TABLE user_area_visits IS 'Presence at climbing areas for geofence and who is at crag';
COMMENT ON TABLE user_area_plans IS 'Trip plans per area for overlap and invitations';
