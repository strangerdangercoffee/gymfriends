-- Trip invitations (invite friends to a trip with optional comment)
-- Run after add-area-follows-visits-plans.sql

CREATE TABLE IF NOT EXISTS trip_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES user_area_plans(id) ON DELETE CASCADE,
  invitee_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  inviter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined')),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(trip_id, invitee_user_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_invitations_trip ON trip_invitations(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_invitations_invitee ON trip_invitations(invitee_user_id);

CREATE TRIGGER update_trip_invitations_updated_at
  BEFORE UPDATE ON trip_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE trip_invitations ENABLE ROW LEVEL SECURITY;

-- Trip creator can do anything on their trip's invitations
CREATE POLICY "Trip creator can manage invitations"
  ON trip_invitations FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_area_plans uap WHERE uap.id = trip_id AND uap.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_area_plans uap WHERE uap.id = trip_id AND uap.user_id = auth.uid())
  );

-- Invitee can view and update (accept/decline) their own invitations
CREATE POLICY "Invitee can view and update own invitations"
  ON trip_invitations FOR SELECT
  USING (invitee_user_id = auth.uid());

CREATE POLICY "Invitee can update own invitation status"
  ON trip_invitations FOR UPDATE
  USING (invitee_user_id = auth.uid())
  WITH CHECK (invitee_user_id = auth.uid());

COMMENT ON TABLE trip_invitations IS 'Invitations to area trips with optional comment (e.g. birthday, target routes)';
COMMENT ON COLUMN trip_invitations.comment IS 'Optional message from inviter e.g. this is for my birthday or target route objectives';
