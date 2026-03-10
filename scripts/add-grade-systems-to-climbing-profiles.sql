-- Add grade system columns to climbing_profiles table
-- This allows users to specify which grading system they use for each climbing type

ALTER TABLE climbing_profiles
ADD COLUMN IF NOT EXISTS lead_grade_system TEXT CHECK (lead_grade_system IN ('yds', 'french', 'aus')),
ADD COLUMN IF NOT EXISTS top_rope_grade_system TEXT CHECK (top_rope_grade_system IN ('yds', 'french', 'aus')),
ADD COLUMN IF NOT EXISTS boulder_grade_system TEXT CHECK (boulder_grade_system IN ('v_scale', 'font'));

-- Add comments for documentation
COMMENT ON COLUMN climbing_profiles.lead_grade_system IS 'Grading system used for lead climbing: yds (Yosemite Decimal System), french, or aus (Australian)';
COMMENT ON COLUMN climbing_profiles.top_rope_grade_system IS 'Grading system used for top rope: yds (Yosemite Decimal System), french, or aus (Australian)';
COMMENT ON COLUMN climbing_profiles.boulder_grade_system IS 'Grading system used for bouldering: v_scale (V-Scale) or font (Font bouldering scale)';
