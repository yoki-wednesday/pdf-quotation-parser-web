# Phase 2: ID・データ設計 (ID & Data Design)

## 【背景・目的】
Phase 1の要件定義（デスクトップSQLite版からWeb SPA版＋クライアントサイドPDF解析＋Supabaseへの移行を含む全履歴）に基づき、全エンティティ・機能要件・PBI・テストケースに不変の一意IDを付与し、型安全なデータ構造とリレーションシップを確定する。
本設計書は、Web SPA環境（React + Vite + TypeScript）におけるブラウザ内パース（`pdf.js`）、Supabase（PostgreSQL + Auth + RLS）連携、およびUI自動操作・テスト用識別子（`data-ai-id`）を網羅する。

---

## 1. 要件・機能ID一覧マトリクス

全要件エンティティにはスコープ属性標準化（REQ-13-001）として `status` (Pending / In Progress / Completed / Future) および `isFuture` フラグを定義する。

| ID | 名称 | 概要 | 優先度 | status | isFuture |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-001** | 見積回答PDFの重複登録防止と案内 | ブラウザ上での取り込み時に同一ファイルの二重登録を防止し、PDFのクラウド非保存方針を案内。 | MUST | Completed | false |
| **REQ-002** | ファイル重複チェック (ハッシュ) | クライアント側でSHA-256ハッシュを計算し、`import_logs` と照合して二重インポートを防止。 | MUST | Completed | false |
| **REQ-003** | クライアントサイドPDFパース | `pdf.js` によりブラウザメモリ上でPDFテキストを抽出し、ヘッダー・明細行へ正規化・構造化。 | MUST | In Progress | false |
| **REQ-004** | 抽出結果プレビュー・修正GUI | 原本テキスト/プレビューと抽出明細グリッドを並べて表示し、手動修正・不整合検証を可能にする。 | MUST | In Progress | false |
| **REQ-005** | PDFドラッグ＆ドロップ・選択UI | File APIを利用したファイルドロップ領域およびファイル選択ダイアログ。 | MUST | In Progress | false |
| **REQ-006** | 見積ヘッダー・明細のSupabase保存 | 確認済みの見積データをSupabase PostgreSQL（`estimates`, `estimate_items`）へトランザクション保存。 | MUST | In Progress | false |
| **REQ-007** | 過去単価の検索・表記揺れ吸収 | メーカー名・品名・型番による単価推移検索。全角/半角カナ・ひらがなの揺れを吸収。 | MUST | Pending | false |
| **REQ-008** | 買い物かご（Cart）機能 | 複数明細を一時ストックし、一括で帳票（見積依頼書・発注書）生成に回す。 | MUST | Pending | false |
| **REQ-009** | 新規見積依頼書PDF作成 | 金額非表示・回答期限・日本語レイアウトの御見積依頼書PDFをブラウザ上で動的生成。 | MUST | Pending | false |
| **REQ-010** | 新規発注書PDF作成 | 採用単価と税抜合計を算出した日本語御発注書PDFをブラウザ上で動的生成。 | MUST | Pending | false |
| **REQ-011** | アウトバウンド帳票履歴管理 | 発行した依頼書・発注書をDBに記録し、一覧・再発行を可能にする。 | MUST | Pending | false |
| **REQ-012** | 取引先・設定管理（DB一元化） | 旧 `config.json` を完全撤廃し、`user_settings` および `suppliers` テーブルで管理。 | MUST | In Progress | false |
| **REQ-013** | 機密情報のサニタイズ | 機密情報・ハードコードを排除し、環境変数（.env.local）と認証セッションで安全管理。 | MUST | Completed | false |
| **REQ-014** | 新規製品の見積発注とマスタ登録 | 未登録製品の見積・発注時に製品マスタ（`product_master`）へ自動または手動同期。 | MUST | Pending | false |
| **REQ-015** | 完全Webアプリ化 (SPA) | 配布容易性を実現するReact + Vite + TypeScript構成のSPA配信。 | MUST | In Progress | false |
| **REQ-016** | PDFクラウド非保存要件担保 | 元PDFバイナリを外部サーバー・クラウドストレージに送信せずローカルメモリで破棄。 | MUST | In Progress | false |
| **REQ-017** | Supabase Auth統合 & RLS分離 | `auth.users` と連携し、DBレベルで全テーブルに `auth.uid() = user_id` を強制。 | MUST | In Progress | false |
| **REQ-018** | UI要素識別子 (`data-ai-id`) 付与 | 全ての操作可能UI要素（ボタン・入力等）に一意なKebab-case識別子を強制。 | MUST | In Progress | false |
| **REQ-019** | Gmail下書き作成連携 | 見積依頼・発注時のGmail API連携による下書き自動生成。 | SHOULD | Future | true |
| **REQ-020** | マルチ商社向けパーサー拡張 | 岩瀬産業以外の帳票フォーマットに対応する動的パーサープラグイン構造。 | SHOULD | Future | true |

