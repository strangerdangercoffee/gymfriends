# Avatar uploads (Edge Functions)

Profile and group avatars are uploaded via Edge Functions using the **service role**, so uploads are not blocked by Storage RLS on the client.

## Deploy

From the project root (with Supabase CLI linked to your project):

```bash
supabase functions deploy upload-avatar
supabase functions deploy upload-group-avatar
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically in hosted Supabase.

## Buckets

The `avatars` bucket must exist (public read is fine). No client-side Storage policies are required for these uploads.

## Why not direct `storage.upload` from the app?

The client flow (`supabase.storage.from('avatars').upload(...)`) is correct, but **Storage RLS** on some projects still rejects inserts even when policies look right. Server-side upload avoids that.

Also, `supabase.functions.invoke` with **binary body + custom `Content-Type` header** omits the request body (Supabase JS quirk). This app sends **JSON `{ imageBase64, contentType }`** instead.

On React Native, **`Blob.arrayBuffer()` is often missing**; the app reads the picked `file://` URI with **`expo-file-system/legacy`** `readAsStringAsync(..., { encoding: Base64 })`.
