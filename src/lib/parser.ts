export interface EstimateHeader {
  estimate_number: string;
  issue_date: string;
  customer_name: string;
  total_amount: number;
}

export interface EstimateItem {
  line_number: number;
  maker_name?: string;
  item_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  amount: number;
}

export interface ParsedEstimateResult {
  header: EstimateHeader;
  items: EstimateItem[];
  rawText: string;
}

/**
 * 抽出テキストからヘッダーおよび簡易明細行をパースする正規化関数
 */
export function parseEstimateText(rawText: string): ParsedEstimateResult {
  // デフォルト値
  const today = new Date().toISOString().split('T')[0];
  const header: EstimateHeader = {
    estimate_number: `EST-${Date.now().toString().slice(-6)}`,
    issue_date: today,
    customer_name: '御中',
    total_amount: 0,
  };

  // 見積番号の探索 (例: No.xxxx, 見積番号: xxxx, 管理：xxxx 等)
  const noMatch = rawText.match(/(?:No\.|見積(?:書)?番号|管理)[\s:：]*([A-Za-z0-9-_]+)/i);
  if (noMatch && noMatch[1]) {
    header.estimate_number = noMatch[1];
  } else {
    // 独立した10桁の数字があれば見積番号の可能性が高い
    const isolatedNumMatch = rawText.match(/(?:^|\s)(\d{10})(?:\s|$)/);
    if (isolatedNumMatch) {
      header.estimate_number = isolatedNumMatch[1];
    }
  }

  // 発行日の探索 (例: 2026年3月1日, 2026/03/01)
  const dateMatch = rawText.match(/(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})日?/);
  if (dateMatch) {
    const y = dateMatch[1];
    const m = dateMatch[2].padStart(2, '0');
    const d = dateMatch[3].padStart(2, '0');
    header.issue_date = `${y}-${m}-${d}`;
  }

  // 宛名・顧客名の探索 (例: ㈱大平テック 小山工場 朝海様)
  // 改行をまたぐ宛名構造に対応（行ごとに「様」「御中」を探し、前の行に社名があれば連結）
  const rawLines = rawText.split('\n');
  const samaIdx = rawLines.findIndex((l) => /(?:御中|(?<!仕|模)様)/.test(l));
  if (samaIdx >= 0) {
    const samaLine = rawLines[samaIdx];
    const samaMatch = samaLine.match(/([^\s]+(?:\s+[^\s]+)*?)\s*(?:御中|(?<!仕|模)様)/);
    if (samaMatch) {
      if (samaIdx > 0 && /(?:株式会社|㈱|有限会社|㈲)/.test(rawLines[samaIdx - 1])) {
        const prevCorp = rawLines[samaIdx - 1].match(/((?:株式会社|㈱|有限会社|㈲)[^\s]+)/);
        header.customer_name = (prevCorp ? prevCorp[1] + '  ' : '') + samaMatch[1].trim();
      } else {
        header.customer_name = samaMatch[1].trim();
      }
    }
  }

  // フォールバック: パターンA/B
  if (header.customer_name === '御中') {
    const customerMatchA = rawText.match(
      /(?:^|\s)((?:株式会社|㈱|有限会社|㈲)[^\s]+(?:\s+[^\s]+)*?)\s*(?:御中|(?<!仕|模)様)(?:\s|$)/
    );
    if (customerMatchA && customerMatchA[1]) {
      header.customer_name = customerMatchA[1].trim();
    } else {
      const customerMatchB = rawText.match(
        /(?:^|\s)([^\s]+(?:\s+[^\s]+)?)\s*(?:御中|(?<!仕|模)様)(?:\s|$)/
      );
      if (customerMatchB && customerMatchB[1]) {
        header.customer_name = customerMatchB[1].trim();
      }
    }
  }

  // 合計金額の探索 (例: 合計金額 ¥1,234,560)
  const totalMatch = rawText.match(/(?:合計金額|合計|小計)[\s:：]*[¥￥]?\s*([0-9,]+)/);
  if (totalMatch && totalMatch[1]) {
    header.total_amount = parseInt(totalMatch[1].replace(/,/g, ''), 10) || 0;
  } else {
    // PDFのレイアウト崩れで合計金額という文字と離れている場合、「¥」記号の隣にある数字を拾う
    const yenMatch = rawText.match(/[¥￥]\s*([0-9,]{4,})/);
    if (yenMatch && yenMatch[1]) {
      header.total_amount = parseInt(yenMatch[1].replace(/,/g, ''), 10) || 0;
    }
  }

  // 明細行の探索
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const items: EstimateItem[] = [];
  let lineNumber = 1;

  // 1. 複数行テーブルレイアウト（品名行、数量・単価・金額行、型番行が縦に並ぶレイアウト）の検出
  const qtyLineRegex = /^(\d+)\s*(個|式|本|台|枚|ヶ|セット)\s+([0-9,]+)\.?\s+([0-9,]+)(?:\s+(.*))?$/;
  const hasMultiLineLayout = lines.some((l) => qtyLineRegex.test(l));

  if (hasMultiLineLayout) {
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const qMatch = line.match(qtyLineRegex);
      if (qMatch) {
        const qty = parseInt(qMatch[1], 10);
        const unit = qMatch[2];
        const unitPrice = parseInt(qMatch[3].replace(/,/g, ''), 10);
        const amount = parseInt(qMatch[4].replace(/,/g, ''), 10);

        // 前の行（品名・メーカー）の取得
        const nameParts: string[] = [];
        if (i > 0) {
          const prevLine = lines[i - 1];
          if (
            !prevLine.includes('品名・寸法・仕様') &&
            !prevLine.includes('見積番号') &&
            !qtyLineRegex.test(prevLine)
          ) {
            nameParts.push(prevLine);
          }
        }

        // 後の行（型番・備考）の取得（次の数量行やヘッダー・フッターに達するまで）
        let j = i + 1;
        const modelParts: string[] = [];
        while (j < lines.length) {
          const nextLine = lines[j];
          if (qtyLineRegex.test(nextLine)) break;
          if (nextLine.includes('品名・寸法・仕様')) break;
          if (nextLine.includes('本書には消費税は含まれておりません')) break;
          if (nextLine.includes('管理：') || nextLine.startsWith('Page ')) break;
          // 次の行の直前が数量行の場合は次項目の品名なので停止
          if (j + 1 < lines.length && qtyLineRegex.test(lines[j + 1])) break;

          modelParts.push(nextLine);
          j++;
          
          // 単価列が空欄の行（備考やメッセージ行）を過剰にマージしないため、
          // 数量行の直下1行のみ（型番・仕様として）取り込む仕様とする
          if (modelParts.length >= 1) break;
        }

        let fullName = [...nameParts, ...modelParts].join(' ').trim() || '品目';

        let makerName: string | undefined = undefined;
        const makerMatch = fullName.match(/<([^>]+)>/);
        if (makerMatch) {
          makerName = makerMatch[1];
          fullName = fullName.replace(/<[^>]+>\s*/, '').trim();
        }

        items.push({
          line_number: lineNumber++,
          maker_name: makerName,
          item_name: fullName,
          quantity: qty,
          unit,
          unit_price: unitPrice,
          amount,
        });
        i = j;
        continue;
      }
      i++;
    }
  }

  // 2. 従来の1行完結パターン（複数行レイアウトで検出されなかった場合、または追加）
  if (items.length === 0) {
    for (const line of lines) {
      // パターン1: 従来通りの行単位 (例: "リレー G2R-1 10 個 500 5000")
      const match = line.match(/^(.+?)\s+(\d+)\s*(個|式|本|台|枚|ヶ)?\s+([0-9,]+)\s+([0-9,]+)$/);
      if (match) {
        const unitPrice = parseInt(match[4].replace(/,/g, ''), 10) || 0;
        const amount = parseInt(match[5].replace(/,/g, ''), 10) || 0;
        let makerName: string | undefined = undefined;
        const makerMatch = match[1].match(/<([^>]+)>/);
        let itemName = match[1].trim();
        if (makerMatch) {
          makerName = makerMatch[1];
          itemName = itemName.replace(/<[^>]+>\s*/, '').trim();
        }

        items.push({
          line_number: lineNumber++,
          maker_name: makerName,
          item_name: itemName,
          quantity: parseInt(match[2], 10) || 1,
          unit: match[3] || '個',
          unit_price: unitPrice,
          amount: amount,
        });
        continue;
      }

      // パターン2: 特殊レイアウト1 (例: 品名 品番 115,700. 1)
      const inlineMatch = line.match(/([^\s]+\s+[A-Za-z0-9-]+)\s+([0-9,]+)\.?\s+(\d+)\s/);
      if (
        inlineMatch &&
        inlineMatch[2] &&
        parseInt(inlineMatch[2].replace(/,/g, ''), 10) === header.total_amount
      ) {
        items.push({
          line_number: lineNumber++,
          item_name: inlineMatch[1].trim(),
          quantity: parseInt(inlineMatch[3], 10) || 1,
          unit: '式',
          unit_price: parseInt(inlineMatch[2].replace(/,/g, ''), 10) || 0,
          amount: parseInt(inlineMatch[2].replace(/,/g, ''), 10) || 0,
        });
        continue;
      }

      // パターン3: 特殊レイアウト2 (例: <IAI(双信電機)>ﾉｲｽﾞﾌｨﾙﾀ単相 1 個 2,670. 2,670)
      const regexPattern3 =
        /([^\s]+)\s+(\d+)\s*(個|式|本|台|枚|ヶ)\s+([0-9,]+)\.?\s+([0-9,]+)(?:\s|$)/g;
      let match3;
      while ((match3 = regexPattern3.exec(line)) !== null) {
        let itemName = match3[1].trim();
        if (itemName.length <= 1 || /^\d+$/.test(itemName)) {
          continue;
        }

        let makerName: string | undefined = undefined;
        const makerMatch = itemName.match(/<([^>]+)>/);
        if (makerMatch) {
          makerName = makerMatch[1];
          itemName = itemName.replace(/<[^>]+>\s*/, '').trim();
        }

        items.push({
          line_number: lineNumber++,
          maker_name: makerName,
          item_name: itemName,
          quantity: parseInt(match3[2], 10) || 1,
          unit: match3[3] || '個',
          unit_price: parseInt(match3[4].replace(/,/g, ''), 10) || 0,
          amount: parseInt(match3[5].replace(/,/g, ''), 10) || 0,
        });
      }
    }
  }

  // 明細行が拾えなかった場合のフォールバック（最低1行の仮明細）
  if (items.length === 0) {
    items.push({
      line_number: 1,
      item_name: '見積記載品目',
      quantity: 1,
      unit: '式',
      unit_price: header.total_amount || 0,
      amount: header.total_amount || 0,
    });
  }

  if (header.total_amount === 0) {
    header.total_amount = items.reduce((acc, it) => acc + it.amount, 0);
  }

  return {
    header,
    items,
    rawText,
  };
}