---

## 2. データ構造体 / スキーマ定義テーブル (SPEC)

全属性に対して、型、必須/任意制約、初期値、バリデーション境界値を定義する。主キーは時系列ソート可能な **UUID (UUIDv7)** を採用。

### 2.1 ユーザープロファイル: `users` (SPEC-001)
Supabase Auth (`auth.users`) の拡張プロファイルテーブル。

| フィールド名 | 型 | 必須 | 初期値 | 制約・バリデーション境界値 | 説明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | Y | `auth.uid()` | PK, REFERENCES `auth.users(id)` | 認証ユーザーID |
| `email` | TEXT | Y | - | UNIQUE, 有効なメールアドレス形式 | ログインメール |
| `created_at` | TIMESTAMPTZ | Y | `now()` | ISO 8601 UTC | 作成日時 |
| `updated_at` | TIMESTAMPTZ | Y | `now()` | ISO 8601 UTC | 更新日時 |
| `deleted_at` | TIMESTAMPTZ | N | NULL | 論理削除日時 | 削除フラグ代替 |

### 2.2 ユーザー自社設定: `user_settings` (SPEC-002)
従来の `config.json` を完全代替するユーザー個別設定。

| フィールド名 | 型 | 必須 | 初期値 | 制約・バリデーション境界値 | 説明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | Y | `gen_random_uuid()` | PK, UUIDv7 | 設定レコードID |
| `user_id` | UUID | Y | `auth.uid()` | FK -> `users.id` ON DELETE CASCADE | 所有ユーザーID |
| `company_name` | TEXT | N | "" | 最大100文字 | 自社企業名 |
| `address` | TEXT | N | "" | 最大200文字 | 所在地住所 |
| `tel` | TEXT | N | "" | 半角英数・ハイフン | 電話番号 |
| `fax` | TEXT | N | "" | 半角英数・ハイフン | FAX番号 |
| `email` | TEXT | N | "" | メール形式または空文字 | 連絡先メール |
| `person_in_charge`| TEXT | N | "" | 最大50文字 | 担当者氏名 |
| `person_last_name`| TEXT | N | "" | 最大30文字 | 担当者（姓） |
| `person_first_name`| TEXT | N | "" | 最大30文字 | 担当者（名） |
| `person_middle_name`| TEXT| N | "" | 最大30文字 | 担当者（ミドル） |
| `pdf_save_path` | TEXT | N | "" | 画面表示用の案内テキスト | 保存先案内パス |
| `created_at` | TIMESTAMPTZ | Y | `now()` | ISO 8601 UTC | 作成日時 |
| `updated_at` | TIMESTAMPTZ | Y | `now()` | ISO 8601 UTC | 更新日時 |
| `deleted_at` | TIMESTAMPTZ | N | NULL | 論理削除日時 | 論理削除 |

> **実装・同期メモ (最新)**:
> - `handleSave` 実行時に `supabase.auth.getUser()` からログイン中ユーザーの `user.id`（UUID）を安全に取得して `user_id` に保存。
> - `person_in_charge` は入力された「姓」「ミドルネーム」「名」を半角スペース区切りで自動結合して格納。
> - 個別カラム `person_last_name`, `person_first_name`, `person_middle_name`, `pdf_save_path`, `email` も同時に個別に保存・同期。

### 2.3 取引先マスタ: `suppliers` (SPEC-003)

| フィールド名 | 型 | 必須 | 初期値 | 制約・バリデーション境界値 | 説明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | Y | `gen_random_uuid()` | PK, UUIDv7 | 取引先ID |
| `user_id` | UUID | Y | `auth.uid()` | FK -> `users.id` ON DELETE CASCADE | 所有ユーザーID |
| `name` | TEXT | Y | - | 空白不可, 最大100文字 | 商社・仕入先名 |
| `person_last_name`| TEXT | N | "" | 最大30文字 | 担当者（姓） |
| `person_first_name`| TEXT | N | "" | 最大30文字 | 担当者（名） |
| `person_middle_name`| TEXT| N | "" | 最大30文字 | 担当者（ミドル） |
| `email` | TEXT | N | "" | メール形式または空文字 | 担当者メール |
| `created_at` | TIMESTAMPTZ | Y | `now()` | ISO 8601 UTC | 作成日時 |
| `deleted_at` | TIMESTAMPTZ | N | NULL | 論理削除日時 | 論理削除 |

