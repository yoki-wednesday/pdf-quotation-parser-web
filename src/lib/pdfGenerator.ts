import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, type PDFFont, rgb } from 'pdf-lib';
import type { CartItem } from './cart';

export interface CompanyInfo {
  name: string;
  address: string;
  tel: string;
  fax: string;
  email: string;
  personInCharge: string;
}

export const DEFAULT_COMPANY_INFO: CompanyInfo = {
  name: '株式会社 大平テック',
  address: '〒323-0811 栃木県小山市土塔249-3',
  tel: '0285-00-0000',
  fax: '0285-00-0001',
  email: 'info@example.com',
  personInCharge: '購買担当',
};

export interface ReportPdfOptions {
  estimateNumber?: string;
  issueDate?: string;
  deliveryDate?: string;
  deliveryPlace?: string;
  responseDeadline?: string;
  customerDeptPerson?: string;
}

let cachedFontBytes: Uint8Array | null = null;

/**
 * 日本語フォントバイナリをロードする（Node/ブラウザ両対応）
 */
async function loadFontBytes(): Promise<Uint8Array | null> {
  if (cachedFontBytes) return cachedFontBytes;

  // 1. Node.js環境（テスト等）の場合
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const localCandidates = [
        path.resolve(process.cwd(), 'public/fonts/yumin.ttf'),
        'C:\\Windows\\Fonts\\yumin.ttf',
        'C:\\Windows\\Fonts\\yumindb.ttf',
        'C:\\Windows\\Fonts\\yuminl.ttf',
      ];
      for (const p of localCandidates) {
        if (fs.existsSync(p)) {
          cachedFontBytes = new Uint8Array(fs.readFileSync(p));
          return cachedFontBytes;
        }
      }
    } catch {
      // Node環境のフォールバック
    }
  }

  // 2. ブラウザ環境の場合 (fetch)
  if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
    try {
      const resp = await fetch('/fonts/yumin.ttf');
      if (resp.ok) {
        const buf = await resp.arrayBuffer();
        cachedFontBytes = new Uint8Array(buf);
        return cachedFontBytes;
      }
    } catch (e) {
      console.warn('Failed to fetch font from public/fonts:', e);
    }
  }

  return null;
}

/**
 * 日本の電話番号・FAX番号にハイフンを自動付与・正規化する
 * （例: 0285000000 -> 0285-00-0000, 0312345678 -> 03-1234-5678, 09012345678 -> 090-1234-5678）
 */
export function formatPhoneNumber(raw?: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  // 既にハイフンが含まれている場合は全角ハイフン・ダッシュを半角に正規化して返す
  if (trimmed.includes('-') || trimmed.includes('ー') || trimmed.includes('―')) {
    return trimmed.replace(/[ー―－]/g, '-');
  }

  // 数字のみ抽出
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return trimmed;

  // 11桁 (携帯・IP電話: 090, 080, 070, 050)
  if (digits.length === 11) {
    return digits.replace(/^(0[5789]0)(\d{4})(\d{4})$/, '$1-$2-$3');
  }

  // 10桁 (固定電話)
  if (digits.length === 10) {
    // 東京03, 大阪06 (市外局番2桁)
    if (/^0[36]/.test(digits)) {
      return digits.replace(/^(0[36])(\d{4})(\d{4})$/, '$1-$2-$3');
    }
    // 主要都市市外局番3桁 (011, 022, 045, 052, 075, 078, 082, 092, 048, 044, 043, 025, 028, 029等)
    // 4桁局番例: 小山市 0285-XX-XXXX
    if (/^0(1[1-9]|2[2-9]|4[2-9]|5[2-9]|7[2-9]|8[2-9]|9[2-9])\d/.test(digits)) {
      // 0285などの4桁市外局番判定
      if (/^0285/.test(digits)) {
        return digits.replace(/^(0285)(\d{2})(\d{4})$/, '$1-$2-$3');
      }
      return digits.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3');
    }
    // 一般的な4桁市外局番 (0XXX-XX-XXXX)
    return digits.replace(/^(\d{4})(\d{2})(\d{4})$/, '$1-$2-$3');
  }

  return trimmed;
}

