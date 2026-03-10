-- Fix INSERT policy for group_members to allow users to be added when accepting invitations
-- The trigger inserts into group_members when an invitation is accepted, so we need to allow this

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Creators can add members or users can join public groups" ON group_members;
DROP POLICY IF EXISTS "Group creators can add members (or users can join public groups)" ON group_members;

-- Recreate INSERT policy - allow:
-- 1. Group creators to add anyone
-- 2. Users to join themselves to public groups
-- 3. Users to add themselves when they have an accepted invitation (for QR code joining)
CREATE POLICY "Creators can add members, users can join public groups, or users with accepted invitations"
    ON group_members FOR INSERT
    WITH CHECK (
        (
            -- User is the creator of the group - can add anyone
            EXISTS (
                SELECT 1 FROM groups
                WHERE groups.group_id = group_members.group_id
                AND groups.creator_user_id = auth.uid()
            )
        ) OR
        (
            -- User is joining themselves to a public group
            auth.uid() = user_id AND
            EXISTS (
                SELECT 1 FROM groups
                WHERE groups.group_id = group_members.group_id
                AND groups.privacy = 'public'
            )
        ) OR
        (
            -- User is adding themselves and they have an invitation (pending or accepted)
            -- This allows the trigger to insert when accepting an invitation
            -- We check for any invitation status since the trigger runs during the UPDATE transaction
            auth.uid() = user_id AND
            EXISTS (
                SELECT 1 FROM group_invitations
                WHERE group_invitations.group_id = group_members.group_id
                AND group_invitations.invited_user_id = auth.uid()
                AND group_invitations.status IN ('pending', 'accepted')
            )
        )
    );

-- Note: The third condition allows users to insert themselves into group_members
-- when they have an accepted invitation. This is necessary for the trigger
-- to work when accepting invitations (including QR code scanning).