> **実装・同期メモ (最新)**:
> - 画面右上ヘッダーに「🏢 商社マスタ」ボタンを配置し、モーダルダイアログとしてCRUD操作を提供。
> - 担当者情報として「姓」「ミドルネーム」「名」の個別入力・保存（`person_last_name`, `person_middle_name`, `person_first_name`）に対応。
> - ログイン中の `user.id` を自動補完して `user_id` カラムにセット。
> - 削除処理は `deleted_at` を更新する安全な論理削除。

### 2.4 受領見積ヘッダー: `estimates` (SPEC-004)

| フィールド名 | 型 | 必須 | 初期値 | 制約・バリデーション境界値 | 説明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | Y | `gen_random_uuid()` | PK, UUIDv7 | 見積ヘッダーID |
| `user_id` | UUID | Y | `auth.uid()` | FK -> `users.id` ON DELETE CASCADE | 所有ユーザーID |
| `estimate_number` | TEXT | Y | - | ユーザー単位で一意 | 見積書番号 |
| `status` | TEXT | Y | 'draft' | 'draft'\|'pending'\|'approved'\|'ordered'\|'rejected' | 処理ステータス |
| `issue_date` | DATE | Y | CURRENT_DATE | YYYY-MM-DD | 見積発行日 |
| `customer_name` | TEXT | Y | - | 空白不可 | 宛名・得意先名 |
| `customer_dept_person`| TEXT | N | NULL | | 部署・担当者 |
| `subject` | TEXT | N | NULL | | 件名 |
| `delivery_date` | TEXT | N | NULL | | 納期 |
| `delivery_place` | TEXT | N | NULL | | 受渡場所 |
| `payment_terms` | TEXT | N | NULL | | お取引方法 |
| `expiration_date` | TEXT | N | NULL | | 見積有効期限 |
| `sales_rep` | TEXT | N | NULL | | 相手方営業担当者 |
| `total_amount` | BIGINT | Y | 0 | 0以上の整数 | 見積合計金額 |
| `invoice_registration_number` | TEXT | N | NULL | T+13桁数字またはNULL | 適格請求書番号 |
| `total_amount_excl_tax` | BIGINT | N | NULL | 0以上の整数 | 税抜合計額 |
| `tax_amount` | BIGINT | N | NULL | 0以上の整数 | 消費税額 |
| `total_amount_incl_tax` | BIGINT | N | NULL | 0以上の整数 | 税込合計額 |
| `tax_note` | TEXT | N | NULL | | 税注記 |
| `file_name` | TEXT | Y | - | 拡張子 .pdf | 元ファイル名（パスは非保存） |
| `parsed_text` | TEXT | N | NULL | ブラウザ抽出テキスト | 解析テキスト原文 |
| `metadata` | JSONB | N | '{}'::jsonb | 任意のキーバリュー | 拡張メタデータ |
| `created_at` | TIMESTAMPTZ | Y | `now()` | ISO 8601 UTC | 作成日時 |
| `updated_at` | TIMESTAMPTZ | Y | `now()` | ISO 8601 UTC | 更新日時 |
| `deleted_at` | TIMESTAMPTZ | N | NULL | 論理削除日時 | 論理削除 |

### 2.5 受領見積明細: `estimate_items` (SPEC-005)

