-- Fix RLS policy for group_invitations to allow QR code joining
-- Users need to be able to create invitations for themselves when scanning QR codes

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Group creators can create invitations" ON group_invitations;

-- Recreate INSERT policy - allow:
-- 1. Group creators to create invitations for others
-- 2. Users to create invitations for themselves (for QR code joining)
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

-- Note: The second condition allows users to create invitations for themselves
-- when joining via QR code. The inviter_id must be the group creator,
-- and the invited_user_id must be the current authenticated user.
