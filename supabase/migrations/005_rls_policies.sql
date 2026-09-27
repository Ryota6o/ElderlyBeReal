-- RLS ポリシー（現状の実装を明文化したもの）
--
-- ⚠ 注意: v0/v1 は認証を持たず、アプリ（app/src/api/client.ts）が anon キーで
--   PostgREST を直接叩く構成のため、anon ロールに全許可を与えている。
--   group_id を知っている相手なら誰でも読み書きできる状態であり、PoC/デモ用途に限る。
--   認証（Supabase Auth）を導入する際は、auth.uid() と users.id を紐づけて
--   「自分の所属する group のみ」に絞り込むポリシーへ必ず見直すこと。

ALTER TABLE "group"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

-- group: createGroup / joinGroup の upsert と、update_life() の SELECT ... FOR UPDATE + UPDATE で使う。
DROP POLICY IF EXISTS "anon full access on group" ON "group";
CREATE POLICY "anon full access on group"
  ON "group" FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- users: ensureGroupAndUser() の upsert と、listPhotos() の role 取得で使う。
DROP POLICY IF EXISTS "anon full access on users" ON users;
CREATE POLICY "anon full access on users"
  ON users FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- photos: uploadPhoto() の insert と listPhotos() の select で使う。
DROP POLICY IF EXISTS "anon full access on photos" ON photos;
CREATE POLICY "anon full access on photos"
  ON photos FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- reactions: createReaction() の insert で使う。
DROP POLICY IF EXISTS "anon full access on reactions" ON reactions;
CREATE POLICY "anon full access on reactions"
  ON reactions FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- update_life() は SECURITY INVOKER のため、呼び出し元(anon)の権限で動く。
-- 上記の group への USING/WITH CHECK が効いている前提。
GRANT EXECUTE ON FUNCTION update_life(UUID, UUID, TEXT) TO anon, authenticated;

-- ロールバック:
--   DROP POLICY IF EXISTS "anon full access on group" ON "group";      -- users / photos / reactions も同様
--   ALTER TABLE "group" DISABLE ROW LEVEL SECURITY;                     -- users / photos / reactions も同様