| フィールド名 | 型 | 必須 | 初期値 | 制約・バリデーション境界値 | 説明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | Y | `gen_random_uuid()` | PK, UUIDv7 | 明細ID |
| `user_id` | UUID | Y | `auth.uid()` | FK -> `users.id` ON DELETE CASCADE | 所有ユーザーID |
| `estimate_id` | UUID | Y | - | FK -> `estimates.id` ON DELETE CASCADE | 親見積ID |
| `line_number` | INTEGER | Y | 1 | 1以上の整数 | 明細行番号 |
| `maker_name` | TEXT | N | NULL | | メーカー名 |
| `item_name` | TEXT | Y | - | 空白不可 | 品名・型番・仕様 |
| `quantity` | INTEGER | Y | 1 | 1以上の整数 | 数量 |
| `unit` | TEXT | N | '個' | | 単位 |
| `unit_price` | BIGINT | Y | 0 | 0以上の整数 | 単価 |
| `amount` | BIGINT | Y | 0 | quantity * unit_price | 金額 |
| `list_price` | BIGINT | N | NULL | 0以上の整数 | 定価 |
| `item_note` | TEXT | N | NULL | | 明細備考 |
| `metadata` | JSONB | N | '{}'::jsonb | | 拡張メタデータ |
| `created_at` | TIMESTAMPTZ | Y | `now()` | ISO 8601 UTC | 作成日時 |
| `updated_at` | TIMESTAMPTZ | Y | `now()` | ISO 8601 UTC | 更新日時 |
| `deleted_at` | TIMESTAMPTZ | N | NULL | 論理削除日時 | 論理削除 |

> **実装・同期メモ (最新)**:
> - PDF解析時に `<メーカ名>` を正規表現で抽出し、`maker_name` カラムに格納。
> - `item_name` からは `<メーカ名>` を除去して純粋な品名・型番のみを保持。
> - 抽出プレビュー・修正画面において「メーカ」列を新設し、UI上での目視確認・修正をサポート。
> - DB保存時（`saveToDb`）に `maker_name` を漏れなくSupabaseへ送信。

### 2.6 重複防止・インポートログ: `import_logs` (SPEC-006)

| フィールド名 | 型 | 必須 | 初期値 | 制約・バリデーション境界値 | 説明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | Y | `gen_random_uuid()` | PK, UUIDv7 | ログID |
| `user_id` | UUID | Y | `auth.uid()` | FK -> `users.id` ON DELETE CASCADE | 所有ユーザーID |
| `file_name` | TEXT | Y | - | 拡張子 .pdf | 元ファイル名 |
| `file_hash` | TEXT | Y | - | ユーザー単位でUNIQUE, SHA-256 (64文字) | 重複判定ハッシュ |
| `status` | TEXT | Y | 'SUCCESS' | 'SUCCESS' \| 'FAILED' | 処理結果 |
| `error_message` | TEXT | N | NULL | | エラー内容 |
| `processed_at` | TIMESTAMPTZ | Y | `now()` | ISO 8601 UTC | 処理日時 |

### 2.7 製品マスタ: `product_master` (SPEC-007)

| フィールド名 | 型 | 必須 | 初期値 | 制約・バリデーション境界値 | 説明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | Y | `gen_random_uuid()` | PK, UUIDv7 | 製品ID |
| `user_id` | UUID | Y | `auth.uid()` | FK -> `users.id` ON DELETE CASCADE | 所有ユーザーID |
| `maker_name` | TEXT | Y | - | 空白不可 | メーカー名 |
| `item_name_and_spec` | TEXT | Y | - | 空白不可 | 品名・型番・仕様 |
| `default_unit` | TEXT | N | '個' | | 標準単位 |
| `metadata` | JSONB | N | '{}'::jsonb | | 拡張メタデータ |
| `created_at` | TIMESTAMPTZ | Y | `now()` | ISO 8601 UTC | 作成日時 |
| `updated_at` | TIMESTAMPTZ | Y | `now()` | ISO 8601 UTC | 更新日時 |
| `deleted_at` | TIMESTAMPTZ | N | NULL | 論理削除日時 | 論理削除 |

### 2.8 調達案件・アウトバウンド帳票: `procurement_projects` (SPEC-008)

| フィールド名 | 型 | 必須 | 初期値 | 制約・バリデーション境界値 | 説明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | Y | `gen_random_uuid()` | PK, UUIDv7 | 案件ID |
| `user_id` | UUID | Y | `auth.uid()` | FK -> `users.id` ON DELETE CASCADE | 所有ユーザーID |
| `project_name` | TEXT | Y | - | 空白不可 | 案件名称 |
| `status` | TEXT | Y | 'REQUESTED' | 'REQUESTED'\|'QUOTED'\|'ORDERED'\|'DELIVERED'\|'COMPLETED' | 進捗状態 |
| `document_type` | TEXT | Y | 'ESTIMATE_REQUEST'| 'ESTIMATE_REQUEST' \| 'PURCHASE_ORDER' | 帳票種別 |
| `estimate_id` | UUID | N | NULL | FK -> `estimates.id` ON DELETE SET NULL | 参照見積ID |
| `supplier_id` | UUID | N | NULL | FK -> `suppliers.id` ON DELETE SET NULL | 宛先取引先ID |
| `target_date` | DATE | N | NULL | YYYY-MM-DD | 希望納期/回答期日 |
| `total_amount` | BIGINT | N | 0 | 0以上の整数 | 発注額（依頼書時は0） |
| `notes` | TEXT | N | NULL | | 取引条件・備考 |
| `created_at` | TIMESTAMPTZ | Y | `now()` | ISO 8601 UTC | 作成日時 |
| `updated_at` | TIMESTAMPTZ | Y | `now()` | ISO 8601 UTC | 更新日時 |
### 2.9 お気に入りアイテム: `favorite_items` (SPEC-009)

