# Phase 5 トレーサビリティ検証 (Traceability Verification)

本ドキュメントは、Phase 1〜4で策定された要件ID（REQ-22-xxx）と、設計・実装コンポーネント・テストコードの整合性を双方向トレーサビリティマトリクス（RTM）により検証した結果をまとめたものです。

---

## 1. トレーサビリティマトリクス (RTM)

| 要件ID | 機能ID | 実装コンポーネント / ファイル | テストケース / ファイル | 充足状態 |
| :--- | :--- | :--- | :--- | :--- |
| **REQ-22-001** | FUNC-PARSER | `src/lib/parser.ts`<br>`src/App.tsx` | `src/__tests__/parser.test.ts` | 充足 (PASS) |
| **REQ-22-002** | FUNC-HASH-CHECK | `src/lib/hash.ts`<br>`src/App.tsx` | `src/__tests__/hash.test.ts`<br>`src/__tests__/app_coverage.test.tsx` | 充足 (PASS) |
| **REQ-22-003** | FUNC-PREVIEW-UI | `src/App.tsx` (プレビューグリッド領域) | `src/__tests__/app.test.tsx`<br>`src/__tests__/components.test.tsx` | 充足 (PASS) |
| **REQ-22-004** | FUNC-EDIT-GRID | `src/App.tsx` (明細編集・再計算) | `src/__tests__/components.test.tsx`<br>`src/__tests__/app.test.tsx` | 充足 (PASS) |
| **REQ-22-005** | FUNC-SEARCH-FAV | `src/components/PriceSearch.tsx`<br>`src/lib/search.ts`<br>`src/lib/favorites.ts` | `src/__tests__/search.test.ts`<br>`src/__tests__/favorites.test.ts` | 充足 (PASS) |
| **REQ-22-006** | FUNC-CART | `src/components/CartDrawer.tsx`<br>`src/lib/cart.ts` | `src/__tests__/cart.test.ts` | 充足 (PASS) |
| **REQ-22-007** | FUNC-PDF-GEN | `src/components/DocumentModal.tsx`<br>`src/lib/pdfGenerator.ts` | `src/__tests__/pdfGenerator.test.ts` | 充足 (PASS) |
| **REQ-22-008** | FUNC-AI-MD | `src/lib/markdownFormatter.ts`<br>`src/App.tsx` | `src/__tests__/markdownFormatter.test.ts`<br>`src/__tests__/app_markdown.test.tsx` | 充足 (PASS) |
| **REQ-22-009** | FUNC-MASTER-MGMT | `src/components/SettingsModal.tsx`<br>`src/components/SupplierMaster.tsx` | `src/__tests__/settings.test.ts` | 充足 (PASS) |
| **REQ-22-010** | FUNC-AUTH-RLS | `src/components/AuthModal.tsx`<br>`src/lib/supabase.ts` | `src/__tests__/app_coverage.test.tsx` | 充足 (PASS) |

---

## 2. 未実装 / 未検証の要件ID一覧 (COVERAGE_GAP レポート)

- **検出された COVERAGE_GAP**: **0件**
- **検証結果**: 現行リリース対象スコープ（MUST要件、Completed、非Future）に定義されたすべての要件（REQ-22-001 〜 REQ-22-010）について、対応する実装ファイルおよびユニット/統合テストが存在し、テスト実行（全12ファイル・38テスト）において100%パスを確認しました。

---

## 3. 今回検証対象外要件一覧 (Future / Pending スコープ)

> [!WARNING]
> **認知漏れ防止警告 (Phase 4反映)**: 以下の要件は現行スプリント/リリースの検証対象外ですが、次期計画において実装およびテストの紐付けが必須となります。

| 要件ID | 名称 | 優先度 | status | isFuture | 除外理由 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-22-011** | パーサー分離アーキテクチャ | SHOULD | Pending | false | 複数商社プラグイン化は次期リファクタリングタスクとして保留中のため対象外。 |
| **REQ-22-012** | Gmail API連携 | SHOULD | Future | true | 外部サービス連携は将来拡張要件として定義されているため対象外。 |

---

## 4. 仕様と成果物の間の乖離・ブレの指摘

1. **データ識別子属性 (`data-ai-id`) の付与範囲**:
   - `src/App.tsx` および `src/components/CartDrawer.tsx` において、`btn-generate-estimate-request` や `btn-upload-pdf` 等の主要アクション要素には `data-ai-id` が正しく付与されている。
   - 新規作成されるUI要素についても、Phase 2 のUI要素命名規則（Kebab-case）に準拠した属性付与の徹底が必要。
2. **監査ログの記録範囲**:
   - 現状の `import_logs` は取り込み時のPDFファイルハッシュ記録を中心としており、帳票エクスポート時の追跡ログ（Phase 4 で指摘された監査証跡バイパスリスク）は未実装。

---

## 5. 最終品質ゲート判定

- **判定**: **PASS**
- **判定理由**:
  - 対象スコープ（MUSTかつCompleted、非Future）の全要件（REQ-22-001 〜 REQ-22-010）に実装およびテストコードが1:1または1:Nで完全に紐付いている。
  - 全自動テスト（Vitest 38件）がオールグリーンで通過。
  - Pending/Future要件（REQ-22-011, REQ-22-012）は境界ロジックに従い正しく除外判定されている。

---

## Loop 2 差分セクション

### 1. トレーサビリティマトリクス (Loop 2 追加要件)

| 要件ID | 機能ID | 実装コンポーネント / ファイル | テストケース / ファイル | 充足状態 |
| :--- | :--- | :--- | :--- | :--- |
| **REQ-22-013** | FUNC-NEW-DOC-CART | `src/components/CartDrawer.tsx`<br>`src/lib/cart.ts`<br>`src/components/DocumentModal.tsx`<br>`src/lib/auditLogger.ts` | `src/__tests__/cart_manual.test.tsx` (全7テスト) | **充足 (PASS)** |

### 2. 未実装 / 未検証の要件ID一覧 (COVERAGE_GAP レポート - Loop 2)

- **Loop 2 検出 COVERAGE_GAP**: **0件**
- **判定理由**: REQ-22-013（新規帳票作成 / カート拡張）は実装コンポーネントおよびユニット/統合テスト（`cart_manual.test.tsx`）が作成され、全項目PASSが確認されました。

### 3. 今回検証対象外要件一覧 (Loop 2 スコープ)

| 要件ID | 名称 | 優先度 | status | isFuture | 実装状況 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-22-011** | パーサー分離アーキテクチャ | SHOULD | Pending | false | 複数商社プラグイン化（次期タスク保留中） |
| **REQ-22-012** | Gmail API連携 | SHOULD | Future | true | 将来拡張要件 |

### 4. 仕様と成果物の間の乖離・ブレの指摘 (Loop 2)

- **指摘事項**: なし（整合完了）。
- **Phase 4 リスク対策反映**:
  - `localStorage` による手入力下書きのオートセーブおよび `beforeunload` イベントによる離脱警告ガードを実装。
  - 出力実行時に `recordDocumentExportAudit` (REQ-13-002) による監査メタデータ記録を実装。
  - 手入力明細の場合にDB保存をバイパスし、完全メモリ完結ポリシーを遵守。

### 5. 最終品質ゲート判定 (Loop 2)

- **判定**: **PASS**
- **判定理由**:
  - 新規要件 REQ-22-013 が完全に実装・検証され、テストスイート（全13ファイル・45テスト）が100%グリーンでパス。
  - 既存機能のリグレッションは0件。型チェック（`tsc --noEmit`）も完全通過。
