-- Add phone number support to friend_invitations table
-- Make invitee_email optional and add invitee_phone field

-- First, make invitee_email nullable
ALTER TABLE friend_invitations 
  ALTER COLUMN invitee_email DROP NOT NULL;

-- Add invitee_phone column
ALTER TABLE friend_invitations 
  ADD COLUMN invitee_phone TEXT;

-- Add constraint to ensure either email or phone is provided
ALTER TABLE friend_invitations 
  ADD CONSTRAINT check_invitee_contact 
  CHECK (
    (invitee_email IS NOT NULL AND invitee_email != '') OR 
    (invitee_phone IS NOT NULL AND invitee_phone != '')
  );

-- Add index for phone number lookups
CREATE INDEX idx_friend_invitations_invitee_phone ON friend_invitations(invitee_phone);

-- Note: RLS policies for phone-based invitations will be added when users table has a phone column
-- For now, phone invitations can be viewed/managed by the inviter, and will be matched during signup
-- by checking the phone number provided during registration