| フィールド名 | 型 | 必須 | 初期値 | 制約・バリデーション境界値 | 説明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | Y | `gen_random_uuid()` | PK, UUIDv7 | お気に入りID |
| `user_id` | UUID | Y | `auth.uid()` | FK -> `users.id` ON DELETE CASCADE | 所有ユーザーID |
| `maker_name` | TEXT | N | "" | 最大100文字 | メーカー名 |
| `item_name` | TEXT | Y | - | 空白不可 | 品名・型番・仕様 |
| `unit_price` | BIGINT | N | 0 | 0以上の整数 | 参考単価 |
| `unit` | TEXT | N | '個' | | 単位 |
| `created_at` | TIMESTAMPTZ | Y | `now()` | ISO 8601 UTC | 作成日時 |
| `updated_at` | TIMESTAMPTZ | Y | `now()` | ISO 8601 UTC | 更新日時 |
| `deleted_at` | TIMESTAMPTZ | N | NULL | 論理削除日時 | 論理削除 |

---

## 3. データエンティティ間リレーションシップ定義

### 3.1 ER関係一覧
```
users (auth.users)
  │
  ├── 1 : 1 ── user_settings
  ├── 1 : N ── suppliers
  ├── 1 : N ── estimates
  │              │
  │              └── 1 : N ── estimate_items
  ├── 1 : N ── import_logs
  ├── 1 : N ── product_master
  ├── 1 : N ── favorite_items
  └── 1 : N ── procurement_projects
                 │
                 ├── N : 1 (任意) ── estimates
                 └── N : 1 (任意) ── suppliers
```

### 3.2 詳細リレーションシップ規定

1. **`users` (1) : (1) `user_settings`**
   - 1人の認証ユーザーに対して、1つの企業基本設定が紐づく。
   - 外部キー: `user_settings.user_id -> users.id` (ON DELETE CASCADE)

2. **`estimates` (1) : (N) `estimate_items`**
   - 1つの受領見積書に対して、複数の明細行が紐づく。
   - 外部キー: `estimate_items.estimate_id -> estimates.id` (ON DELETE CASCADE)

3. **`users` (1) : (N) `import_logs`**
   - ユーザーごとにファイルハッシュ（SHA-256）の一意制約（`UNIQUE (user_id, file_hash)`）を保持し、重複取り込みを防止。

4. **`procurement_projects` と `estimates` / `suppliers` の緩やかな結合**
   - 発行された帳票（依頼書・発注書）は、元見積や取引先マスタの改定・削除によって過去の印字内容が改変されないよう、生成時点のスナップショット（JSONまたは値渡し）を保持しつつ、追跡用FK（ON DELETE SET NULL）で参照する。

5. **`product_master` と `estimate_items` (論理リレーション)**
   - `maker_name` および `item_name` によるインデックス検索で過去単価・仕様補完を行う（直接のFK拘束は持たせない）。

---

## 4. UI要素識別子 (`data-ai-id`) 命名設計一覧

画面内の全インタラクティブ要素には、以下の規則に従った一意なKebab-caseの `data-ai-id` を付与する。

