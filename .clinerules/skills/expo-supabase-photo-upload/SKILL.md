---
name: expo-supabase-photo-upload
description: Implement photo upload from an Expo (React Native) app to Supabase Storage, and photo/reaction retrieval, for the 孫(child)/おじい(uncle) app. Use when implementing the photo upload button, image picker/camera integration, the Supabase Storage upload flow, saving the photo record to the database, or the reaction button on the uncle side. Trigger phrases: "写真アップロード機能を実装", "Storageにアップロードする処理", "画像picker を実装", "リアクションボタンを実装".
---

# Expo → Supabase Storage Photo Upload

このスキルは `.clinerules/00-overview.md`（技術要件・共通ルール）と `.clinerules/02-v0.md`（v0仕様・画面構成・DBスキーマ）に従う。
v0のスコープ外（制限時間内撮影、エンドロール、通知など）は実装しない。

## 使用技術（固定）

- フロントエンド：React Native (Expo) / TypeScript
- バックエンド：Supabase Storage（画像保存）、Supabase Database (PostgreSQL)（メタデータ）
- クライアント：`@supabase/supabase-js`（`app/src/api/supabase.ts` の `supabase` を使う）
- API層は `app/src/api/client.ts` に集約する。画面から `supabase` を直接呼ばない。

## 実装フロー（推奨パターン）

### 1. 孫側：写真アップロード

1. `expo-image-picker` でギャラリー選択もしくはカメラ撮影を行う。
2. アップロード前に `group` / `users` のレコードが存在することを保証する（`ensureGroupAndUser()`）。外部キー違反（`23503`）を防ぐため。
3. `supabase.storage.from('photos').upload(objectPath, file)` で `photos` バケットへ直接アップロードする。
   - オブジェクトパスは `${groupId}/${photoId}.jpg` の形式に揃える。
   - **React Native では `Blob` をそのまま渡すと0バイトのオブジェクトが作られることがある。`fetch(uri)` → `arrayBuffer()` に変換してから渡すこと。**
4. `getPublicUrl()` で公開URLを取得し、`photos` テーブルへレコード（`id`, `group_id`, `uploader_id`, `image_url`）を `insert` する。
5. 画面（`02-v0.md` 記載の孫側「写真アップロードボタン」）にアップロード状態（成功/失敗/進行中）を表示する。

### 2. おじい側：リアクション

1. 画面上部に最新（または対象）の写真を表示、下部にリアクションボタンを配置する（`02-v0.md` の画面構成に準拠）。
2. ボタン押下時、`reactions` テーブルへ `id`, `photo_id`, `reactor_id` を `insert` する。
3. 二重リアクション防止など、仕様に明記がない挙動は独自に追加しない。判断が必要な場合はユーザーに確認する。

## 実装上の注意

- group_id はv0仕様の「共通：group_idを入力、表示」に従い、画面上で入力・表示できるようにする。
- PostgREST のエラーは `code` で原因を切り分けられる（RLS違反 `42501`、外部キー違反 `23503`）。エラーメッセージには `code` も含めること。
- 新しいテーブル・バケットへアクセスする場合は、**RLS ポリシーがそのアクセスを許可しているか**を必ず確認する（`supabase/migrations/005_rls_policies.sql`）。ポリシーが無いと空配列や `42501` が返る。
- 既存のexpoパッケージ構成（`app/package.json`）を確認し、未導入の依存関係を追加する場合はユーザーに確認する。

## 完了確認

- 変更・追加したファイル一覧を報告する。
- 動作確認は `build` のみ（プロジェクト共通ルール）。実機確認・Web確認は不要。
