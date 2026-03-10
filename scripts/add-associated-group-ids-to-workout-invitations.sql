-- Add associated_group_ids column to workout_invitations table
-- This stores which groups were notified about the invitation

ALTER TABLE workout_invitations
ADD COLUMN IF NOT EXISTS associated_group_ids UUID[] DEFAULT '{}';

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_workout_invitations_associated_group_ids 
ON workout_invitations USING GIN (associated_group_ids);

-- Add comment
COMMENT ON COLUMN workout_invitations.associated_group_ids IS 
  'Array of group IDs that were notified about this invitation. Empty array means invitation was only sent to individual users.';
