import { describe, it, expect } from 'vitest';
import { parseEstimateText } from '../lib/parser';

describe('TEST-003-PDF-PARSE: 見積テキストパース・正規化', () => {
  it('見積番号、発行日、宛名、合計金額、明細行を正しく抽出・パースできること', () => {
    const sampleText = `
      御見積書
      株式会社 ABC商事 御中
      見積番号: EST-202610-001
      発行日: 2026年10月03日
      合計金額: ¥150,000

      リレー MY4N-D2 10 個 5,000 50,000
      近接センサ E2E-X3D1 5 個 20,000 100,000
    `;

    const result = parseEstimateText(sampleText);

    expect(result.header.estimate_number).toBe('EST-202610-001');
    expect(result.header.issue_date).toBe('2026-10-03');
    expect(result.header.customer_name).toContain('株式会社 ABC商事');
    expect(result.header.total_amount).toBe(150000);
    expect(result.items.length).toBe(2);
    expect(result.items[0].item_name).toBe('リレー MY4N-D2');
    expect(result.items[0].quantity).toBe(10);
    expect(result.items[0].unit_price).toBe(5000);
    expect(result.items[0].amount).toBe(50000);
  });

  it('複数行に跨がる品名・型番・数量・金額レイアウトおよびメーカータグを正しくパースできること', () => {
    const multiLineText = `
      御見積書
      2026年1月8日
      ㈱大平テック 岩瀬産業株式会社
      小山工場 朝海様 小山機工営業所
      見積番号 ： 0010043758
      合計金額 ¥78,960
      品名・寸法・仕様 数量 単位 単 価 金 額 備 考
      <CKD>ﾘﾆｱｶﾞｲﾄﾞｼﾘﾝﾀﾞ
      1 個 35,740. 35,740 納期：約3週間
      LCR-6-30-F2H3-D-C1
      <CKD>小形ｺﾝﾊﾟｸﾄｼﾘﾝﾀﾞ
      2 個 21,610. 43,220 納期：約2週間
      MSDG-L-12-5-F2H3-D
    `;

    const result = parseEstimateText(multiLineText);

    expect(result.header.estimate_number).toBe('0010043758');
    expect(result.header.issue_date).toBe('2026-01-08');
    expect(result.header.customer_name).toContain('㈱大平テック');
    expect(result.header.customer_name).toContain('小山工場 朝海');
    expect(result.header.total_amount).toBe(78960);
    expect(result.items.length).toBe(2);

    expect(result.items[0].maker_name).toBe('CKD');
    expect(result.items[0].item_name).toBe('ﾘﾆｱｶﾞｲﾄﾞｼﾘﾝﾀﾞ LCR-6-30-F2H3-D-C1');
    expect(result.items[0].quantity).toBe(1);
    expect(result.items[0].unit_price).toBe(35740);
    expect(result.items[0].amount).toBe(35740);

    expect(result.items[1].maker_name).toBe('CKD');
    expect(result.items[1].item_name).toBe('小形ｺﾝﾊﾟｸﾄｼﾘﾝﾀﾞ MSDG-L-12-5-F2H3-D');
    expect(result.items[1].quantity).toBe(2);
    expect(result.items[1].unit_price).toBe(21610);
    expect(result.items[1].amount).toBe(43220);
  });
});
