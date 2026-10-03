# Phase 3: モデリング・図解 (Modeling & Architecture)

## 【背景・目的】
Phase 1要件定義およびPhase 2で確定した不変ID・型安全データ設計に基づき、Mermaid構文を用いてWeb SPA版システム全体構成、クライアントサイドPDF解析フロー、Supabase連携シーケンス、RLSアクセス制御境界、および状態遷移を視覚化し、アーキテクチャの整合性を検証・確定する。

---

## 1. Web SPA システム全体構成 / コンポーネント図

元PDFバイナリを一切サーバーやクラウドストレージへ送信せず、ブラウザ内（`pdf.js`）で解析を完結させた上で、構造化データのみを直接Supabase（PostgreSQL/Auth）へ送受信するゼロサーバー（Serverless SPA）構成とする。

```mermaid
graph TD
    subgraph "Browser / Client Environment (SPA - React 19 + Vite)"
        subgraph "UI Layer (data-ai-id Enabled)"
            DropZone["File Drop & Dialog<br/>(pdf-upload-dropzone)"]
            PreviewGrid["Preview & Edit Grid<br/>(txt-extracted-preview)"]
            CartState["Cart Drawer State<br/>(btn-toggle-cart-drawer)"]
            SettingsView["Settings Form<br/>(btn-save-user-settings)"]
        end

        subgraph "Client Core Logic"
            ParserEngine["pdf.js Worker Engine<br/>(Local In-Memory Parse)"]
            HashUtil["Client-Side SHA-256<br/>(SubtleCrypto Web API)"]
            PdfGen["@pdf-lib Generator<br/>(In-Browser Japanese PDF Gen)"]
            SupaClient["@supabase/supabase-js<br/>(Auth Session & REST API)"]
        end
    end

    subgraph "Supabase Cloud Platform (BaaS)"
        Auth["Supabase Auth<br/>(auth.users JWT Token)"]
        
        subgraph "PostgreSQL Database (RLS Enforced)"
            RLS["Row Level Security Gateway<br/>(auth.uid() = user_id)"]
            T_Users["users (Profile)"]
            T_Settings["user_settings"]
            T_Suppliers["suppliers"]
            T_Estimates["estimates"]
            T_Items["estimate_items"]
            T_Logs["import_logs"]
            T_Master["product_master"]
            T_Projects["procurement_projects"]
        end
    end

    DropZone -->|"PDF ArrayBuffer (In-Memory)"| ParserEngine
    DropZone -->|"Calculate SHA-256"| HashUtil
    ParserEngine -->|"Extracted Text Items"| PreviewGrid
    PreviewGrid -->|"Confirm & Clean Data"| SupaClient
    CartState -->|"Download Inbound Items"| PdfGen
    SettingsView -->|"Save Config"| SupaClient

    SupaClient <-->|"1. Sign-in & JWT Session"| Auth
    SupaClient -->|"2. Authenticated REST Calls"| RLS
    RLS --> T_Users
    RLS --> T_Settings
    RLS --> T_Suppliers
    RLS --> T_Estimates
    RLS --> T_Items
    RLS --> T_Logs
    RLS --> T_Master
    RLS --> T_Projects
```

---

## 2. 処理フロー / シーケンス図

### 2.1 PDF取り込み・解析・Supabase保存シーケンス (PBI-002, PBI-003, PBI-004)

```mermaid
sequenceDiagram
    autonumber
    actor User as "ユーザー"
    participant UI as "React SPA (UI)"
    participant Crypto as "Web Crypto API"
    participant Worker as "pdf.js Worker"
    participant Client as "Supabase Client"
    participant DB as "Supabase (PostgreSQL)"

    User->>UI: PDFをドロップ / 選択
    UI->>Crypto: ArrayBufferからSHA-256ハッシュ計算
    Crypto-->>UI: file_hash文字列 (64桁)

    UI->>Client: import_logsの重複確認 (file_hash)
    Client->>DB: SELECT id FROM import_logs WHERE file_hash = ?
    DB-->>Client: 検索結果
    Client-->>UI: 判定結果 (既存 / 新規)

    alt 既に登録済みの場合
        UI->>User: 重複警告表示 (スキップ案内)
    else 新規ファイルの場合
        UI->>Worker: ArrayBufferを転送 (ブラウザメモリ内)
        Worker-->>UI: 全ページからテキスト行を抽出
        UI->>UI: ヘッダー/明細パース & バリデーション実行
        UI->>User: プレビュー & 編集グリッド表示

        User->>UI: 内容確認・微修正後「DB保存」押下
        UI->>Client: トランザクション登録リクエスト (estimates, items, log)
        Client->>DB: INSERT into estimates & estimate_items & import_logs (WITH JWT)
        
        alt 新規製品が含まれる場合
            Client->>DB: INSERT into product_master (ON CONFLICT DO NOTHING)
        end

        DB-->>Client: 保存成功レスポンス
        Client-->>UI: 200 OK
        UI->>User: 保存完了トースト通知 (PDFバイナリはメモリ解放)
    end
```

### 2.2 帳票生成・カートフローシーケンス (PBI-005, PBI-006)

