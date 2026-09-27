-- UI/UX フロー図対応（孫・おじの対称化、おじいの名前・年齢、グループ一覧）
--
-- 1. group に おじいの名前・年齢・作成日時 を追加する
-- 2. update_life() の役割制限を撤廃し、グループのメンバーなら誰でも
--    写真送信・Good の両方でゲージを増やせるようにする
--
-- 冪等。再実行しても安全。

-- ---------------------------------------------------------------------------
-- 1. group の追加列
-- ---------------------------------------------------------------------------
-- elder_name / elder_age は孫が初回に入力する。DEAD 画面の「享年N歳」に使う。
-- created_at はグループ一覧の並び順に使う。
ALTER TABLE "group"
  ADD COLUMN IF NOT EXISTS elder_name TEXT,
  ADD COLUMN IF NOT EXISTS elder_age  INTEGER CHECK (elder_age BETWEEN 0 AND 150),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ---------------------------------------------------------------------------
-- 2. update_life(): 役割によらずメンバーなら加算できるようにする
-- ---------------------------------------------------------------------------
-- 変更点は「actor がそのグループのメンバーか」だけを確認する部分のみ。
-- 減衰ロジックは 006/007 から変えていない。
--
-- 007 より前の all_migrations.sql を再実行すると UUID 版が復活し、TEXT 版と
-- 二重になって PostgREST がどちらも呼べなくなる。念のためここでも落としておく。
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

    -- 孫・おじのどちらも写真送信と Good の両方を行う（UI フロー図準拠）。
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

GRANT EXECUTE ON FUNCTION update_life(TEXT, UUID, TEXT) TO anon, authenticated;

-- ロールバック:
--   ALTER TABLE "group" DROP COLUMN IF EXISTS elder_name, DROP COLUMN IF EXISTS elder_age, DROP COLUMN IF EXISTS created_at;
--   update_life() は 007_group_id_as_text.sql の定義を再実行して役割制限を戻す。
