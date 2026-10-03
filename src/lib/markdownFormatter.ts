import type { ParsedEstimateResult } from './parser';

export interface MarkdownFormatOptions {
  /** 機密情報（個人名・メール・電話番号等）を [MASKED] に置換するかどうか (既定: true) */
  maskSensitiveInfo?: boolean;
  /** 原文テキストの抜粋を含めるかどうか (既定: true) */
  includeRawText?: boolean;
}

/**
 * Markdownの表破壊・インジェクションを防止するためのサニタイズ関数
 */
export function sanitizeMarkdownCell(text: string | null | undefined): string {
  if (text == null) return '';
  // パイプ文字と改行をエスケープ
  return String(text)
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
    .trim();
}

/**
 * 機密情報（個人名パターン、メールアドレス、電話番号等）のマスキング処理
 */
export function maskSensitiveText(text: string | null | undefined): string {
  if (text == null) return '';
  let result = String(text);

  // メールアドレスのマスキング
  result = result.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[MASKED_EMAIL]');

  // 電話・FAX番号のマスキング (例: 03-1234-5678, 0285-12-3456)
  result = result.replace(/\b\d{2,4}[-(]\d{2,4}[-)]\d{3,4}\b/g, '[MASKED_TEL]');

  // 個人宛名パターン（例: 「朝海様」「山田 太郎 様」「担当: 鈴木」など）
  result = result.replace(/(?<=(?:株式会社|㈱|有限会社|㈲)[^\s]+\s+)([^\s]+?)(?=\s*様|\s*殿)/g, '[MASKED_PERSON]');
  result = result.replace(/(?:担当|ご担当|窓口)[\s:：]*([^\s,]+)/g, '担当: [MASKED_PERSON]');

  return result;
}

/**
 * パース結果（ヘッダー・明細・生テキスト）をAIエージェント向け構造化Markdownに変換する関数
 */
export function formatQuotationToMarkdown(
  parsed: ParsedEstimateResult,
  options: MarkdownFormatOptions = {}
): string {
  const { maskSensitiveInfo = true, includeRawText = true } = options;

  const header = parsed?.header ?? {
    estimate_number: '',
    issue_date: '',
    customer_name: '',
    total_amount: 0,
  };
  const items = parsed?.items ?? [];
  const rawText = parsed?.rawText ?? '';

  // マスキング適用ヘルパー
  const processField = (val: string | null | undefined): string => {
    let s = val ?? '';
    if (maskSensitiveInfo) {
      s = maskSensitiveText(s);
    }
    return sanitizeMarkdownCell(s);
  };

  const formattedTotal = Number(header.total_amount ?? 0).toLocaleString();
  const customerName = processField(header.customer_name);
  const estimateNumber = processField(header.estimate_number);
  const issueDate = processField(header.issue_date);

  let md = `# 見積書パース結果 (Quotation Parse Result)\n\n`;

  // 1. ヘッダー情報テーブル
  md += `## 1. ヘッダー情報\n\n`;
  md += `| 項目 | 抽出値 |\n`;
  md += `| :--- | :--- |\n`;
  md += `| 見積番号 | ${estimateNumber} |\n`;
  md += `| 発行日 | ${issueDate} |\n`;
  md += `| 宛名・得意先 | ${customerName} |\n`;
  md += `| 合計金額 | ¥${formattedTotal} |\n\n`;

  // 2. 明細一覧テーブル
  md += `## 2. 明細一覧 (${items.length}件)\n\n`;
  md += `| No. | メーカー | 品名・型番 / 仕様 | 数量 | 単位 | 単価 (円) | 金額 (円) |\n`;
  md += `| :---: | :--- | :--- | ---: | :---: | ---: | ---: |\n`;

  if (items.length === 0) {
    md += `| - | - | (明細なし) | - | - | - | - |\n`;
  } else {
    items.forEach((item, idx) => {
      const lineNo = item.line_number ?? idx + 1;
      const maker = processField(item.maker_name ?? '-');
      const itemName = processField(item.item_name ?? '');
      const qty = item.quantity ?? 1;
      const unit = processField(item.unit ?? '個');
      const unitPrice = Number(item.unit_price ?? 0).toLocaleString();
      const amount = Number(item.amount ?? 0).toLocaleString();

      md += `| ${lineNo} | ${maker} | ${itemName} | ${qty} | ${unit} | ${unitPrice} | ${amount} |\n`;
    });
  }
  md += `\n`;

  // 3. 原文テキストの抜粋コンテキスト
  if (includeRawText && rawText.trim().length > 0) {
    let sanitizedRaw = rawText;
    if (maskSensitiveInfo) {
      sanitizedRaw = maskSensitiveText(sanitizedRaw);
    }
    // バッククォートのエスケープ
    sanitizedRaw = sanitizedRaw.replace(/```/g, '\\`\\`\\`');

    md += `## 3. 原文テキスト抜粋\n\n`;
    md += `\`\`\`text\n${sanitizedRaw.trim()}\n\`\`\`\n`;
  }

  return md;
}
