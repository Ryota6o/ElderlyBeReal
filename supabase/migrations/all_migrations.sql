-- ElderBeReal: migrations 001-009 を連結したもの（Supabase SQL Editor 用）
-- 生成元: supabase/migrations/  ※全て冪等なので再実行しても安全
-- 006 / 007 / 008 / 009 の修正を各所に反映済み。新規プロジェクトにはこのファイルを1回貼れば足りる。

-- ===================== 001_init_v0_schema.sql =====================
-- v0 スキーマ（.clinerules/02-v0.md 準拠）
-- Supabase (PostgreSQL) 用マイグレーション
-- 実行方法: Supabase ダッシュボードの SQL Editor に貼り付けて実行する（supabase/README.md 参照）。

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "group" (
  -- 招待コードは任意の文字列（007）。小文字英数字と - _ で3〜64文字。
  -- 上限64は既存の UUID（36文字）を弾かないため。
  id TEXT PRIMARY KEY CHECK (id ~ E'^[a-z0-9_-]{3,64}$'),
  name TEXT,
  -- おじいの名前・年齢（008）。孫が初回に入力し、DEAD 画面の「享年N歳」に使う。
  elder_name TEXT,
  elder_age  INTEGER CHECK (elder_age BETWEEN 0 AND 150),
  -- おじいのアイコン（009）。おじいの参加前にまごが設定するので group に持つ。
  elder_icon_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id TEXT NOT NULL REFERENCES "group"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('child', 'uncle')),
  -- まご自身の年齢とアイコン（009）。名前は name を使う。
  age      INTEGER CHECK (age BETWEEN 0 AND 150),
  icon_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_group_id ON users(group_id);

CREATE TABLE IF NOT EXISTS photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id TEXT NOT NULL REFERENCES "group"(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_photos_group_id ON photos(group_id);
CREATE INDEX IF NOT EXISTS idx_photos_uploader_id ON photos(uploader_id);

CREATE TABLE IF NOT EXISTS reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  reactor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 1写真につき1人1回まで
  CONSTRAINT reactions_unique_pair UNIQUE (photo_id, reactor_id)
);
CREATE INDEX IF NOT EXISTS idx_reactions_photo_id ON reactions(photo_id);
CREATE INDEX IF NOT EXISTS idx_reactions_reactor_id ON reactions(reactor_id);

-- ===================== 002_add_life_to_group.sql =====================
-- v1 寿命ゲージ（既存の group テーブルを利用）
-- デモ設定: 60秒を1日相当、初期値50、上限100、操作ごとに+10

ALTER TABLE "group"
  ADD COLUMN IF NOT EXISTS life_value INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS life_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION update_life(
  target_group_id TEXT,
  actor_user_id UUID DEFAULT NULL,
  action_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  life_value INTEGER,
  life_updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
  current_life INTEGER;
  last_updated TIMESTAMPTZ;
  elapsed_units INTEGER;
  action_bonus INTEGER := 0;
  decay_interval_seconds INTEGER := 60;
  life_max INTEGER := 100;
BEGIN
  -- 表示のみ（action_type IS NULL）の場合も、必ずこのロックを最初に取得する。
  SELECT g.life_value, g.life_updated_at
    INTO current_life, last_updated
    FROM "group" AS g
   WHERE g.id = target_group_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'group not found: %', target_group_id;
  END IF;

  IF action_type IS NOT NULL AND action_type NOT IN ('photo_upload', 'reaction') THEN
    RAISE EXCEPTION 'unsupported action_type: %', action_type;
  END IF;

  -- 経過した「単位」数だけ減衰させる。
  elapsed_units := GREATEST(
    FLOOR(EXTRACT(EPOCH FROM (now() - last_updated)) / decay_interval_seconds),
    0
  );
  current_life := GREATEST(current_life - elapsed_units, 0);

  -- 消費した単位分だけ基準時刻を進める。端数（60秒未満）は次回呼び出しに持ち越す。
  -- ここを now() にすると、短い間隔でポーリングした際に端数が毎回切り捨てられ、
  -- 寿命が永久に減らなくなる。
  last_updated := last_updated
                + (elapsed_units * decay_interval_seconds) * INTERVAL '1 second';

  IF action_type IS NOT NULL THEN
    IF actor_user_id IS NULL THEN
      RAISE EXCEPTION 'actor_user_id is required for action_type: %', action_type;
    END IF;

    -- 孫・おじのどちらも写真送信と Good の両方を行う（008、UI フロー図準拠）。
    -- 役割は問わず、そのグループのメンバーであることだけを確認する。
    IF NOT EXISTS (
      SELECT 1 FROM users
       WHERE id = actor_user_id
         AND group_id = target_group_id
    ) THEN
      RAISE EXCEPTION 'actor is not a member of the target group';
    END IF;

    action_bonus := 10;

    current_life := current_life + action_bonus;
  END IF;

  current_life := LEAST(GREATEST(current_life, 0), life_max);

  UPDATE "group" AS g
     SET life_value = current_life,
         life_updated_at = last_updated
   WHERE g.id = target_group_id;

  RETURN QUERY
  SELECT g.life_value, g.life_updated_at
    FROM "group" AS g
   WHERE g.id = target_group_id;
END;
$$;

-- ===================== 003_add_image_url_to_reactions.sql =====================
-- リアクション撮影画像URL
ALTER TABLE reactions ADD COLUMN IF NOT EXISTS image_url TEXT;

-- ===================== 004_storage_photos_bucket.sql =====================
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

-- ===================== 005_rls_policies.sql =====================
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
GRANT EXECUTE ON FUNCTION update_life(TEXT, UUID, TEXT) TO anon, authenticated;

-- ロールバック:
--   DROP POLICY IF EXISTS "anon full access on group" ON "group";      -- users / photos / reactions も同様
--   ALTER TABLE "group" DISABLE ROW LEVEL SECURITY;                     -- users / photos / reactions も同様

-- ======= 006 / 007 / 008 / 009（既存DB向けの追加適用分） =======
-- 上記 001 / 002 / 005 に反映済みのため、新規プロジェクトではここは何もしない。
-- 既に適用済みの DB には 006 / 007 / 008 / 009 を番号順に別途実行すること。
