# pdf-quotation-parser-web 自律エージェント実行指示書 (Phase 7: Execution Protocol)

<context>
## 【背景 & システム前提】
- **プロジェクト名**: `pdf-quotation-parser-web`
- **対象エージェント**: 汎用コーディングエージェント (Antigravity, Cursor, Cline 等)
- **実行モード**: 完全自律実行（全タスク連続実装・テスト自動検証・最終報告のみ）
- **正本タスクファイル**: ワークスペース直下 `tasks.md` (および `AI-Vault/Projects/pdf-quotation-parser-web/tasks.md`)
- **参照設計書**:
  - `docs/Phase1_要件定義.md` (Loop 22: PDF抽出結果Markdown出力 & AI連携基盤)
  - `docs/Phase2_ID・データ設計.md` (PBI-008, data-ai-id="btn-copy-markdown", TEST-014-MD-EXPORT)
  - `docs/Phase3_モデリング・図解.md` (SPA・クライアントパースアーキテクチャ)
  - `docs/Phase4_壁打ち・シミュレーション.md` (Loop 22 リスク対策: マスキング、制御文字サニタイズ、クリップボードフォールバック)
  - `docs/Phase5_トレーサビリティ検証.md` (RTM・品質ゲート判定)
  - `docs/Phase6_タスクリスト生成.md` (Task-001〜Task-038)
</context>

<instruction>
## 1. 完全自律実行プロトコル (Autonomous Execution Protocol)

### 1.1. タスクの読み込み
- 作業開始前に、必ずワークスペース直下の `tasks.md`（および `AI-Vault/Projects/pdf-quotation-parser-web/tasks.md`）を読み込む。
- 現在の進捗ステータス（未着手 `[ ]`, 進行中 `[/]`, 完了 `[x]`）を確認する。

### 1.2. 初期コンテキストのロード
- 実装対象に関連する Phase 1〜5 の仕様書（要件ID・データ構造・リスク・RTM）および既存のソースコード（`src/`, `src/__tests__/`）を漏れなく静的解析する。
- 破壊的変更を防止するため、既存テストスイート（Vitest / React Testing Library）の構成を把握する。

### 1.3. タスクの実行と状態更新
- `tasks.md` に定義されたDAG依存関係順に従い、上から順に未完了タスクを実行する。
- 着手時にチェックボックスを `[/]` (進行中) に更新。
- 単一責任の原則（アトミック原則）を守り、該当タスクのスコープ外の変更を混入させない。
- 完了条件（DoD）を満たしたら、直ちにチェックボックスを `[x]` (完了) に更新する。
- 更新時はワークスペース直下 `tasks.md` および `docs/Phase6_タスクリスト生成.md` の双方を確実に同期・上書き保存する。

### 1.4. 連続実行プロトコル
- 1タスク完了ごとにユーザーの個別承認を待たず、未完了タスクを上から順に自動で実装・検証・コミットする。
- チャット欄へのコード出力のみで終了することを厳禁とし、対象ファイルへ直接コードを書き出す。

### 1.5. エラーハンドリング・自己修復
- テスト失敗やビルドエラーが発生した場合は、ダミー値による症状隠蔽を禁じ、ログ・スタックトレースから根本原因を解析して自律的に修正・再テストを行う。
- 既存のテストケースをコメントアウト・削除して成功に見せかける行為を厳禁とする。

### 1.6. 最終レポート & Walkthrough
- すべてのタスクが完了（または致命的エラーで進行不能）した場合のみユーザーに報告し、最終成果物のWalkthroughを作成する。
</instruction>

---

## 2. 実行進捗ステータス & 検証結果

### 2.1. タスク実行状況
- **アトミックタスク総数**: 38 件 (Task-001 〜 Task-038)
- **完了済みタスク**: 38 件 (Task-001 〜 Task-038)
- **未着手タスク**: 0 件

| フェーズ | 対象タスク | 状態 | 検証結果 (DoD確認) |
| :--- | :--- | :---: | :--- |
| **Phase 6.1: Web SPA基盤 & テスト環境** | Task-001 〜 Task-003 | `[x]` | 初期化, Vitestセットアップ, 環境変数サニタイズ PASS |
| **Phase 6.2: クライアントPDFパース & 重複排除** | Task-004 〜 Task-007 | `[x]` | SHA-256ハッシュ, テキスト抽出, パース正規化 PASS |
| **Phase 6.3: UI/UX & ガードレール実装** | Task-008 〜 Task-013 | `[x]` | 5MB上限, スキャン検知, 離脱防止, data-ai-id付与 PASS |
| **Phase 6.4: Supabaseトランザクション永続化** | Task-014 〜 Task-016 | `[x]` | estimates/items/logs永続化, 非保存案内 PASS |
| **Phase 6.5: 過去単価検索 & 買い物かご** | Task-017 〜 Task-021 | `[x]` | カナ表記揺れ検索, カート同期, 帳票引き継ぎ PASS |
| **Phase 6.6: 日本語帳票生成エンジン** | Task-022 〜 Task-026 | `[x]` | pdf-libフォント埋込, 依頼書・発注書PDF生成 PASS |
| **Phase 6.7: マスタ管理 & Auth/RLS基盤** | Task-027 〜 Task-031 | `[x]` | user_settings, suppliers, product_master, Auth PASS |
| **Phase 6.8: 総合品質ゲート & リリース判定** | Task-032 〜 Task-033 | `[x]` | 全自動テスト PASS, RTM ゲート PASS |
| **Phase 6.9: PDF抽出結果Markdown出力 & AI連携基盤** | Task-034 〜 Task-038 | `[x]` | Markdownフォーマッタ, マスキング, サニタイズ, クリップボードUI, 統合テスト PASS (28/28) |

---

## 3. 現周自律実行指示 (Phase 6.9: Loop 22)

### 3.1. 実行対象タスク
1. **Task-034**: [Loop 22/PBI-008/Phase 4 SEC-002] Markdownフォーマッタ & サニタイズ・マスキング実装 (`src/lib/markdownFormatter.ts`)
2. **Task-035**: [Loop 22/PBI-008/TEST-014-MD-EXPORT] Markdownフォーマッタ単体テスト (`src/__tests__/markdownFormatter.test.ts`)
3. **Task-036**: [Loop 22/PBI-008/Phase 4 UX-003] クリップボードコピー & フォールバックUI実装 (`src/App.tsx`)
4. **Task-037**: [Loop 22/PBI-008/TEST-014-MD-EXPORT] UI統合 & クリップボードコピー自動テスト (`src/__tests__/app.test.tsx`)
5. **Task-038**: [Loop 22/総合検証] Phase 6.9 総合品質ゲート検証 (`npm test` & `npm run build`)

### 3.2. ガードレール & 制約遵守確認
- 新規UI要素に `data-ai-id="btn-copy-markdown"` を厳格に付与すること。
- 出力Markdownで個人名・メールアドレス等を `[MASKED]` 置換するセキュリティ要件を必ず組み込むこと。
- テーブル制御文字（`|`, \` 等）をサニタイズ・エスケープし、Markdown破壊を防ぐこと。
- 既存の22テストケースを破壊せず、常に `npm test` で全件PASSを維持すること。
- タスク完了ごとに `tasks.md` のチェックボックスを `[x]` に同期更新すること。
