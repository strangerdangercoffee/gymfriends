-- Clean up orphaned group_members entries
-- These are group_members entries that reference groups that no longer exist
-- This can happen if groups are deleted but foreign key constraints don't cascade properly

-- First, check for orphaned entries
SELECT 
    gm.group_member_id,
    gm.group_id,
    gm.user_id,
    gm.role,
    gm.joined_at
FROM group_members gm
LEFT JOIN groups g ON gm.group_id = g.group_id
WHERE g.group_id IS NULL;

-- Delete orphaned entries (uncomment to execute)
-- DELETE FROM group_members
-- WHERE group_id NOT IN (SELECT group_id FROM groups);

-- Note: If you have foreign key constraints with ON DELETE CASCADE,
-- this shouldn't be necessary, but it's good to clean up any existing orphans