/**
 * 日本の商習慣に適合した帳票PDFを生成する（A4縦型レイアウト仕様準拠）
 */
export async function generateReportPdf(
  type: 'ESTIMATE_REQUEST' | 'PURCHASE_ORDER',
  vendorName: string,
  items: CartItem[],
  companyInfo: CompanyInfo = DEFAULT_COMPANY_INFO,
  options: ReportPdfOptions = {}
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  // fontkit登録 & フォント埋め込み
  const fk = (fontkit as unknown as { default?: typeof fontkit }).default || fontkit;
  pdfDoc.registerFontkit(fk);

  const fontBytes = await loadFontBytes();
  let font: PDFFont;

  if (fontBytes) {
    try {
      font = await pdfDoc.embedFont(fontBytes, { subset: true });
    } catch {
      font = await pdfDoc.embedFont(fontBytes, { subset: false });
    }
  } else {
    throw new Error('Japanese font could not be loaded for embedding.');
  }

  // 1. 基本仕様・用紙規格（A4 縦: 595.28 pt × 841.89 pt）
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  const marginLeft = 40.0;
  const contentWidth = 515.28; // width 595.28 - 2 * 40.0

  // カラーパレット
  const navyColor = rgb(0.15, 0.22, 0.38);
  const tableHeaderBg = rgb(0.2, 0.3, 0.5);
  const textColor = rgb(0.1, 0.1, 0.1);
  const lightGrayBg = rgb(0.97, 0.98, 0.99);
  const borderColor = rgb(0.85, 0.85, 0.85);
  const whiteColor = rgb(1, 1, 1);

  // 3.1 管理番号 & 発行日 (右上上部)
  const isEstimate = type === 'ESTIMATE_REQUEST';
  const rawDocNo = options.estimateNumber || `${isEstimate ? 'REQ-' : 'PO-'}${Date.now().toString().slice(-6)}`;
  const labelDocNo = isEstimate ? `依頼番号: ${rawDocNo}` : `発注番号: ${rawDocNo}`;

  let issueDateStr = options.issueDate;
  if (!issueDateStr) {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    issueDateStr = `${yyyy}-${mm}-${dd}`;
  }
  const labelIssueDate = `発行日   : ${issueDateStr}`;

  const labelDocNoWidth = font.widthOfTextAtSize(labelDocNo, 9);
  const labelIssueDateWidth = font.widthOfTextAtSize(labelIssueDate, 9);
  const rightMarginX = width - marginLeft; // 555.28 pt

  page.drawText(labelDocNo, {
    x: rightMarginX - labelDocNoWidth,
    y: height - 42,
    size: 9,
    font,
    color: textColor,
  });
  page.drawText(labelIssueDate, {
    x: rightMarginX - labelIssueDateWidth,
    y: height - 54,
    size: 9,
    font,
    color: textColor,
  });

  // 3.1 表題 (中央・太字風描画)
  const title = isEstimate ? '御 見 積 依 頼 書' : '御 発 注 書';
  const titleSize = 20;
  const titleWidth = font.widthOfTextAtSize(title, titleSize);
  const titleX = (width - titleWidth) / 2;
  const titleY = height - 75;

  // ほんの少しずらして太字風二重描画
  page.drawText(title, {
    x: titleX,
    y: titleY,
    size: titleSize,
    font,
    color: navyColor,
  });
  page.drawText(title, {
    x: titleX + 0.4,
    y: titleY,
    size: titleSize,
    font,
    color: navyColor,
  });

  // 3.2 宛先表記 (左側)
  let formattedVendor = vendorName ? vendorName.replace(/（株）/g, '株式会社 ') : '';
  if (formattedVendor && !formattedVendor.includes('御中')) {
    formattedVendor = `${formattedVendor.trim()} 御中`;
  }

  let formattedPerson = options.customerDeptPerson ? options.customerDeptPerson.trim() : '';
  if (formattedPerson) {
    // プレフィックスの「ご担当:」や末尾の「様」を除去
    let rawName = formattedPerson.replace(/^ご担当\s*[:：]?\s*/, '').replace(/[ 　]*様$/, '').trim();
    // フルネーム（空白区切り）の場合は姓のみ抽出
    const lastName = rawName.split(/[\s　]+/)[0] || rawName;
    formattedPerson = `ご担当: ${lastName} 様`;
  }

  let leftY = height - 110;
  if (formattedVendor) {
    page.drawText(formattedVendor, {
      x: marginLeft,
      y: leftY,
      size: 13,
      font,
      color: textColor,
    });
    leftY -= 18;
  }
  if (formattedPerson) {
    page.drawText(formattedPerson, {
      x: marginLeft,
      y: leftY,
      size: 10,
      font,
      color: textColor,
    });
    leftY -= 16;
  }

  // 3.3 自社情報 (右側: 右マージン基準で各行右寄せ描画)
  let rightY = height - 105;

  const drawCompanyLine = (text: string, size: number) => {
    if (!text) return;
    const textW = font.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: rightMarginX - textW,
      y: rightY,
      size,
      font,
      color: textColor,
    });
  };

  drawCompanyLine(companyInfo.name, 10);
  rightY -= 14;

  drawCompanyLine(companyInfo.address, 8.5);
  rightY -= 13;

  const formattedTel = formatPhoneNumber(companyInfo.tel);
  const formattedFax = formatPhoneNumber(companyInfo.fax);
  const telFaxLine = [
    formattedTel ? `TEL: ${formattedTel}` : '',
    formattedFax ? `FAX: ${formattedFax}` : '',
  ].filter(Boolean).join(' / ');

  if (telFaxLine) {
    drawCompanyLine(telFaxLine, 8.5);
    rightY -= 13;
  }

  if (companyInfo.email) {
    drawCompanyLine(`MAIL: ${companyInfo.email}`, 8.5);
    rightY -= 13;
  }

  if (companyInfo.personInCharge) {
    drawCompanyLine(`担当: ${companyInfo.personInCharge}`, 8.5);
    rightY -= 13;
  }

  // 4.1 挨拶文
  let cursorY = Math.min(leftY - 10, rightY - 8);
  page.drawText('拝啓 貴社におかれましては益々ご隆盛のこととお慶び申し上げます。', {
    x: marginLeft,
    y: cursorY,
    size: 9,
    font,
    color: textColor,
  });
  cursorY -= 14;

  const greeting2 = isEstimate
    ? '下記の通り、お見積りをお願い申し上げます。'
    : '下記の通りご発注申し上げます。';
  page.drawText(greeting2, {
    x: marginLeft,
    y: cursorY,
    size: 9,
    font,
    color: textColor,
  });
  cursorY -= 18;

  // 4.2 発注金額表記（発注書のみ）
  const totalAmount = items.reduce((acc, it) => acc + (it.amount || (it.quantity * it.unit_price) || 0), 0);
  if (!isEstimate) {
    const totalAmountText = `ご発注金額: ¥${totalAmount.toLocaleString()} 円`;
    page.drawText(totalAmountText, {
      x: marginLeft,
      y: cursorY,
      size: 13,
      font,
      color: navyColor,
    });

    const amtWidth = font.widthOfTextAtSize(totalAmountText, 13);
    page.drawLine({
      start: { x: marginLeft, y: cursorY - 3 },
      end: { x: marginLeft + amtWidth + 10, y: cursorY - 3 },
      thickness: 1.5,
      color: navyColor,
    });
    cursorY -= 20;
  }

  // 4.3 条件枠 (薄グレー背景 0.5pt 枠線)
  const conditionBoxHeight = isEstimate ? 68 : 56;
  page.drawRectangle({
    x: marginLeft,
    y: cursorY - conditionBoxHeight,
    width: contentWidth,
    height: conditionBoxHeight,
    color: lightGrayBg,
    borderColor: borderColor,
    borderWidth: 0.5,
  });

  const condTextX = marginLeft + 10;
  let condTextY = cursorY - 14;

  const deliveryDateVal = options.deliveryDate || (isEstimate ? '貴社通常納期' : '貴社標準納期');
  const deliveryPlaceVal = options.deliveryPlace || `${companyInfo.name}（${companyInfo.address}）`;

  if (isEstimate) {
    page.drawText(`【見積条件】`, { x: condTextX, y: condTextY, size: 8.5, font, color: navyColor });
    condTextY -= 12;
    page.drawText(`・希望納期 : ${deliveryDateVal}`, { x: condTextX, y: condTextY, size: 8.5, font, color: textColor });
    condTextY -= 12;
    page.drawText(`・納入場所 : ${deliveryPlaceVal}`, { x: condTextX, y: condTextY, size: 8.5, font, color: textColor });
    condTextY -= 12;
    const deadlineVal = options.responseDeadline ? `・回答期限 : ${options.responseDeadline}   ` : '';
    page.drawText(`${deadlineVal}・提示条件 : 金額は税別（税抜）にてご提示願います。`, {
      x: condTextX,
      y: condTextY,
      size: 8.5,
      font,
      color: textColor,
    });
  } else {
    page.drawText(`【発注条件】`, { x: condTextX, y: condTextY, size: 8.5, font, color: navyColor });
    condTextY -= 13;
    page.drawText(`・希望納期 : ${deliveryDateVal}`, { x: condTextX, y: condTextY, size: 8.5, font, color: textColor });
    condTextY -= 13;
    page.drawText(`・納入場所 : ${deliveryPlaceVal}`, { x: condTextX, y: condTextY, size: 8.5, font, color: textColor });
    condTextY -= 13;
    page.drawText(`・支払条件 : 貴社とのお取引条件に準ずる`, { x: condTextX, y: condTextY, size: 8.5, font, color: textColor });
  }

  cursorY = cursorY - conditionBoxHeight - 12;

  // 5. 明細テーブル仕様
  interface ColumnDef {
    header: string;
    width: number;
    align: 'left' | 'center' | 'right';
  }

  let columns: ColumnDef[];
  if (isEstimate) {
    columns = [
      { header: '項番', width: 26.0, align: 'center' },
      { header: 'メーカー名', width: 118.0, align: 'left' },
      { header: '品名・仕様', width: 206.0, align: 'left' },
      { header: '数量', width: 41.0, align: 'right' },
      { header: '単位', width: 36.0, align: 'left' },
      { header: '備考', width: 88.28, align: 'left' },
    ];
  } else {
    columns = [
      { header: '項番', width: 24.0, align: 'center' },
      { header: 'メーカー名', width: 75.0, align: 'left' },
      { header: '品名・仕様', width: 175.0, align: 'left' },
      { header: '数量', width: 32.0, align: 'right' },
      { header: '単位', width: 28.0, align: 'left' },
      { header: '単価', width: 55.0, align: 'right' },
      { header: '金額', width: 60.0, align: 'right' },
      { header: '備考', width: 66.28, align: 'left' },
    ];
  }

  const tableHeaderHeight = 18;
  page.drawRectangle({
    x: marginLeft,
    y: cursorY - tableHeaderHeight,
    width: contentWidth,
    height: tableHeaderHeight,
    color: tableHeaderBg,
  });

  // テーブルヘッダー文字描画
  let colX = marginLeft;
  columns.forEach((col) => {
    const textWidth = font.widthOfTextAtSize(col.header, 8);
    let drawX = colX + 4;
    if (col.align === 'center') {
      drawX = colX + (col.width - textWidth) / 2;
    } else if (col.align === 'right') {
      drawX = colX + col.width - textWidth - 4;
    }

    page.drawText(col.header, {
      x: drawX,
      y: cursorY - 12,
      size: 8,
      font,
      color: whiteColor,
    });
    colX += col.width;
  });

  cursorY -= tableHeaderHeight;

  // 明細行描画
  const rowHeight = 18;
  const maxRows = 18;
  const displayItems = items.slice(0, maxRows);

  displayItems.forEach((item, idx) => {
    const rowY = cursorY - rowHeight;

    // 偶数行ゼブラ背景
    if (idx % 2 === 1) {
      page.drawRectangle({
        x: marginLeft,
        y: rowY,
        width: contentWidth,
        height: rowHeight,
        color: lightGrayBg,
      });
    }

    // 行下部区切り線
    page.drawLine({
      start: { x: marginLeft, y: rowY },
      end: { x: marginLeft + contentWidth, y: rowY },
      thickness: 0.5,
      color: borderColor,
    });

    const makerText = (item.maker_name || '-').slice(0, isEstimate ? 14 : 10);
    const itemSpecText = (item.item_name || '').slice(0, isEstimate ? 34 : 28);
    const qtyText = String(item.quantity);
    const unitText = item.unit || '台';
    const noteText = (item.note || '').slice(0, isEstimate ? 14 : 10);

    const cellTexts: string[] = isEstimate
      ? [
          String(idx + 1),
          makerText,
          itemSpecText,
          qtyText,
          unitText,
          noteText,
        ]
      : [
          String(idx + 1),
          makerText,
          itemSpecText,
          qtyText,
          unitText,
          `¥${item.unit_price.toLocaleString()}`,
          `¥${(item.amount || (item.quantity * item.unit_price)).toLocaleString()}`,
          noteText,
        ];

    let cellX = marginLeft;
    columns.forEach((col, cIdx) => {
      const val = cellTexts[cIdx];
      const textWidth = font.widthOfTextAtSize(val, 8);
      let drawX = cellX + 4;
      if (col.align === 'center') {
        drawX = cellX + (col.width - textWidth) / 2;
      } else if (col.align === 'right') {
        drawX = cellX + col.width - textWidth - 4;
      }

      page.drawText(val, {
        x: Math.max(cellX + 2, drawX),
        y: rowY + 5,
        size: 8,
        font,
        color: textColor,
      });

      cellX += col.width;
    });

    cursorY -= rowHeight;
  });

  // 6. 特記事項仕様（明細テーブル下部 / フッター上部）
  const noteStartY = Math.min(cursorY - 18, 90);
  page.drawText('【特記事項】', {
    x: marginLeft,
    y: noteStartY,
    size: 8.5,
    font,
    color: navyColor,
  });

  if (isEstimate) {
    page.drawText('・見積書はメール添付（PDF）またはFAXにてご送付をお願いいたします。', {
      x: marginLeft,
      y: noteStartY - 12,
      size: 8,
      font,
      color: textColor,
    });
    page.drawText('・納期に時間を要する場合は、最短可能納期をご記載ください。', {
      x: marginLeft,
      y: noteStartY - 23,
      size: 8,
      font,
      color: textColor,
    });
  } else {
    page.drawText('・発注書は本PDFの送付をもって代えさせていただきます。', {
      x: marginLeft,
      y: noteStartY - 12,
      size: 8,
      font,
      color: textColor,
    });
    page.drawText('・手配漏れなきよう、よろしくお願い申し上げます。', {
      x: marginLeft,
      y: noteStartY - 23,
      size: 8,
      font,
      color: textColor,
    });
  }

  return await pdfDoc.save();
}

/**
 * ブラウザ上でPDFをダウンロードトリガーする
 */
export function downloadPdfBlob(pdfBytes: Uint8Array, fileName: string): void {
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
