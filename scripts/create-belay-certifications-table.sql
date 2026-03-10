-- Create Belay Certifications Table
-- This script creates the table for storing per-gym belay certifications

CREATE TABLE IF NOT EXISTS belay_certifications (
  certification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  certification_type TEXT CHECK (certification_type IN ('top_rope', 'lead', 'both')) DEFAULT 'top_rope',
  certified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- NULL if certification doesn't expire
  verified_by_gym BOOLEAN DEFAULT false, -- If gym staff verified it
  
  UNIQUE(user_id, gym_id, certification_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_belay_certifications_user_id ON belay_certifications(user_id);
CREATE INDEX IF NOT EXISTS idx_belay_certifications_gym_id ON belay_certifications(gym_id);
CREATE INDEX IF NOT EXISTS idx_belay_certifications_active ON belay_certifications(user_id, gym_id) 
    WHERE expires_at IS NULL OR expires_at > NOW();

-- RLS Policies
ALTER TABLE belay_certifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own certifications
CREATE POLICY "Users can view their own certifications"
    ON belay_certifications FOR SELECT
    USING (auth.uid() = user_id);

-- Users can view certifications of others (for partner verification)
CREATE POLICY "Users can view all certifications"
    ON belay_certifications FOR SELECT
    TO authenticated
    USING (true);

-- Users can insert/update their own certifications
CREATE POLICY "Users can manage their own certifications"
    ON belay_certifications FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE belay_certifications IS 'Per-gym belay certifications for users';
COMMENT ON COLUMN belay_certifications.verified_by_gym IS 'Whether gym staff has verified this certification';
COMMENT ON COLUMN belay_certifications.expires_at IS 'Certification expiration date, NULL if permanent';
