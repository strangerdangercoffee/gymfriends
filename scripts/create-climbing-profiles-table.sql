-- Create Climbing Profiles Table
-- This script creates the table for storing user climbing preferences and profiles

CREATE TABLE IF NOT EXISTS climbing_profiles (
  profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  
  -- Lead climbing preferences
  lead_climbing TEXT CHECK (lead_climbing IN ('yes', 'no', 'both')) DEFAULT 'no',
  lead_grade_min TEXT, -- e.g., '5.8', '5.10a'
  lead_grade_max TEXT, -- e.g., '5.11d', '5.12a'
  
  -- Top rope preferences
  top_rope TEXT CHECK (top_rope IN ('yes', 'no', 'both')) DEFAULT 'no',
  top_rope_grade_min TEXT,
  top_rope_grade_max TEXT,
  
  -- Bouldering preferences
  bouldering TEXT CHECK (bouldering IN ('yes', 'no', 'both')) DEFAULT 'no',
  boulder_grade_max TEXT, -- e.g., 'V4', 'V6' (outdoor max)
  
  -- Partner preferences
  open_to_new_partners BOOLEAN DEFAULT false,
  preferred_grade_range_min TEXT, -- Minimum grade willing to climb with
  preferred_grade_range_max TEXT, -- Maximum grade willing to climb with
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_climbing_profiles_user_id ON climbing_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_climbing_profiles_open_to_partners ON climbing_profiles(open_to_new_partners) WHERE open_to_new_partners = true;

-- Trigger for updated_at
CREATE TRIGGER update_climbing_profiles_updated_at
    BEFORE UPDATE ON climbing_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE climbing_profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view their own climbing profile"
    ON climbing_profiles FOR SELECT
    USING (auth.uid() = user_id);

-- Users can view profiles of users open to new partners (for matching)
CREATE POLICY "Users can view profiles open to new partners"
    ON climbing_profiles FOR SELECT
    USING (open_to_new_partners = true);

-- Users can insert/update their own profile
CREATE POLICY "Users can manage their own climbing profile"
    ON climbing_profiles FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE climbing_profiles IS 'User climbing preferences and profile information for partner matching';
COMMENT ON COLUMN climbing_profiles.open_to_new_partners IS 'Whether user is open to climbing with new partners';
COMMENT ON COLUMN climbing_profiles.preferred_grade_range_min IS 'Minimum grade user is willing to climb with partners';
COMMENT ON COLUMN climbing_profiles.preferred_grade_range_max IS 'Maximum grade user is willing to climb with partners';
