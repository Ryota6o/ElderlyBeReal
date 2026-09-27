-- 001〜005 適用済みの DB に対する修正（新規プロジェクトは all_migrations.sql に反映済み）
--
-- 1. 外部キーに ON DELETE CASCADE を付与し、孤児レコードが残らないようにする
-- 2. reactions に UNIQUE (photo_id, reactor_id) を追加し、1写真1人1回に制限する
-- 3. update_life() の減衰基準時刻の扱いを修正する
--
-- 全て冪等。再実行しても安全。

-- ---------------------------------------------------------------------------
-- 1. 外部キーを ON DELETE CASCADE に張り替える
-- ---------------------------------------------------------------------------
-- 001 は インライン REFERENCES で定義しているため、制約名は PostgreSQL 既定の
-- `<table>_<column>_fkey` になる。名前を変えて作成した DB では下記が空振りし、
-- 同じ列に2本目の外部キーが増えるので、その場合は既存の制約名を確認すること。

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_group_id_fkey;
ALTER TABLE users
  ADD CONSTRAINT users_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES "group"(id) ON DELETE CASCADE;

ALTER TABLE photos DROP CONSTRAINT IF EXISTS photos_group_id_fkey;
ALTER TABLE photos
  ADD CONSTRAINT photos_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES "group"(id) ON DELETE CASCADE;

ALTER TABLE photos DROP CONSTRAINT IF EXISTS photos_uploader_id_fkey;
ALTER TABLE photos
  ADD CONSTRAINT photos_uploader_id_fkey
  FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE reactions DROP CONSTRAINT IF EXISTS reactions_photo_id_fkey;
ALTER TABLE reactions
  ADD CONSTRAINT reactions_photo_id_fkey
  FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE;

ALTER TABLE reactions DROP CONSTRAINT IF EXISTS reactions_reactor_id_fkey;
ALTER TABLE reactions
  ADD CONSTRAINT reactions_reactor_id_fkey
  FOREIGN KEY (reactor_id) REFERENCES users(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- 2. 1写真につき1人1回まで
-- ---------------------------------------------------------------------------
-- 既に重複行がある DB では ADD CONSTRAINT が 23505 で失敗する。その場合は
-- 下記で古い方を残して重複を削除してから再実行すること（データが消えるので、
-- 意図を確認したうえで手動で実行する）。
--
--   DELETE FROM reactions r USING reactions keep
--    WHERE r.photo_id = keep.photo_id
--      AND r.reactor_id = keep.reactor_id
--      AND r.created_at > keep.created_at;

ALTER TABLE reactions DROP CONSTRAINT IF EXISTS reactions_unique_pair;
ALTER TABLE reactions
  ADD CONSTRAINT reactions_unique_pair UNIQUE (photo_id, reactor_id);

-- ---------------------------------------------------------------------------
-- 3. update_life(): 減衰の端数を切り捨てないようにする
-- ---------------------------------------------------------------------------
-- 修正前は基準時刻を無条件で now() に更新していたため、decay_interval_seconds
-- (60秒) より短い間隔で呼ぶたびに経過分が切り捨てられ、画面を開いている限り
-- 寿命が永久に減らなかった。消費した単位分だけ基準時刻を進めるよう変更する。

CREATE OR REPLACE FUNCTION update_life(
  target_group_id UUID,
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
  last_updated := last_updated
                + (elapsed_units * decay_interval_seconds) * INTERVAL '1 second';

  IF action_type IS NOT NULL THEN
    IF actor_user_id IS NULL THEN
      RAISE EXCEPTION 'actor_user_id is required for action_type: %', action_type;
    END IF;

    IF action_type = 'photo_upload' THEN
      IF NOT EXISTS (
        SELECT 1 FROM users
         WHERE id = actor_user_id
           AND group_id = target_group_id
           AND role = 'child'
      ) THEN
        RAISE EXCEPTION 'photo_upload requires a child in the target group';
      END IF;
      action_bonus := 10;
    ELSIF action_type = 'reaction' THEN
      IF NOT EXISTS (
        SELECT 1 FROM users
         WHERE id = actor_user_id
           AND group_id = target_group_id
           AND role = 'uncle'
      ) THEN
        RAISE EXCEPTION 'reaction requires an uncle in the target group';
      END IF;
      action_bonus := 10;
    END IF;

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

-- ロールバック:
--   ALTER TABLE reactions DROP CONSTRAINT IF EXISTS reactions_unique_pair;
--   外部キーは DROP CONSTRAINT 後に ON DELETE CASCADE なしで再作成する。
--   update_life() は 002_add_life_to_group.sql の定義を再実行して戻す。
