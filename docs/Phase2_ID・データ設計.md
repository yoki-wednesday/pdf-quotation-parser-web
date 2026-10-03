# Phase 2 ID・データ設計 (ID & Data Design)

## 1. 要件・機能ID一覧マトリクス

| ID | 名称 | 概要 | 優先度 | status | isFuture |
| :--- | :--- | :--- | :--- | :--- | :--- |
| REQ-22-001 | クライアントサイドPDF解析 | `pdf.js`を用いたブラウザ内テキスト・構造抽出 | MUST | Completed | false |
| REQ-22-002 | ファイル重複取り込み防止 | SHA-256ハッシュ計算による重複チェックと監査ログ記録 | MUST | Completed | false |
| REQ-22-003 | 2画面プレビューUI | D&Dアップロードと抽出結果の左右比較プレビュー | MUST | Completed | false |
| REQ-22-004 | 編集グリッド・自動再計算 | 単価・数量のインライン編集および小計・合計の自動再計算 | MUST | Completed | false |
| REQ-22-005 | 柔軟な検索・お気に入り | カナ揺れ吸収、複数キーワードAND検索、お気に入り明細管理 | MUST | Completed | false |
| REQ-22-006 | 買い物かご機能 | 複数見積明細のピックアップ・合算 | MUST | Completed | false |
| REQ-22-007 | 帳票PDF出力 | 日本語フォント埋め込み自社見積依頼書・発注書生成 (`pdf-lib`) | MUST | Completed | false |
| REQ-22-008 | AI向けMarkdown出力 | 機密情報のマスキングロジックを含むテキストエクスポート | MUST | Completed | false |
| REQ-22-009 | マスタ管理 | 自社設定、取引先商社、製品マスタの登録・管理 | MUST | Completed | false |
| REQ-22-010 | 認証・認可 (RLS) | Supabase AuthおよびRLSによるテナント・ユーザー単位のデータ分離 | MUST | Completed | false |
| REQ-22-011 | パーサー分離アーキテクチャ | 複数商社向けの解析ルールのプラグイン化・拡張 | SHOULD | Pending | false |
| REQ-22-012 | Gmail API連携 | 見積依頼・発注メールの下書き自動作成機能 | SHOULD | Future | true |

## 2. データ構造体 / スキーマ定義テーブル

すべてのエンティティのPKは `UUIDv7` を採用し、時系列ソートを可能とします（Auth用 `users` のみSupabase仕様に準拠）。
また、全テーブルに `user_id` を配置し、RLS(`auth.uid() = user_id`)の評価基盤とします。

### 2.1 `user_settings` (自社設定)
| フィールド名 | 型 | 必須 | 初期値 | 制約・備考 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUIDv7 | 必須 | auto | PK |
| `user_id` | UUID | 必須 | auth.uid() | FK (auth.users), RLS分離キー |
| `company_name` | String | 必須 | - | 最大100文字 |
| `address` | String | 任意 | null | - |
| `status` | String | 必須 | 'Pending' | Pending/InProgress/Completed/Future |
| `isFuture` | Boolean | 必須 | false | - |

### 2.2 `suppliers` (取引先商社マスタ)
| フィールド名 | 型 | 必須 | 初期値 | 制約・備考 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUIDv7 | 必須 | auto | PK |
| `user_id` | UUID | 必須 | auth.uid() | FK, RLS分離キー |
| `name` | String | 必須 | - | 最大100文字 |
| `code` | String | 任意 | null | 独自識別コード |
| `status` | String | 必須 | 'Pending' | - |
| `isFuture` | Boolean | 必須 | false | - |

### 2.3 `estimates` (見積書ヘッダ)
| フィールド名 | 型 | 必須 | 初期値 | 制約・備考 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUIDv7 | 必須 | auto | PK |
| `user_id` | UUID | 必須 | auth.uid() | FK, RLS分離キー |
| `supplier_id` | UUIDv7 | 必須 | - | FK (suppliers) |
| `document_hash` | String | 必須 | - | SHA-256 (重複チェック用), UNIQUE(user_id, hash) |
| `total_amount` | Integer | 必須 | 0 | - |
| `status` | String | 必須 | 'Pending' | - |
| `isFuture` | Boolean | 必須 | false | - |

### 2.4 `estimate_items` (見積書明細)
| フィールド名 | 型 | 必須 | 初期値 | 制約・備考 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUIDv7 | 必須 | auto | PK |
| `estimate_id` | UUIDv7 | 必須 | - | FK (estimates), ON DELETE CASCADE |
| `product_name` | String | 必須 | - | - |
| `quantity` | Integer | 必須 | 1 | > 0 |
| `unit_price` | Integer | 必須 | 0 | >= 0 |
| `amount` | Integer | 必須 | 0 | quantity * unit_price |
| `status` | String | 必須 | 'Pending' | - |
| `isFuture` | Boolean | 必須 | false | - |

### 2.5 `import_logs` (PDF取り込み監査ログ)
| フィールド名 | 型 | 必須 | 初期値 | 制約・備考 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUIDv7 | 必須 | auto | PK |
| `user_id` | UUID | 必須 | auth.uid() | FK, RLS分離キー |
| `document_hash` | String | 必須 | - | SHA-256 |
| `filename` | String | 必須 | - | オリジナルファイル名 |
| `imported_at` | Timestamp | 必須 | now() | - |
| `status` | String | 必須 | 'Pending' | - |
| `isFuture` | Boolean | 必須 | false | - |

## 3. データエンティティ間リレーションシップ定義

- `users` (Supabase Auth) **1 : 1** `user_settings`
- `users` (Supabase Auth) **1 : N** `suppliers`
- `users` (Supabase Auth) **1 : N** `estimates`
- `users` (Supabase Auth) **1 : N** `import_logs`
- `suppliers` **1 : N** `estimates`
- `estimates` **1 : N** `estimate_items`

## 4. UI要素識別子（実装制約）

- 自動テスト・AI操作の確実な実行のため、すべてのインタラクティブ要素（ボタン、フォーム、リンク）には画面内で一意なKebab-caseの `data-ai-id` 属性を付与すること。
  - 例: `<button data-ai-id="btn-upload-pdf">アップロード</button>`
  - 例: `<input data-ai-id="input-search-keyword" />`
