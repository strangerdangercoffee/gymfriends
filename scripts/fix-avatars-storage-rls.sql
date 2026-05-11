-- Fix avatar uploads: use folder-per-owner paths + policies that match Supabase docs.
-- Run in Supabase SQL editor after create-avatars-storage-bucket.sql.
--
-- Client paths (see avatarsApi):
--   User:   {auth.uid()}/avatar.{ext}
--   Group:  {group_id}/avatar.{ext}  (group admin only)

DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Group admins can upload group avatar" ON storage.objects;
DROP POLICY IF EXISTS "Group admins can update group avatar" ON storage.objects;

-- Personal avatars: first path segment must equal the signed-in user id
CREATE POLICY "avatars_user_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "avatars_user_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Group avatars: first path segment is group_id; user must be admin of that group
CREATE POLICY "avatars_group_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id::text = (storage.foldername(name))[1]
      AND user_id = auth.uid()
      AND role = 'admin'
  )
);

CREATE POLICY "avatars_group_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id::text = (storage.foldername(name))[1]
      AND user_id = auth.uid()
      AND role = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'avatars'
  AND EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id::text = (storage.foldername(name))[1]
      AND user_id = auth.uid()
      AND role = 'admin'
  )
);
