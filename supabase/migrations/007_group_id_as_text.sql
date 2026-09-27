-- 招待コードを任意の文字列にする（UUID の手入力が現実的でないため）
--
-- group.id とそれを参照する列を UUID から TEXT に変更する。
-- 既存の UUID 文字列はそのまま値として保持されるので、稼働中のグループは
-- 引き続き同じ ID で使える。
--
-- 冪等。再実行しても安全。

-- ---------------------------------------------------------------------------
-- 1. 外部キーを一旦外す（参照先の型を変えるため）
-- ---------------------------------------------------------------------------
ALTER TABLE users  DROP CONSTRAINT IF EXISTS users_group_id_fkey;
ALTER TABLE photos DROP CONSTRAINT IF EXISTS photos_group_id_fkey;

-- ---------------------------------------------------------------------------
-- 2. UUID -> TEXT
-- ---------------------------------------------------------------------------
-- gen_random_uuid() の DEFAULT は不要になる。ID はアプリが明示的に指定する。
ALTER TABLE "group"  ALTER COLUMN id DROP DEFAULT;
ALTER TABLE "group"  ALTER COLUMN id       TYPE TEXT USING id::text;
ALTER TABLE users    ALTER COLUMN group_id TYPE TEXT USING group_id::text;
ALTER TABLE photos   ALTER COLUMN group_id TYPE TEXT USING group_id::text;

-- 招待コードの形式を DB 側でも縛る。小文字英数字と `-` `_` のみ、3〜64文字。
-- 上限を 64 にしているのは、既存の UUID（36文字）を弾かないため。
ALTER TABLE "group" DROP CONSTRAINT IF EXISTS group_id_format;
ALTER TABLE "group"
  ADD CONSTRAINT group_id_format CHECK (id ~ '^[a-z0-9_-]{3,64}$');

-- ---------------------------------------------------------------------------
-- 3. 外部キーを張り直す（006 と同じく ON DELETE CASCADE）
-- ---------------------------------------------------------------------------
ALTER TABLE users
  ADD CONSTRAINT users_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES "group"(id) ON DELETE CASCADE;

ALTER TABLE photos
  ADD CONSTRAINT photos_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES "group"(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- 4. update_life() の第1引数を TEXT にする
-- ---------------------------------------------------------------------------
-- 引数の型が変わるので CREATE OR REPLACE では差し替えられない。旧シグネチャを
-- 明示的に落としてから作り直す。関数本体は 006 から変更していない。
DROP FUNCTION IF EXISTS update_life(UUID, UUID, TEXT);

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

GRANT EXECUTE ON FUNCTION update_life(TEXT, UUID, TEXT) TO anon, authenticated;

-- ロールバック:
--   TEXT に変えた後で UUID 形式でない ID が登録されていると UUID へは戻せない。
--   戻す場合は該当行を削除してから、005 までの定義を再適用すること。
