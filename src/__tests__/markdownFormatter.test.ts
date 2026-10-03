import { describe, it, expect } from 'vitest';
import {
  formatQuotationToMarkdown,
  sanitizeMarkdownCell,
  maskSensitiveText,
} from '../lib/markdownFormatter';
import type { ParsedEstimateResult } from '../lib/parser';

describe('TEST-014-MD-EXPORT: markdownFormatter', () => {
  const sampleData: ParsedEstimateResult = {
    header: {
      estimate_number: 'EST-2026-001',
      issue_date: '2026-03-01',
      customer_name: '株式会社大平テック 朝海様',
      total_amount: 15400,
    },
    items: [
      {
        line_number: 1,
        maker_name: 'オムロン',
        item_name: 'リレー G2R-1-S | 仕様A',
        quantity: 10,
        unit: '個',
        unit_price: 1400,
        amount: 14000,
      },
      {
        line_number: 2,
        maker_name: 'ミスミ',
        item_name: '六角ボルト M5x15',
        quantity: 100,
        unit: '本',
        unit_price: 14,
        amount: 1400,
      },
    ],
    rawText: '見積番号: EST-2026-001\n担当: 田中太郎\n連絡先: tanaka@example.com\nTEL: 03-1234-5678',
  };

  it('1. 正常系パース結果から正しくMarkdownが生成されること', () => {
    const md = formatQuotationToMarkdown(sampleData, { maskSensitiveInfo: false });

    expect(md).toContain('# 見積書パース結果 (Quotation Parse Result)');
    expect(md).toContain('EST-2026-001');
    expect(md).toContain('株式会社大平テック 朝海様');
    expect(md).toContain('¥15,400');
    expect(md).toContain('オムロン');
    expect(md).toContain('リレー G2R-1-S \\| 仕様A'); // パイプがエスケープされていること
    expect(md).toContain('14,000');
    expect(md).toContain('## 3. 原文テキスト抜粋');
  });

  it('2. 機密情報（個人名・メールアドレス・電話番号等）がマスキングされること', () => {
    const rawMasked = maskSensitiveText('担当: 鈴木一郎 / suzuki@test.com / 03-9999-8888');
    expect(rawMasked).toContain('[MASKED_PERSON]');
    expect(rawMasked).toContain('[MASKED_EMAIL]');
    expect(rawMasked).toContain('[MASKED_TEL]');

    const md = formatQuotationToMarkdown(sampleData, { maskSensitiveInfo: true });

    // メール・TEL・個人宛名がマスクされていること
    expect(md).toContain('[MASKED_EMAIL]');
    expect(md).toContain('[MASKED_TEL]');
    expect(md).not.toContain('tanaka@example.com');
    expect(md).not.toContain('03-1234-5678');
  });

  it('3. サニタイズ処理によりMarkdownのテーブル破壊が防止されること', () => {
    const sanitized = sanitizeMarkdownCell('A | B | C\r\n2行目');
    expect(sanitized).toBe('A \\| B \\| C 2行目');
  });

  it('4. 欠損・未定義データ時にも例外を出さず安全に出力されること (Null安全性)', () => {
    const emptyData: any = {
      header: null,
      items: null,
      rawText: null,
    };

    expect(() => formatQuotationToMarkdown(emptyData)).not.toThrow();
    const md = formatQuotationToMarkdown(emptyData);
    expect(md).toContain('(明細なし)');
    expect(md).toContain('¥0');
  });

  it('5. 境界値・エッジケース（バッククォート制御文字・空文字列・オプショナル項目欠損）の安全描画', () => {
    const edgeData: ParsedEstimateResult = {
      header: {
        estimate_number: '',
        issue_date: '',
        customer_name: '',
        total_amount: 0,
      },
      items: [
        {
          line_number: undefined as any,
          maker_name: undefined,
          item_name: '型番未定品',
          quantity: 0,
          unit: '',
          unit_price: 0,
          amount: 0,
        },
      ],
      rawText: '```js\nalert("injection");\n```',
    };

    const md = formatQuotationToMarkdown(edgeData, { includeRawText: true, maskSensitiveInfo: true });
    // バッククォートがエスケープされていること
    expect(md).toContain('\\`\\`\\`');
    expect(md).not.toContain('\n```\n```');
    // maker_name 未定義時は "-" にフォールバック
    expect(md).toContain('| 1 | - | 型番未定品 | 0 |  | 0 | 0 |');
  });
});
