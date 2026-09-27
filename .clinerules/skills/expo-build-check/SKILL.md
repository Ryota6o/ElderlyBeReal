---
name: expo-build-check
description: Verify the Expo (React Native/TypeScript) project builds successfully after implementation changes, following the project's rule of using "build" only (no device or web verification). Use after implementing or modifying any feature, before reporting completion. Trigger phrases: "ビルド確認して", "build を実行", "実装が完了したか確認".
---

# Expo Build Check

このスキルは `.clinerules/00-overview.md` の実装上の共通ルールに従う：
**動作確認は `build` のみ。実機確認は行わない。Webでの確認も不要。**

## 手順

1. 変更したファイル一覧を確認する（実装前に確認したファイルと一致しているか確認）。
2. プロジェクトルートで依存関係が最新か確認する（`package.json` に変更があれば `expo install` の必要性を判断する）。
3. `build` を実行する。
4. ビルド結果を確認する：
   - **成功**：ビルドログの要点（成功メッセージ）をユーザーに報告する。
   - **失敗**：エラーメッセージを読み、原因（型エラー、import漏れ、未定義変数など）を特定し、該当ファイルのみ修正する。修正範囲が仕様書（`.clinerules`）を超える場合は、実装を進めずユーザーに確認する。
5. 修正後は再度 `build` を実行し、成功するまで（または仕様確認が必要な状態になるまで）繰り返す。

## 注意事項

- `expo start`、`expo run:android`、`expo run:ios`、ブラウザでのプレビューなど、ビルド確認以外の実行コマンドは使用しない。
- ビルドが通ることの確認のみが目的であり、UI/UXの見た目確認は不要。
- ビルドスクリプトが存在しない、または `build` 以外の名称になっている場合は `package.json` の `scripts` を確認し、実際のビルドコマンド名をユーザーに確認する。

## 完了確認

- `build` の最終結果（成功/失敗）と、失敗時に修正した内容を要約してユーザーに報告する。
