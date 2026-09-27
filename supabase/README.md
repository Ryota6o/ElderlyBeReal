# supabase/

バックエンド（Supabase）の構成をコードで残すディレクトリ。

アプリ（`app/`）は Supabase に**直接**アクセスする。API サーバーは持たない。

- **Database (PostgreSQL)** … `group` / `users` / `photos` / `reactions`、寿命ゲージ関数 `update_life()`
- **Storage** … 写真バケット `photos`（public）
- **PostgREST** … `@supabase/supabase-js` からテーブルへ読み書き
- **RLS** … anon キーでのアクセスを許可するポリシー（PoC 用の全許可。`005` のコメント参照）

## セットアップ

1. [Supabase](https://supabase.com/) でプロジェクトを作成する（リージョンは Northeast Asia (Tokyo) を推奨）。
2. ダッシュボードの **SQL Editor** で `migrations/` 配下の SQL を**番号順に**実行する。
3. **Project Settings → API** から `Project URL` と `anon public` キーを取得し、`app/.env` に設定する。

```bash
cd app
cp .env.example .env
# EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY を記入
```

## マイグレーション

| ファイル | 内容 |
| --- | --- |
| `001_init_v0_schema.sql` | v0 スキーマ（`group` / `users` / `photos` / `reactions`） |
| `002_add_life_to_group.sql` | v1 寿命ゲージ（`group.life_value` と `update_life()`） |
| `003_add_image_url_to_reactions.sql` | リアクション撮影画像URL（`reactions.image_url`） |
| `004_storage_photos_bucket.sql` | Storage バケット `photos` とそのポリシー |
| `005_rls_policies.sql` | 各テーブルの RLS ポリシー |
| `006_fixes.sql` | 外部キーの ON DELETE CASCADE 化、`reactions` の UNIQUE(photo_id, reactor_id)、`update_life()` の減衰端数の持ち越し修正 |
| `007_group_id_as_text.sql` | 招待コードを任意の文字列にする（`group.id` と参照列を UUID → TEXT、`update_life()` の第1引数も TEXT へ） |
| `008_symmetric_roles_and_elder_info.sql` | 孫・おじの対称化（`update_life()` の役割制限を撤廃）、`group` に `elder_name` / `elder_age` / `created_at` を追加 |
| `009_profiles_and_icons.sql` | プロフィール（`users.age` / `users.icon_url`、`group.elder_icon_url`） |
| `all_migrations.sql` | 上記 001-009 を連結し 006〜009 の内容を反映したもの。**新規プロジェクトはこれを1回実行すれば足りる**（連番ファイルとは別枠） |

新しいマイグレーションは連番（`010_...`）で追加し、**既に適用済みの SQL は編集せず**、常に追記で変更する。
各ファイルにはロールバック用 SQL をコメントで残す。

## 注意

- `anon` キーはクライアントに配布される公開鍵。**`service_role` キーはアプリに埋め込まない。**
- 現在の RLS は「group_id を知っていれば誰でも読み書きできる」状態。認証の導入時に必ず見直すこと（`005_rls_policies.sql` 冒頭のコメント参照）。
