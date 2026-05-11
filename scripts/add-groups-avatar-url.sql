-- Add avatar_url to groups table for group profile pictures
ALTER TABLE groups ADD COLUMN IF NOT EXISTS avatar_url TEXT;
