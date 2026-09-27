-- v0 スキーマ（.clinerules/02-v0.md 準拠）
-- Supabase (PostgreSQL) 用マイグレーション
-- 実行方法: Supabase ダッシュボードの SQL Editor に貼り付けて実行する（supabase/README.md 参照）。

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "group" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES "group"(id),
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('child', 'uncle')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_group_id ON users(group_id);

CREATE TABLE IF NOT EXISTS photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES "group"(id),
  uploader_id UUID NOT NULL REFERENCES users(id),
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_photos_group_id ON photos(group_id);
CREATE INDEX IF NOT EXISTS idx_photos_uploader_id ON photos(uploader_id);

CREATE TABLE IF NOT EXISTS reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID NOT NULL REFERENCES photos(id),
  reactor_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reactions_photo_id ON reactions(photo_id);
CREATE INDEX IF NOT EXISTS idx_reactions_reactor_id ON reactions(reactor_id);
