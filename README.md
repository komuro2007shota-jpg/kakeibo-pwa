# 家計簿 (PWA)

Supabase + Vite + React で動く、個人用の家計簿です。PC/Android/Windowsのブラウザから使えます。

## 1. Supabase を作成

1. Supabase で新規プロジェクト作成
2. SQL Editor で `supabase/schema.sql` を実行（transactions と categories を作成）
3. Auth 設定で Email (OTP) を有効化

## 2. 環境変数を設定

`.env.local` を作成して以下を設定します。

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## 3. ローカル起動

```
npm install
npm run dev
```

## 4. デプロイ (無料)

Vercel または Netlify にデプロイし、
環境変数 `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` を設定してください。

HTTPS 配信になるので、Android で「ホーム画面に追加」してアプリのように使えます。

## アイコンについて

現在は SVG アイコンのみです。必要なら PNG (192/512) を追加してください。

## 追加機能

- カテゴリの追加/編集/削除（Supabase の categories テーブル）
- CSVエクスポート（この月 / 全期間）
