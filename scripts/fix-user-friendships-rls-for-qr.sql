-- Fix user_friendships RLS so QR friend scan can insert both rows of a mutual friendship.
-- Current policy only allows INSERT when auth.uid() = user_id, so the second row
-- (user_id: friendId, friend_id: userId) fails. Allow either party to create a row.

DROP POLICY IF EXISTS "Users can create friendships" ON user_friendships;

CREATE POLICY "Users can create friendships"
    ON user_friendships FOR INSERT
    WITH CHECK (
        auth.uid() = user_id OR
        auth.uid() = friend_id
    );
