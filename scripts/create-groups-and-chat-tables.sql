-- Create Groups and Group Chat Tables
-- This script creates tables for group functionality and group chat messaging
-- Run this script in your Supabase SQL editor

-- ============================================================================
-- GROUPS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS groups (
    group_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    creator_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    privacy TEXT NOT NULL CHECK (privacy IN ('public', 'private', 'invite-only')) DEFAULT 'private',
    
    -- Associated location - supports gym, city, or crag
    -- Using optional foreign key for gym, and text fields for city/crag
    associated_gym_id UUID REFERENCES gyms(id) ON DELETE SET NULL,
    associated_city TEXT,  -- City name (e.g., "San Francisco, CA")
    associated_crag TEXT,  -- Climbing crag name (e.g., "Yosemite Valley")
    location_type TEXT CHECK (location_type IN ('gym', 'city', 'crag')) DEFAULT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure at least one location type is specified if location is provided
    CHECK (
        (associated_gym_id IS NULL AND associated_city IS NULL AND associated_crag IS NULL) OR
        (associated_gym_id IS NOT NULL AND location_type = 'gym') OR
        (associated_city IS NOT NULL AND location_type = 'city') OR
        (associated_crag IS NOT NULL AND location_type = 'crag')
    )
);

-- ============================================================================
-- GROUP MEMBERS TABLE (Many-to-Many: Users ↔ Groups)
-- ============================================================================
CREATE TABLE IF NOT EXISTS group_members (
    group_member_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'moderator', 'member')) DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure one membership per user-group pair
    UNIQUE(group_id, user_id)
);

-- ============================================================================
-- GROUP CHATS TABLE (1:1 with Groups)
-- ============================================================================
CREATE TABLE IF NOT EXISTS group_chats (
    chat_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL UNIQUE REFERENCES groups(group_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Optional chat settings can be added here in the future
    -- e.g., mute_until, pinned_message_id, etc.
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- CHAT MESSAGES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS chat_messages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES group_chats(chat_id) ON DELETE CASCADE,
    sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_text TEXT NOT NULL,
    message_type TEXT NOT NULL CHECK (message_type IN ('text', 'image', 'workout-share', 'system')) DEFAULT 'text',
    
    -- JSON metadata for workout links, images, system messages, etc.
    -- Examples:
    -- For workout-share: {"workout_id": "uuid", "workout_title": "Leg Day"}
    -- For image: {"image_url": "https://...", "thumbnail_url": "https://..."}
    -- For system: {"action": "member_joined", "user_id": "uuid"}
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    edited_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,  -- Soft delete support
    
    -- Ensure message_text is not empty for non-system messages
    CHECK (
        message_type = 'system' OR 
        (message_text IS NOT NULL AND length(trim(message_text)) > 0)
    )
);

-- ============================================================================
-- CHAT MESSAGE READS TABLE (Read Receipt Tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS chat_message_reads (
    read_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES chat_messages(message_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure one read record per user-message pair
    UNIQUE(message_id, user_id)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Groups indexes
CREATE INDEX IF NOT EXISTS idx_groups_creator_user_id ON groups(creator_user_id);
CREATE INDEX IF NOT EXISTS idx_groups_associated_gym_id ON groups(associated_gym_id);
CREATE INDEX IF NOT EXISTS idx_groups_privacy ON groups(privacy);
CREATE INDEX IF NOT EXISTS idx_groups_location_type ON groups(location_type);
CREATE INDEX IF NOT EXISTS idx_groups_created_at ON groups(created_at DESC);

-- Group members indexes
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_role ON group_members(role);
CREATE INDEX IF NOT EXISTS idx_group_members_joined_at ON group_members(joined_at DESC);

-- Group chats indexes (already has unique index on group_id, but adding for clarity)
CREATE INDEX IF NOT EXISTS idx_group_chats_group_id ON group_chats(group_id);

-- Chat messages indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_user_id ON chat_messages(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_message_type ON chat_messages(message_type);
-- Index for active (non-deleted) messages only
CREATE INDEX IF NOT EXISTS idx_chat_messages_active ON chat_messages(chat_id, created_at DESC) 
    WHERE deleted_at IS NULL;

-- Chat message reads indexes
CREATE INDEX IF NOT EXISTS idx_chat_message_reads_message_id ON chat_message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_message_reads_user_id ON chat_message_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_message_reads_read_at ON chat_message_reads(read_at DESC);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_groups_updated_at
    BEFORE UPDATE ON groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_group_chats_updated_at
    BEFORE UPDATE ON group_chats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_message_reads ENABLE ROW LEVEL SECURITY;

-- GROUPS POLICIES
-- Users can view public groups or groups they created (avoid checking group_members to prevent recursion)
CREATE POLICY "Users can view public groups or groups they created"
    ON groups FOR SELECT
    USING (
        privacy = 'public' OR
        creator_user_id = auth.uid()
    );

-- Users can create groups
CREATE POLICY "Users can create groups"
    ON groups FOR INSERT
    WITH CHECK (auth.uid() = creator_user_id);

-- Group creators can update groups (avoid checking group_members to prevent recursion)
CREATE POLICY "Group creators can update groups"
    ON groups FOR UPDATE
    USING (creator_user_id = auth.uid());

-- GROUP MEMBERS POLICIES
-- Users can view members of groups they can access (public groups or groups they're creator of)
CREATE POLICY "Users can view members of their groups"
    ON group_members FOR SELECT
    USING (
        -- User is the creator of the group (via groups table - avoids recursion)
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
        -- User is viewing their own membership (safe, no recursion)
        auth.uid() = group_members.user_id
    );

-- Group creators can add members (or users can join public groups or accept invitations)
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

-- Group creators can update member roles
CREATE POLICY "Group creators can update member roles"
    ON group_members FOR UPDATE
    USING (
        -- User is the creator of the group (via groups table - avoids recursion)
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.group_id = group_members.group_id
            AND groups.creator_user_id = auth.uid()
        )
    );

-- Users can leave groups, creators can remove members
CREATE POLICY "Users can leave or creators can remove members"
    ON group_members FOR DELETE
    USING (
        -- User is deleting their own membership
        auth.uid() = user_id OR
        -- User is the creator of the group (via groups table - avoids recursion)
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.group_id = group_members.group_id
            AND groups.creator_user_id = auth.uid()
        )
    );

-- GROUP CHATS POLICIES
-- Users can view chats for groups they belong to
CREATE POLICY "Users can view chats of their groups"
    ON group_chats FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM group_members
            WHERE group_members.group_id = group_chats.group_id
            AND group_members.user_id = auth.uid()
        )
    );

-- Group admins can create chats (should only happen when group is created)
CREATE POLICY "Group creators can create chats"
    ON group_chats FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.group_id = group_chats.group_id
            AND groups.creator_user_id = auth.uid()
        )
    );

