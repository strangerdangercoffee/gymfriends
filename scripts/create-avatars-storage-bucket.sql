-- Create avatars storage bucket and RLS policies
-- Run in Supabase SQL editor. If the bucket already exists (e.g. created via Dashboard), skip the INSERT.

-- Create public bucket for user and group avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: Allow authenticated users to upload/update their own user avatar
-- Path: users/{auth.uid()}.{ext}
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND name LIKE 'users/' || auth.uid()::text || '.%'
);

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND name LIKE 'users/' || auth.uid()::text || '.%'
);

-- RLS: Allow group admins to upload/update their group's avatar
-- Path: groups/{group_id}.{ext}
CREATE POLICY "Group admins can upload group avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND name LIKE 'groups/%'
  AND EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id::text = split_part((string_to_array(name, '/'))[2], '.', 1)
      AND user_id = auth.uid()
      AND role = 'admin'
  )
);

CREATE POLICY "Group admins can update group avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND name LIKE 'groups/%'
  AND EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id::text = split_part((string_to_array(name, '/'))[2], '.', 1)
      AND user_id = auth.uid()
      AND role = 'admin'
  )
);

-- Public read is implied by public bucket; no SELECT policy required for public buckets.
