-- Create Group Invitations Table
-- This table handles group invitations (separate from direct group_members entries)

-- ============================================================================
-- GROUP INVITATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS group_invitations (
    invitation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
    inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invited_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    
    -- Prevent self-invitation
    CHECK (inviter_id != invited_user_id)
);

-- Create partial unique index to ensure one pending invitation per group-user pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_group_invitations_unique_pending 
ON group_invitations(group_id, invited_user_id) 
WHERE status = 'pending';

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_group_invitations_group_id ON group_invitations(group_id);
CREATE INDEX IF NOT EXISTS idx_group_invitations_inviter_id ON group_invitations(inviter_id);
CREATE INDEX IF NOT EXISTS idx_group_invitations_invited_user_id ON group_invitations(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_group_invitations_status ON group_invitations(status);
CREATE INDEX IF NOT EXISTS idx_group_invitations_created_at ON group_invitations(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE group_invitations ENABLE ROW LEVEL SECURITY;

-- Users can view invitations sent to them or invitations they sent
CREATE POLICY "Users can view their invitations"
    ON group_invitations FOR SELECT
    USING (
        invited_user_id = auth.uid() OR
        inviter_id = auth.uid()
    );

-- Group creators can create invitations, or users can create invitations for themselves (QR code joining)
CREATE POLICY "Group creators or users can create invitations"
    ON group_invitations FOR INSERT
    WITH CHECK (
        (
            -- Group creator creating invitation for someone else
            EXISTS (
                SELECT 1 FROM groups
                WHERE groups.group_id = group_invitations.group_id
                AND groups.creator_user_id = auth.uid()
            ) AND
            auth.uid() = inviter_id
        ) OR
        (
            -- User creating invitation for themselves (QR code joining)
            auth.uid() = invited_user_id AND
            EXISTS (
                SELECT 1 FROM groups
                WHERE groups.group_id = group_invitations.group_id
                AND groups.creator_user_id = group_invitations.inviter_id
            )
        )
    );

-- Invited users can accept/decline invitations
CREATE POLICY "Invited users can respond to invitations"
    ON group_invitations FOR UPDATE
    USING (invited_user_id = auth.uid())
    WITH CHECK (
        invited_user_id = auth.uid() AND
        status IN ('accepted', 'declined')
    );

-- ============================================================================
-- FUNCTION TO AUTO-ADD MEMBER WHEN INVITATION IS ACCEPTED
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_group_invitation_accepted()
RETURNS TRIGGER AS $$
BEGIN
    -- When invitation is accepted, add user to group_members
    IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
        INSERT INTO group_members (group_id, user_id, role)
        VALUES (NEW.group_id, NEW.invited_user_id, 'member')
        ON CONFLICT (group_id, user_id) DO NOTHING;
        
        -- Set responded_at timestamp only if not already set
        -- (allows caller to set responded_at = created_at for immediate acceptance)
        IF NEW.responded_at IS NULL THEN
            NEW.responded_at = NOW();
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-add member on invitation acceptance
CREATE TRIGGER on_group_invitation_accepted
    BEFORE UPDATE ON group_invitations
    FOR EACH ROW
    WHEN (OLD.status = 'pending' AND NEW.status = 'accepted')
    EXECUTE FUNCTION handle_group_invitation_accepted();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE group_invitations IS 'Group invitations sent to users, allowing them to accept or decline membership';
COMMENT ON COLUMN group_invitations.status IS 'Invitation status: pending, accepted, or declined';
COMMENT ON COLUMN group_invitations.responded_at IS 'Timestamp when the invitation was accepted or declined';
