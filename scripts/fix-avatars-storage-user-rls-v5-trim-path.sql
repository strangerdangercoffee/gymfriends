-- v5: Normalize object path — if `name` has a leading slash, split_part(name,'/',1) is '' and RLS fails.
-- Compare first path segment after stripping leading slashes to JWT sub (user id).

DROP POLICY IF EXISTS "avatars_user_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_user_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_group_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_group_update" ON storage.objects;

-- First segment of object key (handles leading "/uuid/avatar.jpg" and "uuid/avatar.jpg")
CREATE POLICY "avatars_user_insert"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'avatars'
  AND split_part(regexp_replace(trim(name), '^/+', ''), '/', 1) IN (auth.uid()::text, auth.jwt() ->> 'sub')
  AND (auth.uid() IS NOT NULL OR (auth.jwt() ->> 'sub') IS NOT NULL)
);

CREATE POLICY "avatars_user_update"
ON storage.objects FOR UPDATE
TO public
USING (
  bucket_id = 'avatars'
  AND split_part(regexp_replace(trim(name), '^/+', ''), '/', 1) IN (auth.uid()::text, auth.jwt() ->> 'sub')
  AND (auth.uid() IS NOT NULL OR (auth.jwt() ->> 'sub') IS NOT NULL)
)
WITH CHECK (
  bucket_id = 'avatars'
  AND split_part(regexp_replace(trim(name), '^/+', ''), '/', 1) IN (auth.uid()::text, auth.jwt() ->> 'sub')
  AND (auth.uid() IS NOT NULL OR (auth.jwt() ->> 'sub') IS NOT NULL)
);

CREATE POLICY "avatars_group_insert"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'avatars'
  AND (auth.uid() IS NOT NULL OR (auth.jwt() ->> 'sub') IS NOT NULL)
  AND EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id::text = split_part(regexp_replace(trim(name), '^/+', ''), '/', 1)
      AND (
        user_id = auth.uid()
        OR user_id::text = (auth.jwt() ->> 'sub')
      )
      AND role = 'admin'
  )
);

CREATE POLICY "avatars_group_update"
ON storage.objects FOR UPDATE
TO public
USING (
  bucket_id = 'avatars'
  AND (auth.uid() IS NOT NULL OR (auth.jwt() ->> 'sub') IS NOT NULL)
  AND EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id::text = split_part(regexp_replace(trim(name), '^/+', ''), '/', 1)
      AND (
        user_id = auth.uid()
        OR user_id::text = (auth.jwt() ->> 'sub')
      )
      AND role = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (auth.uid() IS NOT NULL OR (auth.jwt() ->> 'sub') IS NOT NULL)
  AND EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id::text = split_part(regexp_replace(trim(name), '^/+', ''), '/', 1)
      AND (
        user_id = auth.uid()
        OR user_id::text = (auth.jwt() ->> 'sub')
      )
      AND role = 'admin'
  )
);
