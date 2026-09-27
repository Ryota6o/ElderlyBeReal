---
name: supabase-schema-migration
description: Define or modify the Supabase (PostgreSQL) database schema and create/apply migrations for this app (tables such as group, users, photos, reactions, the life gauge function, Storage buckets and RLS policies). Use when creating a new table, adding a column, writing a migration script, adding an RLS policy, or reviewing the DB schema against the spec. Trigger phrases: "テーブルを追加して", "スキーマを変更", "マイグレーションを作成", "RLSポリシーを追加", "DB設計を見直して".
---

# Supabase Schema Migration

このスキルは `.clinerules/00-overview.md`（共通ルール）と、対象フェーズのファイル（`02-v0.md`, `03-v1.md` 等）のDB定義に従う。
マイグレーションは `supabase/migrations/` に連番SQL（`001_...`）として置き、Supabase ダッシュボードの SQL Editor から番号順に実行する。

## v0 時点のスキーマ（正）

```
group {
  id
  name?
  users
}

users {
  id
  group_id
  name
  role      // child | uncle
  created_at
}

photos {
  id
  group_id
  uploader_id
  image_url
  created_at
}

reactions {
  id
  photo_id
  reactor_id
  created_at
}
```

## v1 時点の追加（正）

- `group.life_value`（INTEGER, 初期50, 上限100）／ `group.life_updated_at`（TIMESTAMPTZ）
- `update_life(target_group_id, actor_user_id, action_type)`：経過時間による減衰と、`photo_upload` / `reaction` による加算を1関数で行う。

v2以降で新たなカラム／テーブルが必要になった場合も、**該当フェーズの `.clinerules` に明記されていない項目は追加しない**。追加が必要と判断した場合は、実装前に必ずユーザーに確認する。

## 手順

1. **仕様確認**：変更内容が該当フェーズの `.clinerules` に記載されたテーブル定義と一致するか確認する。一致しない場合は実装せず、ユーザーに確認する。
2. **既存マイグレーションの確認**：`supabase/migrations/` の最新番号を確認する。**既に適用済みのSQLは編集しない**（常に新しい連番ファイルで追記する）。
3. **マイグレーションの作成**：
   - ファイル名は `<連番3桁>_<内容>.sql`（例: `006_add_notification_token.sql`）。
   - 新規テーブル追加時は `created_at` を含める（既存テーブルの命名規則に合わせる）。
   - 外部キー（`group_id`, `uploader_id`, `photo_id`, `reactor_id` など）には適切なインデックスを付与する。
   - カラム名・テーブル名はスネークケースで統一する。`group` は予約語のため常に `"group"` とダブルクォートする。
   - 再実行できるよう `IF NOT EXISTS` / `CREATE OR REPLACE` / `DROP POLICY IF EXISTS` を使う。
4. **RLS**：新規テーブルは RLS を有効化し、`anon` からのアクセスを許可するポリシーを同じマイグレーションで定義する。ポリシーが無いとアプリからは空配列または `42501` が返る。
5. **ロールバック用SQL**をファイル末尾にコメントで残す。
6. **変更ファイルの確認**：マイグレーションファイルなど、変更対象ファイルを実装前にユーザーに提示する。

## 完了確認

- 追加したマイグレーションファイルの一覧と、SQL Editor での適用手順を報告する。
- 実DBへの適用が必要な場合はその手順を提示し、実行の許可を得る。
- 動作確認は `build` のみ（プロジェクト共通ルール）。実機確認・Web確認は不要。
