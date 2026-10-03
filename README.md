# PDF Quotation Parser Web

PDF形式の見積書をブラウザ上で解析し、明細データの確認・編集・Supabaseへの保存やCSVエクスポートを行うWebアプリケーションです。

## 技術スタック

- **Frontend**: React 19, TypeScript, Vite
- **PDF解析**: PDF.js (`pdfjs-dist`), pdf-lib
- **Backend / Database**: Supabase
- **Testing**: Vitest, React Testing Library

---

## 別のPCへのクローンおよび環境構築・実行手順

### 1. 前提条件

移行先PCに以下の環境がインストールされていることを確認してください。

- **Node.js**: v20.x 以上推奨 (LTS)
- **npm** または互換パッケージマネージャ
- **Git**

### 2. リポジトリのクローン

ターミナル（PowerShell / コマンドプロンプト / bash 等）を開き、任意の作業ディレクトリで以下を実行します。

```bash
git clone https://github.com/yoki-wednesday/pdf-quotation-parser-web.git
cd pdf-quotation-parser-web
```

### 3. 依存パッケージのインストール

```bash
npm install
```

### 4. 環境変数ファイル（`.env.local`）の作成

`.env.local` はセキュリティ上 `.gitignore` に含まれており、リポジトリにはコミットされません。
プロジェクト直下に `.env.local` ファイルを作成し、Supabase接続情報を記述してください。

```bash
# プロジェクト直下に作成
touch .env.local  # Windows PowerShell の場合は New-Item .env.local
```

`.env.local` の内容例:
```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

> **Note**: Supabaseプロジェクトの接続情報は、Supabase管理画面の `Project Settings` -> `API` (Project URL & Project API Keys) から確認できます。

### 5. アプリケーションの起動（開発サーバー）

#### (A) サーバーを実行しているPC自身で利用する場合
```bash
npm run dev
```
起動後、ブラウザで `http://localhost:5173` にアクセスします。

#### (B) 同一ネットワーク（LAN/Wi-Fi）内の別のPCやスマホ・タブレットからアクセスする場合
Viteサーバーを外部IP向けにバインドして起動します。

```bash
npm run dev -- --host
```

起動するとターミナルに以下のように表示されます：

```text
  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/
```

- **接続方法**: 別のPCのブラウザから、ターミナルに表示された `Network:` のURL（例: `http://192.168.x.x:5173`）を入力して開きます。
- **注意点（Windowsファイアウォール）**:
  - 初回起動時に Windows Defender ファイアウォールの確認ダイアログが表示された場合は、「プライベートネットワーク」へのアクセスを許可してください。
  - つながらない場合は、両PCが同一のWi-Fi/LANに接続されているか、またはポート `5173` が遮断されていないか確認してください。

---

## 主なスクリプト一覧

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発用ローカルサーバーの起動 (Vite) |
| `npm run build` | TypeScript型チェックおよび本番ビルドの生成 |
| `npm run preview` | ビルド成果物 (`dist`) のローカルプレビュー |
| `npm run lint` | Oxlint による静的解析 |
| `npm run test` | Vitest による単体テストの実行 |
