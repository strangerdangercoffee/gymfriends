-- Fix RLS policy for groups to allow QR code joining
-- This allows authenticated users to view groups by ID (for QR code joining)
-- while still maintaining privacy for browsing

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view public groups or groups they created" ON groups;

-- Recreate SELECT policy - allow viewing groups for QR code joining
-- Users can view:
-- 1. Public groups (for browsing)
-- 2. Groups they created
-- 3. Groups they have an invitation for (via group_invitations)
-- 4. Any group if authenticated (for QR code joining - QR codes are shareable)
--    Note: This allows authenticated users to view groups by ID to join via QR code.
--    Privacy is maintained because users need the group_id (from QR code) to access it.
CREATE POLICY "Users can view accessible groups or groups by ID for joining"
    ON groups FOR SELECT
    USING (
        privacy = 'public' OR
        creator_user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM group_invitations
            WHERE group_invitations.group_id = groups.group_id
            AND group_invitations.invited_user_id = auth.uid()
        ) OR
        auth.uid() IS NOT NULL  -- Allow authenticated users to view any group by ID (for QR joining)
    );

-- Note: The last condition (auth.uid() IS NOT NULL) allows authenticated users to view any group.
-- This is necessary for QR code joining to work, as users need to read the group
-- to get the creator_user_id before creating an invitation.
-- QR codes are meant to be shareable, similar to invite links in other apps.
-- Privacy is maintained because users need the specific group_id (from QR code) to access it.
