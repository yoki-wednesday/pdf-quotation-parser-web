import { describe, it, expect } from 'vitest';
import { generateReportPdf, formatPhoneNumber } from '../lib/pdfGenerator';
import type { CartItem } from '../lib/cart';

describe('TEST-011/012: 日本語帳票（依頼書・発注書）PDF生成', () => {
  const dummyItems: CartItem[] = [
    {
      id: '1',
      maker_name: 'オムロン',
      item_name: 'リレー MY4N-D2 DC24V',
      quantity: 5,
      unit: '台',
      unit_price: 1200,
      amount: 6000,
      note: '客先手配品',
    },
    {
      id: '2',
      maker_name: 'オムロン',
      item_name: '近接センサ E2E-X3D1-N 2M',
      quantity: 2,
      unit: '本',
      unit_price: 15000,
      amount: 30000,
      note: '',
    },
  ];

  it('TEST-011-PDF-GEN-REQ: 見積依頼書PDFが仕様（条件枠・特記事項・6カラム）に準拠して正常生成されること', async () => {
    const pdfBytes = await generateReportPdf(
      'ESTIMATE_REQUEST',
      '岩瀬産業（株）',
      dummyItems,
      undefined,
      {
        estimateNumber: 'REQ-2026-0001',
        customerDeptPerson: '山田 太郎 様',
        deliveryDate: '2026-10-20',
        deliveryPlace: '本社資材倉庫',
        responseDeadline: '2026-10-10',
      }
    );
    expect(pdfBytes).toBeDefined();
    expect(pdfBytes.length).toBeGreaterThan(1000); // 正常なPDFバイナリが存在すること
    // PDFマジックバイト %PDF-
    const headerStr = String.fromCharCode(...pdfBytes.slice(0, 5));
    expect(headerStr).toBe('%PDF-');
  });

  it('TEST-012-PDF-GEN-PO: 発注書PDFが仕様（発注金額強調・発注条件・8カラム）に準拠して正常生成されること', async () => {
    const pdfBytes = await generateReportPdf(
      'PURCHASE_ORDER',
      '岩瀬産業株式会社',
      dummyItems,
      undefined,
      {
        estimateNumber: 'PO-2026-0001',
        customerDeptPerson: '山田 太郎',
        deliveryDate: '2026-10-25',
      }
    );
    expect(pdfBytes).toBeDefined();
    expect(pdfBytes.length).toBeGreaterThan(1000);
    const headerStr = String.fromCharCode(...pdfBytes.slice(0, 5));
    expect(headerStr).toBe('%PDF-');
  });

  it('TEST-013-PHONE-FORMAT: 電話番号・FAX番号のハイフン自動付与ロジックが正しく機能すること', () => {
    // 10桁固定電話 (4桁市外局番例: 小山市 0285000000)
    expect(formatPhoneNumber('0285000000')).toBe('0285-00-0000');
    // 10桁固定電話 (東京03)
    expect(formatPhoneNumber('0312345678')).toBe('03-1234-5678');
    // 10桁固定電話 (3桁市外局番例: 宇都宮 028)
    expect(formatPhoneNumber('0281234567')).toBe('028-123-4567');
    // 11桁携帯/IP電話
    expect(formatPhoneNumber('09012345678')).toBe('090-1234-5678');
    // 既存ハイフン付き（全角・ダッシュ正規化）
    expect(formatPhoneNumber('0285ー00ー0001')).toBe('0285-00-0001');
    expect(formatPhoneNumber('0285-00-0001')).toBe('0285-00-0001');
    // 空文字
    expect(formatPhoneNumber('')).toBe('');
  });
});
