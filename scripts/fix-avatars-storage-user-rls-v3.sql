-- v3: User avatar RLS using split_part + TO public (avoids storage.foldername quirks).
-- Path must be: {auth.uid()}/avatar.{ext}
-- Run in Supabase SQL editor after previous avatar policies exist.

DROP POLICY IF EXISTS "avatars_user_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_user_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_group_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_group_update" ON storage.objects;

-- TO public: storage requests must still pass WITH CHECK; auth.uid() is set when JWT is present.
CREATE POLICY "avatars_user_insert"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid() IS NOT NULL
  AND split_part(name, '/', 1) = auth.uid()::text
);

CREATE POLICY "avatars_user_update"
ON storage.objects FOR UPDATE
TO public
USING (
  bucket_id = 'avatars'
  AND auth.uid() IS NOT NULL
  AND split_part(name, '/', 1) = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid() IS NOT NULL
  AND split_part(name, '/', 1) = auth.uid()::text
);

CREATE POLICY "avatars_group_insert"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id::text = split_part(name, '/', 1)
      AND user_id = auth.uid()
      AND role = 'admin'
  )
);

CREATE POLICY "avatars_group_update"
ON storage.objects FOR UPDATE
TO public
USING (
  bucket_id = 'avatars'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id::text = split_part(name, '/', 1)
      AND user_id = auth.uid()
      AND role = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id::text = split_part(name, '/', 1)
      AND user_id = auth.uid()
      AND role = 'admin'
  )
);