```mermaid
sequenceDiagram
    autonumber
    actor User as "ユーザー"
    participant SearchUI as "過去単価検索 / カート"
    participant PdfEngine as "ブラウザ内 pdf-lib"
    participant Supa as "Supabase DB"

    User->>SearchUI: 品名・メーカー名で単価検索
    SearchUI->>Supa: SELECT from estimate_items (RLS適用)
    Supa-->>SearchUI: 過去単価履歴データ
    User->>SearchUI: 対象明細を「買い物かご」へ追加

    User->>SearchUI: 「御見積依頼書」または「御発注書」作成指示
    SearchUI->>Supa: user_settings & suppliers情報取得
    Supa-->>SearchUI: 自社情報・取引先情報
    SearchUI->>PdfEngine: テンプレート・明細・フォントを渡してレンダリング
    PdfEngine-->>SearchUI: 生成されたPDF Blob
    SearchUI->>User: ブラウザ上で即時ダウンロード / プレビュー表示
```

---

## 3. 状態遷移図 (見積書取り込み・パースライフサイクル)

```mermaid
stateDiagram-v2
    [*] --> 待機状態: アプリ起動 (Authセッション確立)

    待機状態 --> ハッシュ検証中: PDFファイル選択 (Drag & Drop)
    
    ハッシュ検証中 --> 重複警告: DB内にfile_hashが存在
    重複警告 --> 待機状態: ユーザー確認・リセット
    
    ハッシュ検証中 --> クライアント解析中: 新規ファイル確定
    
    クライアント解析中 --> 解析エラー: 非対応形式 / 暗号化PDF
    解析エラー --> 待機状態: エラー通知・リセット
    
    クライアント解析中 --> プレビュー確認中: pdf.jsテキスト抽出完了
    
    プレビュー確認中 --> 待機状態: キャンセル (破棄)
    プレビュー確認中 --> DB保存中: ユーザー修正完了・保存実行
    
    DB保存中 --> 保存失敗: 通信エラー / RLS制約違反
    保存失敗 --> プレビュー確認中: 再試行可能状態
    
    DB保存中 --> 登録完了: estimates / items / logs 永続化
    登録完了 --> 待機状態: メモリ解放 (PDFデータ完全破棄)
```

---

## 4. エンティティERモデリング図 (PostgreSQL / Supabase Schema)

```mermaid
erDiagram
    users ||--o| user_settings : "1:1 所有"
    users ||--o{ suppliers : "1:N 登録"
    users ||--o{ estimates : "1:N 受領"
    users ||--o{ import_logs : "1:N 監査ログ"
    users ||--o{ product_master : "1:N マスタ管理"
    users ||--o{ procurement_projects : "1:N 案件起票"

    estimates ||--o{ estimate_items : "1:N (CASCADE)"
    estimates ||--o{ procurement_projects : "0..1 参照 (SET NULL)"
    suppliers ||--o{ procurement_projects : "0..1 宛先 (SET NULL)"

    users {
        uuid id PK "auth.users 参照"
        text email "ログインメール"
        timestamptz created_at
        timestamptz deleted_at
    }

    user_settings {
        uuid id PK
        uuid user_id FK
        text company_name "自社名"
        text tel
        text fax
        text email
        text person_in_charge "自社担当"
        text pdf_save_path "案内用パス"
    }

    suppliers {
        uuid id PK
        uuid user_id FK
        text name "商社名"
        text person_last_name
        text person_first_name
        text email
    }

    estimates {
        uuid id PK
        uuid user_id FK
        text estimate_number "見積番号"
        text status "draft/pending/approved等"
        date issue_date "発行日"
        text customer_name "宛名"
        bigint total_amount "合計金額"
        text file_name "原本ファイル名"
        text parsed_text "抽出テキスト全文"
        jsonb metadata "非定型拡張データ"
    }

    estimate_items {
        uuid id PK
        uuid user_id FK
        uuid estimate_id FK
        integer line_number "行番"
        text maker_name "メーカー"
        text item_name "品名仕様"
        integer quantity "数量"
        text unit "単位"
        bigint unit_price "単価"
        bigint amount "金額"
        bigint list_price "定価"
    }

    import_logs {
        uuid id PK
        uuid user_id FK
        text file_name "ファイル名"
        text file_hash UK "SHA-256ハッシュ"
        text status "SUCCESS/FAILED"
        timestamptz processed_at
    }

    product_master {
        uuid id PK
        uuid user_id FK
        text maker_name "メーカー"
        text item_name_and_spec "品名仕様"
        text default_unit "既定単位"
    }

    procurement_projects {
        uuid id PK
        uuid user_id FK
        text project_name "案件名"
        text status "進捗状態"
        text document_type "依頼書/発注書"
        uuid estimate_id FK
        uuid supplier_id FK
        bigint total_amount "発注金額"
    }
```

## Loop 22 差分セクション (抽出結果のマークダウン出力とAI連携)

本ループ（抽出結果のMarkdown出力機能）は、PDF抽出結果をUI層からテキスト化（Markdownフォーマット）してクリップボードにコピーする機能であり、データの流れや状態遷移、エンティティ関係のモデル（アーキテクチャ）への影響はありません。
そのため、本フェーズ（モデリング・図解）におけるシステム構成図、シーケンス図、ステートマシン図、ER図への変更・追加は発生しません。
