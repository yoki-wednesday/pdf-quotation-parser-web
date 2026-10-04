/**
 * 監査メタデータログ記録モジュール (REQ-13-002, Phase 4 SEC 2-4)
 * DB保存を行わない手入力明細帳票の出力時における監査証跡バイパスを防止するため、
 * 実行メタデータ（帳票種別、日時、件数等）を安全に記録・出力する。
 * ※機密情報（認証トークン・個人情報等）のハードコードは厳禁。
 */

export interface DocumentExportAuditMetadata {
  /** 帳票種別: 見積依頼書または発注書 */
  documentType: 'ESTIMATE_REQUEST' | 'PURCHASE_ORDER';
  /** 出力先取引先名 */
  vendorName: string;
  /** 明細品目数 */
  itemCount: number;
  /** 合計金額 (発注時) */
  totalAmount?: number;
  /** 作成元種別: 'MANUAL_CART' (手入力) | 'HISTORICAL_CART' (過去取込明細) */
  sourceType: 'MANUAL_CART' | 'HISTORICAL_CART';
  /** 出力実行タイムスタンプ (ISO) */
  timestamp: string;
}

/**
 * 帳票出力実行時の監査メタデータを記録する
 */
export function recordDocumentExportAudit(metadata: DocumentExportAuditMetadata): void {
  // REQ-13-002: 監査ログ記録処理（将来のバックエンドAPI連携に向けた軽量モック/ハンドラ）
  const logEntry = {
    event: 'DOCUMENT_EXPORT_AUDIT',
    requirementId: 'REQ-13-002',
    timestamp: metadata.timestamp || new Date().toISOString(),
    documentType: metadata.documentType,
    vendorName: metadata.vendorName,
    itemCount: metadata.itemCount,
    totalAmount: metadata.totalAmount ?? 0,
    sourceType: metadata.sourceType,
  };

  // セキュアにコンソール出力（本番環境ではAPI POST等に置換可能）
  console.info('[AUDIT_LOG]', JSON.stringify(logEntry));

  try {
    // セッション単位での直近出力ログ記録 (最新10件)
    const STORAGE_KEY = 'pdf_quotation_audit_logs';
    const existingRaw = sessionStorage.getItem(STORAGE_KEY);
    const logs = existingRaw ? JSON.parse(existingRaw) : [];
    logs.unshift(logEntry);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(0, 10)));
  } catch (err) {
    console.warn('Failed to persist audit log to sessionStorage:', err);
  }
}
