# Phase 3 モデリング・図解 (Modeling & Diagrams)

本ドキュメントは、Phase 2 のデータ設計および機能要件に基づき、システムのアーキテクチャ、データモデル（ER図）、および主要な処理フロー（シーケンス図）を可視化したものです。

## 1. システムアーキテクチャ図

モダンなServerless SPA構成（React 19 + Vite）とSupabase（BaaS）を組み合わせたアーキテクチャです。機密性の高い見積書PDFはサーバーへ送信されず、すべてクライアント（ブラウザ）内で完結して解析処理が行われます。

```mermaid
graph TD
    subgraph "Client (Browser SPA - React 19 + Vite)"
        UI_Upload["PDF DropZone (D&D)"]
        UI_Preview["Preview & Edit Grid (2画面)"]
        UI_Cart["Shopping Cart Drawer"]
        
        Logic_Parser["pdf.js Parser Engine"]
        Logic_Hash["SubtleCrypto (SHA-256)"]
        Logic_GenPDF["pdf-lib Generator Engine"]
        
        SupabaseClient["@supabase/supabase-js Client"]
        
        UI_Upload --> Logic_Parser
        UI_Upload --> Logic_Hash
        Logic_Parser --> UI_Preview
        UI_Preview --> UI_Cart
        UI_Cart --> Logic_GenPDF
        
        UI_Preview --> SupabaseClient
        UI_Cart --> SupabaseClient
    end
    
    subgraph "Supabase Cloud Platform (BaaS)"
        Auth["Supabase Auth"]
        
        subgraph "PostgreSQL Database"
            RLS["Row Level Security Gateway"]
            DB_Settings[(user_settings)]
            DB_Suppliers[(suppliers)]
            DB_Estimates[(estimates)]
            DB_EstimateItems[(estimate_items)]
            DB_Logs[(import_logs)]
            
            RLS --> DB_Settings
            RLS --> DB_Suppliers
            RLS --> DB_Estimates
            RLS --> DB_EstimateItems
            RLS --> DB_Logs
        end
        
        SupabaseClient --> Auth
        SupabaseClient --> RLS
    end
```

## 2. エンティティ・リレーションシップ図 (ER図)

Phase 2 で定義されたデータスキーマの相関関係を示します。全テーブルにおいて `user_id` をキーとしたRLSが適用され、テナント間のデータが完全に分離されます。

```mermaid
erDiagram
    users ||--|| user_settings : "1:1 configures"
    users ||--o{ suppliers : "1:N manages"
    users ||--o{ estimates : "1:N owns"
    users ||--o{ import_logs : "1:N generates"
    
    suppliers ||--o{ estimates : "1:N issues"
    estimates ||--|{ estimate_items : "1:N contains"
    
    users {
        uuid id PK
        string email
    }
    
    user_settings {
        uuidv7 id PK
        uuid user_id FK
        string company_name
        string status
        boolean isFuture
    }
    
    suppliers {
        uuidv7 id PK
        uuid user_id FK
        string name
        string code
        string status
        boolean isFuture
    }
    
    estimates {
        uuidv7 id PK
        uuid user_id FK
        uuidv7 supplier_id FK
        string document_hash UK
        int total_amount
        string status
        boolean isFuture
    }
    
    estimate_items {
        uuidv7 id PK
        uuidv7 estimate_id FK
        string product_name
        int quantity
        int unit_price
        int amount
        string status
        boolean isFuture
    }
    
    import_logs {
        uuidv7 id PK
        uuid user_id FK
        string document_hash
        string filename
        timestamp imported_at
        string status
        boolean isFuture
    }
```

## 3. シーケンス図: PDFアップロード〜解析〜保存フロー

ユーザーが見積書PDFをアップロードし、クライアントサイドで解析して重複チェックを経たのち、Supabaseへデータを保存するまでの一連の処理フローです。

```mermaid
sequenceDiagram
    actor User as 担当者
    participant UI as Browser (React App)
    participant Crypto as SubtleCrypto
    participant PDFJS as pdf.js
    participant Supabase as Supabase API
    participant DB as PostgreSQL (RLS)

    User->>UI: PDFをD&Dでアップロード
    UI->>Crypto: PDFファイルのSHA-256ハッシュ計算
    Crypto-->>UI: document_hash
    
    UI->>Supabase: 重複確認 (hash値で検索)
    Supabase->>DB: SELECT from estimates WHERE hash = ...
    DB-->>Supabase: 結果 (未登録)
    Supabase-->>UI: OK (重複なし)
    
    UI->>PDFJS: PDFファイルバイナリ引き渡し
    PDFJS-->>UI: 抽出されたテキスト・構造化データ
    
    UI->>UI: 正規化・明細データ組み立て (ヘッダー/明細)
    UI-->>User: 2画面プレビューに結果表示
    
    User->>UI: 必要に応じて単価・数量を編集
    User->>UI: 「保存」ボタン押下
    
    UI->>Supabase: estimates & estimate_items の保存 (Bulk Insert)
    Supabase->>DB: INSERT (RLS評価: user_id)
    DB-->>Supabase: 成功
    
    UI->>Supabase: import_logs に履歴保存
    Supabase->>DB: INSERT (hash, filename, etc)
    DB-->>Supabase: 成功
    Supabase-->>UI: 保存完了
    UI-->>User: サクセス通知
```
