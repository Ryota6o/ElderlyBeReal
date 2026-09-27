-- リアクション撮影画像URL
ALTER TABLE reactions ADD COLUMN IF NOT EXISTS image_url TEXT;
