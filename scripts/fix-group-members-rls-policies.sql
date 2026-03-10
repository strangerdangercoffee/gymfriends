-- Fix infinite recursion in groups and group_members RLS policies
-- This script drops and recreates policies to avoid circular dependencies

-- Drop existing problematic policies on groups
DROP POLICY IF EXISTS "Users can view public groups or groups they're in" ON groups;
DROP POLICY IF EXISTS "Group creators and admins can update groups" ON groups;
DROP POLICY IF EXISTS "Users can view public groups or groups they created" ON groups;
DROP POLICY IF EXISTS "Group creators can update groups" ON groups;

-- Drop existing problematic policies on group_members
DROP POLICY IF EXISTS "Users can view members of their groups" ON group_members;
DROP POLICY IF EXISTS "Admins can add members or users can join public groups" ON group_members;
DROP POLICY IF EXISTS "Group admins can update member roles" ON group_members;
DROP POLICY IF EXISTS "Users can leave or admins can remove members" ON group_members;
DROP POLICY IF EXISTS "Creators can add members or users can join public groups" ON group_members;
DROP POLICY IF EXISTS "Group admins can update member roles" ON group_members;
DROP POLICY IF EXISTS "Users can leave or admins can remove members" ON group_members;

-- Recreate GROUPS POLICIES - avoid checking group_members to prevent recursion
-- Users can view public groups or groups they created
CREATE POLICY "Users can view public groups or groups they created"
    ON groups FOR SELECT
    USING (
        privacy = 'public' OR
        creator_user_id = auth.uid()
    );

-- Group creators can update groups
CREATE POLICY "Group creators can update groups"
    ON groups FOR UPDATE
    USING (creator_user_id = auth.uid());

-- Create a function to check if user is a member of a group (bypasses RLS for the check)
-- This avoids recursion issues when checking membership in RLS policies
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

-- Recreate GROUP_MEMBERS SELECT policy - use groups table and function to avoid recursion
-- Users can view members of groups they can access (public groups, groups they're creator of, or groups they're a member of)
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

-- Recreate INSERT policy - allow creators to add anyone, users to join public groups, or users with invitations
CREATE POLICY "Creators can add members, users can join public groups, or users with invitations"
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
            auth.uid() = user_id AND
            EXISTS (
                SELECT 1 FROM group_invitations
                WHERE group_invitations.group_id = group_members.group_id
                AND group_invitations.invited_user_id = auth.uid()
                AND group_invitations.status IN ('pending', 'accepted')
            )
        )
    );

-- Recreate UPDATE policy - check groups table for creator instead of group_members
CREATE POLICY "Group admins can update member roles"
    ON group_members FOR UPDATE
    USING (
        -- User is the creator of the group
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.group_id = group_members.group_id
            AND groups.creator_user_id = auth.uid()
        )
    );

-- Recreate DELETE policy - check groups table for creator
CREATE POLICY "Users can leave or admins can remove members"
    ON group_members FOR DELETE
    USING (
        -- User is deleting their own membership
        auth.uid() = user_id OR
        -- User is the creator of the group
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.group_id = group_members.group_id
            AND groups.creator_user_id = auth.uid()
        )
    );
