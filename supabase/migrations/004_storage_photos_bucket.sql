-- Supabase Storage: 写真保存用バケット `photos`
-- app/src/api/client.ts の PHOTOS_BUCKET と対応する。
-- getPublicUrl() で得たURLを photos.image_url に保存しているため、バケットは public とする。

INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- storage.objects は Supabase 側で既に RLS 有効。anon キーからのアップロード／参照を許可する。
DROP POLICY IF EXISTS "anon can upload photos" ON storage.objects;
CREATE POLICY "anon can upload photos"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'photos');

DROP POLICY IF EXISTS "anyone can read photos" ON storage.objects;
CREATE POLICY "anyone can read photos"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'photos');

-- ロールバック:
--   DROP POLICY IF EXISTS "anon can upload photos" ON storage.objects;
--   DROP POLICY IF EXISTS "anyone can read photos" ON storage.objects;
--   DELETE FROM storage.buckets WHERE id = 'photos';
