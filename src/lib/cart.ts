export interface CartItem {
  id: string;
  maker_name?: string;
  item_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  amount: number;
  source_estimate_number?: string;
  source_date?: string;
  note?: string;
}

const CART_STORAGE_KEY = 'pdf_quotation_cart_items';

/**
 * sessionStorageからカートデータをロードする
 */
export function loadCartFromStorage(): CartItem[] {
  try {
    const raw = sessionStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load cart from sessionStorage:', err);
    return [];
  }
}

/**
 * sessionStorageにカートデータを保存する
 */
export function saveCartToStorage(items: CartItem[]): void {
  try {
    sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('Failed to save cart to sessionStorage:', err);
  }
}

/**
 * カートに明細を追加する（同一商品・同一単価の場合は数量合算、それ以外は新規追加）
 */
export function addItemToCart(currentItems: CartItem[], newItem: Omit<CartItem, 'id'> & { id?: string }): CartItem[] {
  const targetIndex = currentItems.findIndex(
    (item) => item.item_name === newItem.item_name && item.unit_price === newItem.unit_price
  );

  let updated: CartItem[];

  if (targetIndex >= 0) {
    // 既存アイテムに数量合算
    updated = currentItems.map((item, idx) => {
      if (idx === targetIndex) {
        const newQty = item.quantity + newItem.quantity;
        return {
          ...item,
          quantity: newQty,
          amount: newQty * item.unit_price,
        };
      }
      return item;
    });
  } else {
    // 新規IDを付与して追加
    const itemWithId: CartItem = {
      ...newItem,
      id: newItem.id || `cart-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      amount: newItem.quantity * newItem.unit_price,
    };
    updated = [...currentItems, itemWithId];
  }

  saveCartToStorage(updated);
  return updated;
}

/**
 * カートから指定IDの明細を削除する
 */
export function removeItemFromCart(currentItems: CartItem[], id: string): CartItem[] {
  const updated = currentItems.filter((it) => it.id !== id);
  saveCartToStorage(updated);
  return updated;
}

/**
 * カートの数量を変更する
 */
export function updateCartItemQuantity(currentItems: CartItem[], id: string, quantity: number): CartItem[] {
  const updated = currentItems.map((item) => {
    if (item.id === id) {
      const validQty = Math.max(1, quantity);
      return {
        ...item,
        quantity: validQty,
        amount: validQty * item.unit_price,
      };
    }
    return item;
  });
  saveCartToStorage(updated);
  return updated;
}

/**
 * カートの備考（note）を変更する
 */
export function updateCartItemNote(currentItems: CartItem[], id: string, note: string): CartItem[] {
  const updated = currentItems.map((item) => {
    if (item.id === id) {
      return {
        ...item,
        note,
      };
    }
    return item;
  });
  saveCartToStorage(updated);
  return updated;
}

/**
 * カートを空にする
 */
export function clearCart(): CartItem[] {
  sessionStorage.removeItem(CART_STORAGE_KEY);
  return [];
}

/**
 * Loop 2: 手入力用新規明細データ型 (REQ-22-013)
 */
export interface NewCartItem {
  id: string;
  manufacturer: string;
  productName: string;
  quantity: number;
  unit?: string;
  unitPrice?: number;
  remarks?: string;
}

const NEW_CART_DRAFT_KEY = 'pdf_quotation_new_cart_draft';

/**
 * localStorageから手入力カート下書きをロード
 */
export function loadDraftNewCartItems(): NewCartItem[] {
  try {
    const raw = localStorage.getItem(NEW_CART_DRAFT_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to load draft new cart items from localStorage:', err);
    return [];
  }
}

/**
 * localStorageへ手入力カート下書きを保存 (Phase 4 UX-3-3 オートセーブ対策)
 */
export function saveDraftNewCartItems(items: NewCartItem[]): void {
  try {
    localStorage.setItem(NEW_CART_DRAFT_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn('Failed to save draft new cart items to localStorage:', err);
  }
}

/**
 * localStorageの手入力カート下書きを消去
 */
export function clearDraftNewCartItems(): void {
  try {
    localStorage.removeItem(NEW_CART_DRAFT_KEY);
  } catch (err) {
    console.warn('Failed to clear draft new cart items from localStorage:', err);
  }
}

/**
 * 手入力品目をリストに追加
 */
export function addNewCartItem(
  current: NewCartItem[],
  item: Omit<NewCartItem, 'id'> & { id?: string }
): NewCartItem[] {
  const newItemWithId: NewCartItem = {
    ...item,
    id: item.id || `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  };
  const updated = [...current, newItemWithId];
  saveDraftNewCartItems(updated);
  return updated;
}

/**
 * 手入力品目のフィールドを部分更新
 */
export function updateNewCartItem(
  current: NewCartItem[],
  id: string,
  updates: Partial<Omit<NewCartItem, 'id'>>
): NewCartItem[] {
  const updated = current.map((item) => {
    if (item.id === id) {
      return {
        ...item,
        ...updates,
      };
    }
    return item;
  });
  saveDraftNewCartItems(updated);
  return updated;
}

/**
 * 手入力品目をリストから削除
 */
export function removeNewCartItem(current: NewCartItem[], id: string): NewCartItem[] {
  const updated = current.filter((it) => it.id !== id);
  saveDraftNewCartItems(updated);
  return updated;
}

/**
 * 手入力品目リストをクリア
 */
export function clearNewCartItems(): NewCartItem[] {
  clearDraftNewCartItems();
  return [];
}

/**
 * 手入力明細のバリデーション入力パラメータ
 */
export interface ManualItemInput {
  manufacturer?: string;
  productName: string;
  quantity: number;
  unit?: string;
  unitPriceStr?: string;
  remarks?: string;
  docType: 'ESTIMATE_REQUEST' | 'PURCHASE_ORDER';
  currentCount?: number;
  maxCount?: number;
}

/**
 * 手入力明細のバリデーション結果
 */
export type ValidateManualItemResult =
  | { success: true; item: Omit<NewCartItem, 'id'> }
  | { success: false; error: string };

/**
 * 手入力明細のバリデーションを行い、正規化されたアイテムまたはエラーメッセージを返す (SoC / 重複排除)
 */
export function validateManualCartItem(input: ManualItemInput): ValidateManualItemResult {
  const trimmedProduct = (input.productName || '').trim();
  if (!trimmedProduct) {
    return { success: false, error: '品名を入力してください。' };
  }
  if (trimmedProduct.length > 100) {
    return { success: false, error: '品名は100文字以内で入力してください。' };
  }
  const remarks = (input.remarks || '').trim();
  if (remarks.length > 200) {
    return { success: false, error: '備考は200文字以内で入力してください。' };
  }
  if (!input.quantity || input.quantity < 1) {
    return { success: false, error: '数量は1以上の数値を入力してください。' };
  }
  if (input.maxCount !== undefined && input.currentCount !== undefined && input.currentCount >= input.maxCount) {
    return { success: false, error: `登録できる明細は最大${input.maxCount}件までです。` };
  }

  let parsedPrice: number | undefined = undefined;
  const priceStr = (input.unitPriceStr ?? '').trim();
  if (priceStr !== '') {
    const p = Number(priceStr);
    if (isNaN(p) || p < 0) {
      return { success: false, error: '単価には0以上の有効な数値を入力してください。' };
    }
    parsedPrice = p;
  } else if (input.docType === 'PURCHASE_ORDER') {
    return { success: false, error: '発注書を作成する場合は単価が必須です。' };
  }

  return {
    success: true,
    item: {
      manufacturer: (input.manufacturer || '').trim(),
      productName: trimmedProduct,
      quantity: input.quantity,
      unit: (input.unit || '').trim() || '個',
      unitPrice: parsedPrice,
      remarks,
    },
  };
}

/**
 * NewCartItem を既存の CartItem 形式へ変換（PDFジェネレータ連携用）
 */
export function convertNewCartItemToCartItem(item: NewCartItem): CartItem {
  return {
    id: item.id,
    maker_name: item.manufacturer || '',
    item_name: item.productName,
    quantity: Math.max(1, item.quantity || 1),
    unit: item.unit || '個',
    unit_price: item.unitPrice ?? 0,
    amount: (item.unitPrice ?? 0) * Math.max(1, item.quantity || 1),
    note: item.remarks || '',
  };
}

/**
 * NewCartItemリストを一括で CartItem 形式へ変換
 */
export function convertNewCartItemsToCartItems(items: NewCartItem[]): CartItem[] {
  return items.map(convertNewCartItemToCartItem);
}

