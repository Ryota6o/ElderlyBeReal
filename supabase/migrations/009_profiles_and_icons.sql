-- プロフィール（まごの名前・年齢、まご／おじいのアイコン画像）
--
-- - users.age / users.icon_url : まご自身の年齢とアイコン。名前は既存の users.name を使う。
--   まごの名前・年齢は、そのグループ内では最初に入力したあと変更しない（アプリ側で制御）。
-- - group.elder_icon_url       : おじいのアイコン。おじいの名前・年齢は 008 の elder_name / elder_age。
--   おじいがまだ参加していない段階でまごが設定するため、users ではなく group に持つ。
--
-- アイコン画像は Storage の photos バケット配下 `<group_id>/icons/` に置く（004 のポリシーで読み書き可）。
--
-- 冪等。再実行しても安全。

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS age      INTEGER CHECK (age BETWEEN 0 AND 150),
  ADD COLUMN IF NOT EXISTS icon_url TEXT;

ALTER TABLE "group"
  ADD COLUMN IF NOT EXISTS elder_icon_url TEXT;

-- ロールバック:
--   ALTER TABLE users   DROP COLUMN IF EXISTS age, DROP COLUMN IF EXISTS icon_url;
--   ALTER TABLE "group" DROP COLUMN IF EXISTS elder_icon_url;