-- CHAT MESSAGES POLICIES
-- Users can view messages in groups they belong to
CREATE POLICY "Users can view messages in their groups"
    ON chat_messages FOR SELECT
    USING (
        deleted_at IS NULL AND
        EXISTS (
            SELECT 1 FROM group_chats gc
            JOIN group_members gm ON gm.group_id = gc.group_id
            WHERE gc.chat_id = chat_messages.chat_id
            AND gm.user_id = auth.uid()
        )
    );

-- Users can send messages in groups they belong to
CREATE POLICY "Users can send messages in their groups"
    ON chat_messages FOR INSERT
    WITH CHECK (
        auth.uid() = sender_user_id AND
        EXISTS (
            SELECT 1 FROM group_chats gc
            JOIN group_members gm ON gm.group_id = gc.group_id
            WHERE gc.chat_id = chat_messages.chat_id
            AND gm.user_id = auth.uid()
        )
    );

-- Users can edit their own messages (within a time limit - enforced by app logic)
CREATE POLICY "Users can edit their own messages"
    ON chat_messages FOR UPDATE
    USING (auth.uid() = sender_user_id)
    WITH CHECK (auth.uid() = sender_user_id);

-- Users can soft-delete their own messages, admins can delete any
CREATE POLICY "Users can delete their messages or admins can delete any"
    ON chat_messages FOR UPDATE
    USING (
        (auth.uid() = sender_user_id) OR
        EXISTS (
            SELECT 1 FROM group_chats gc
            JOIN group_members gm ON gm.group_id = gc.group_id
            WHERE gc.chat_id = chat_messages.chat_id
            AND gm.user_id = auth.uid()
            AND gm.role IN ('admin', 'moderator')
        )
    )
    WITH CHECK (deleted_at IS NOT NULL);

-- CHAT MESSAGE READS POLICIES
-- Users can view read receipts for messages in their groups
CREATE POLICY "Users can view read receipts in their groups"
    ON chat_message_reads FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM chat_messages cm
            JOIN group_chats gc ON gc.chat_id = cm.chat_id
            JOIN group_members gm ON gm.group_id = gc.group_id
            WHERE cm.message_id = chat_message_reads.message_id
            AND gm.user_id = auth.uid()
        )
    );

-- Users can mark messages as read in groups they belong to
CREATE POLICY "Users can mark messages as read"
    ON chat_message_reads FOR INSERT
    WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM chat_messages cm
            JOIN group_chats gc ON gc.chat_id = cm.chat_id
            JOIN group_members gm ON gm.group_id = gc.group_id
            WHERE cm.message_id = chat_message_reads.message_id
            AND gm.user_id = auth.uid()
        )
    );

-- Users can update their own read receipts
CREATE POLICY "Users can update their read receipts"
    ON chat_message_reads FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- ENABLE REALTIME (Optional - for real-time chat updates)
-- ============================================================================

-- Uncomment these lines if you want real-time subscriptions for chat
-- ALTER PUBLICATION supabase_realtime ADD TABLE group_chats;
-- ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE chat_message_reads;
-- ALTER PUBLICATION supabase_realtime ADD TABLE group_members;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE groups IS 'Groups that users can join, associated with gyms, cities, or climbing crags';
COMMENT ON TABLE group_members IS 'Many-to-many relationship between users and groups with role-based access';
COMMENT ON TABLE group_chats IS 'Chat rooms for groups (1:1 with groups)';
COMMENT ON TABLE chat_messages IS 'Messages in group chats with support for text, images, workout shares, and system messages';
COMMENT ON TABLE chat_message_reads IS 'Read receipts tracking which users have read which messages';

COMMENT ON COLUMN groups.location_type IS 'Type of associated location: gym, city, or crag';
COMMENT ON COLUMN groups.associated_gym_id IS 'Foreign key to gyms table if location_type is gym';
COMMENT ON COLUMN groups.associated_city IS 'City name if location_type is city';
COMMENT ON COLUMN groups.associated_crag IS 'Climbing crag name if location_type is crag';

COMMENT ON COLUMN group_members.role IS 'User role in group: admin, moderator, or member';
COMMENT ON COLUMN chat_messages.message_type IS 'Type of message: text, image, workout-share, or system';
COMMENT ON COLUMN chat_messages.metadata IS 'JSON metadata for workout links, images, system actions, etc.';
COMMENT ON COLUMN chat_messages.deleted_at IS 'Soft delete timestamp - NULL means message is active';
