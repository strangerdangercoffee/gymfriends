-- Fix RLS SELECT policy for group_members to allow all members to see all other members
-- Currently only admins can see the correct member count because the policy only allows
-- users to see their own membership record, not other members' records.

-- Create a function to check if user is a member of a group (bypasses RLS for the check)
CREATE OR REPLACE FUNCTION is_user_group_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = p_group_id
        AND user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view members of their groups" ON group_members;

-- Recreate SELECT policy - allow members to see all members of groups they belong to
CREATE POLICY "Users can view members of their groups"
    ON group_members FOR SELECT
    USING (
        -- User is the creator of the group (via groups table)
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.group_id = group_members.group_id
            AND groups.creator_user_id = auth.uid()
        ) OR
        -- Group is public
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.group_id = group_members.group_id
            AND groups.privacy = 'public'
        ) OR
        -- User is a member of this group (use function to avoid recursion)
        -- This allows all members to see all other members of the same group
        is_user_group_member(group_members.group_id, auth.uid())
    );

-- Note: This policy allows any member of a group to see all other members of that group.
-- The member count query will now work correctly for all users, not just admins.
