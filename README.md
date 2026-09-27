# NTTドコモ-Bチーム
NTTドコモ-Bチーム　開発レポジトリ

## プロジェクト構成

```
.
├── .clinerules/   # 実装フェーズ(init/v0/v1/v2/v3)ごとの仕様・ルール、Skills
├── app/           # フロントエンド（Expo / React Native / TypeScript）
└── supabase/      # バックエンド基盤（Supabase）
    ├── migrations/  # DBマイグレーションSQL（スキーマ、寿命ゲージ関数、Storage、RLS）
    └── README.md    # セットアップ手順
```

アプリは API サーバーを持たず、`@supabase/supabase-js` から Supabase（PostgreSQL / Storage）へ直接アクセスする。

仕様の詳細は `.clinerules/00-overview.md`（共通）と、フェーズ別ファイル（`01-init.md`, `02-v0.md`, ...）を参照してください。

## セットアップ（ローカル）

### バックエンド（supabase/）

1. [Supabase](https://supabase.com/) でプロジェクトを作成する。
2. ダッシュボードの SQL Editor で `supabase/migrations/` 配下の SQL を番号順に実行する。
3. Project Settings → API から `Project URL` と `anon public` キーを控える。

詳細は [`supabase/README.md`](supabase/README.md) を参照してください。

### アプリ（app/）

```bash
cd app
cp .env.example .env   # 上で控えた URL と anon キーを記入する
npm install
npm run build   # tsc --noEmit によるビルド確認（実機・Web確認は行わない）
```

## v0 スコープ

- 孫：写真をアップロード（Supabase Storage）
- おじい：最新の写真にリアクション（いいね）
- 使用するSupabase機能：Database (PostgreSQL) / Storage / RLS

詳細は `.clinerules/02-v0.md` を参照してください。
