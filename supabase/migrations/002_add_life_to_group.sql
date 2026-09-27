-- v1 寿命ゲージ（既存の group テーブルを利用）
-- デモ設定: 60秒を1日相当、初期値50、上限100、操作ごとに+10

ALTER TABLE "group"
  ADD COLUMN IF NOT EXISTS life_value INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS life_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

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

  elapsed_units := FLOOR(
    EXTRACT(EPOCH FROM (now() - last_updated)) / decay_interval_seconds
  );
  current_life := GREATEST(current_life - GREATEST(elapsed_units, 0), 0);

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
         life_updated_at = now()
   WHERE g.id = target_group_id;

  RETURN QUERY
  SELECT g.life_value, g.life_updated_at
    FROM "group" AS g
   WHERE g.id = target_group_id;
END;
$$;
