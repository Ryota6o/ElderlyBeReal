---
name: supabase-setup
description: Set up or verify the Supabase backend (project, Database schema, Storage bucket, RLS policies, environment variables) for the app's init phase. Use when initializing the project, creating the photos Storage bucket, provisioning the database, configuring RLS policies for anon access, or wiring the Expo app's Supabase credentials. Trigger phrases: "Supabaseをセットアップ", "Storageバケットを作って", "RLSポリシーを設定", "Supabase初期化", "init のバックエンド周りをやって".
---

# Supabase Setup

このスキルは `.clinerules/01-init.md`（initフェーズ）および `.clinerules/00-overview.md`（技術要件）のスコープに従う。
**リージョンは Northeast Asia (Tokyo) を推奨する。**

## 前提確認

1. 対象フェーズが `init`（もしくは init で未実施のバックエンド構築）であることを確認する。v0以降で新たに Supabase の機能を使う場合は、そのフェーズのファイル（例: `02-v0.md`）で許可された機能のみ扱う。
2. `supabase/migrations/` に既存のマイグレーションSQLがあるか確認する。存在すればそれに従い、**既に適用済みのSQLは編集せず連番で追記する**。
3. 変更対象のファイル／リソースをユーザーに確認してから作業を開始する（プロジェクト共通ルール）。

## 構成（固定）

アプリは API サーバーを持たず、`@supabase/supabase-js` から Supabase へ直接アクセスする。

- **Database (PostgreSQL)**：`group` / `users` / `photos` / `reactions`、寿命ゲージ関数 `update_life()`
- **Storage**：写真バケット `photos`
- **RLS**：`anon` キーからのアクセス制御

## 手順

### 1. Supabase プロジェクト

- ダッシュボードでプロジェクトを作成する（リージョンは Tokyo）。
- 既存プロジェクトがある場合は新規作成せず、接続先を確認する。

### 2. Database（スキーマ）

- テーブル定義は `.clinerules/02-v0.md` を参照（`group`, `users`, `photos`, `reactions`）。
- スキーマ変更は `supabase-schema-migration` スキルに従い、`supabase/migrations/` にSQLを追加する。
- ダッシュボードの SQL Editor から手作業でテーブルを作った場合も、**必ず同じ内容のSQLを `supabase/migrations/` に残す**（リポジトリだけで再現できる状態を保つ）。

### 3. Storage

- バケット名は `photos`（`app/src/api/client.ts` の `PHOTOS_BUCKET` と一致させる）。
- `getPublicUrl()` で得たURLを `photos.image_url` に保存しているため、バケットは public とする。
- `storage.objects` に対して、`anon` からの INSERT（アップロード）と SELECT（参照）を許可するポリシーを置く。

### 4. RLS

- クライアントに配布するのは **`anon` キー（公開鍵）のみ**。`service_role` キーはアプリ・リポジトリに含めない。
- 各テーブルで RLS を有効化し、ポリシーを明示する。
- v0/v1 は認証を持たないため anon 全許可としている。**認証（Supabase Auth）を導入する際は必ず見直す**旨をSQLのコメントに残すこと。

### 5. 環境変数

- `app/.env.example` に `EXPO_PUBLIC_SUPABASE_URL` と `EXPO_PUBLIC_SUPABASE_ANON_KEY` を定義する。
- 実際のキーは `app/.env`（gitignore対象）に置き、**リポジトリへコミットしない**。

### 6. 通知

- v0スコープには含まれない。v1以降で明示的に指示された場合のみ、Expo Push Notifications + Edge Functions で設定する。

## 完了確認

- 作成・変更したリソース一覧（バケット名、テーブル、ポリシー、マイグレーションファイル）を要約してユーザーに報告する。
- 動作確認は `build` のみ（プロジェクト共通ルール）。実機確認・Web確認は不要。
