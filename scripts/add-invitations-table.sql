-- Add friend_invitations table to support friend invitations
CREATE TABLE friend_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inviter_id UUID REFERENCES users(id) ON DELETE CASCADE,
  inviter_name TEXT NOT NULL,
  inviter_email TEXT NOT NULL,
  invitee_email TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'accepted', 'declined', 'expired')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE
);

-- Add indexes for better performance
CREATE INDEX idx_friend_invitations_inviter_id ON friend_invitations(inviter_id);
CREATE INDEX idx_friend_invitations_invitee_email ON friend_invitations(invitee_email);
CREATE INDEX idx_friend_invitations_status ON friend_invitations(status);
CREATE INDEX idx_friend_invitations_expires_at ON friend_invitations(expires_at);

-- Add RLS policies
ALTER TABLE friend_invitations ENABLE ROW LEVEL SECURITY;

-- Users can view invitations they sent
CREATE POLICY "Users can view sent invitations" ON friend_invitations 
  FOR SELECT USING (auth.uid() = inviter_id);

-- Users can view invitations sent to their email
CREATE POLICY "Users can view received invitations" ON friend_invitations 
  FOR SELECT USING (invitee_email = (SELECT email FROM users WHERE id = auth.uid()));

-- Users can create invitations
CREATE POLICY "Users can create invitations" ON friend_invitations 
  FOR INSERT WITH CHECK (auth.uid() = inviter_id);

-- Users can update invitations they sent (cancel) or received (accept/decline)
CREATE POLICY "Users can update their invitations" ON friend_invitations 
  FOR UPDATE USING (
    auth.uid() = inviter_id OR 
    invitee_email = (SELECT email FROM users WHERE id = auth.uid())
  );

-- Enable real-time for invitations
ALTER PUBLICATION supabase_realtime ADD TABLE friend_invitations;

-- Create a function to automatically clean up expired invitations
CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS void AS $$
BEGIN
  UPDATE friend_invitations 
  SET status = 'expired' 
  WHERE status = 'pending' 
  AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run cleanup daily (requires pg_cron extension)
-- This is optional and can be set up in Supabase dashboard
-- SELECT cron.schedule('cleanup-expired-invitations', '0 0 * * *', 'SELECT cleanup_expired_invitations();');