| UI要素 | 種別 | `data-ai-id` | 画面・配置場所 |
| :--- | :--- | :--- | :--- |
| PDFファイルドロップ領域 | DropZone / Input | `pdf-upload-dropzone` | ホーム / 取込ビュー |
| ファイル選択ボタン | Input (File) | `pdf-file-input` | ホーム / 取込ビュー |
| パース実行ボタン | Button | `btn-parse-pdf` | ホーム / 取込ビュー |
| 原本抽出テキストエリア | Textarea | `txt-extracted-preview` | パース結果確認グリッド |
| 見積番号入力 | Input (Text) | `input-estimate-number` | パース結果ヘッダー編集 |
| 見積日入力 | Input (Date) | `input-issue-date` | パース結果ヘッダー編集 |
| 取引先名入力 | Input (Text) | `input-vendor-name` | パース結果ヘッダー編集 |
| 合計金額入力 | Input (Number) | `input-total-amount` | パース結果ヘッダー編集 |
| 明細行追加ボタン | Button | `btn-add-item-row` | パース結果明細テーブル |
| 明細行削除ボタン | Button | `btn-delete-item-row-{index}` | パース結果明細テーブル各行 |
| DB保存ボタン | Button | `btn-save-to-db` | パース結果確認グリッド |
| 単価検索キーワード入力 | Input (Text) | `input-price-search-query` | 過去単価検索画面 |
| 単価検索実行ボタン | Button | `btn-execute-price-search` | 過去単価検索画面 |
| カート追加ボタン | Button | `btn-add-to-cart-{itemId}` | 検索結果明細行 |
| お気に入り登録/解除ボタン | Button | `btn-toggle-favorite-{itemId}` | 検索結果明細行 / お気に入り一覧 |
| お気に入り表示切替タブ | Button | `btn-tab-favorites` | 履歴検索画面 |
| 履歴検索表示切替タブ | Button | `btn-tab-history` | 履歴検索画面 |
| カートドロワー開閉 | Button | `btn-toggle-cart-drawer` | グローバルナビゲーション |
| 見積依頼書生成ボタン | Button | `btn-generate-estimate-request` | カート画面 / 帳票発行 |
| 発注書生成ボタン | Button | `btn-generate-purchase-order` | カート画面 / 帳票発行 |
| ユーザー設定保存ボタン | Button | `btn-save-user-settings` | 設定管理画面 |

---

## 5. PBI（プロダクトバックログアイテム）& テストケースIDマッピング

| PBI ID | 関連REQ | PBI名称 | 対応テストケースID | status |
| :--- | :--- | :--- | :--- | :--- |
| **PBI-001** | REQ-015, REQ-017 | Supabaseクライアント初期化と環境変数読込 | `TEST-001-ENV`, `TEST-002-CLIENT` | Completed |
| **PBI-002** | REQ-003, REQ-005, REQ-016 | ブラウザ内pdf.jsテキスト抽出プロトタイプ | `TEST-003-PDF-PARSE`, `TEST-004-CLIENT-ONLY` | Completed |
| **PBI-003** | REQ-002, REQ-006 | 重複ハッシュ判定およびDB永続化トランザクション | `TEST-005-HASH-DUP`, `TEST-006-DB-INSERT` | In Progress |
| **PBI-004** | REQ-004, REQ-018 | プレビュー・手動補正GUI（data-ai-id完備） | `TEST-007-UI-EDIT`, `TEST-008-AI-ID-CHECK` | In Progress |
| **PBI-005** | REQ-007, REQ-008 | 過去単価検索および買い物かご機能 | `TEST-009-SEARCH-FUZZY`, `TEST-010-CART-STATE` | Pending |
| **PBI-006** | REQ-009, REQ-010, REQ-011 | 日本語帳票（依頼書・発注書）PDF生成エンジン | `TEST-011-PDF-GEN-REQ`, `TEST-012-PDF-GEN-PO` | Pending |
| **PBI-007** | REQ-012 | 企業情報・取引先マスタのDB設定画面 | `TEST-013-SETTINGS-CRUD` | Pending |

## Loop 22 差分セクション (抽出結果のマークダウン出力とAI連携)

本ループ（抽出結果のMarkdown出力）においては、バックエンドのデータベーススキーマ（Supabase）やEntity、リレーションシップに対する変更・追加（データ設計の変更）は**発生しない**。
純粋なフロントエンド（GUI）の機能追加となるため、UI要素のID定義とPBIの追加のみを行う。

### 追加されるUI要素識別子 (`data-ai-id`)

| UI要素 | 種別 | `data-ai-id` | 画面・配置場所 |
| :--- | :--- | :--- | :--- |
| マークダウン出力ボタン | Button | `btn-copy-markdown` | パース結果確認グリッド/ヘッダー |

### 追加PBI
| PBI ID | 関連REQ | PBI名称 | 対応テストケースID | status |
| :--- | :--- | :--- | :--- | :--- |
| **PBI-008** | Loop 22 | PDFパース結果のMarkdownフォーマット出力機能 | `TEST-014-MD-EXPORT` | Completed |
