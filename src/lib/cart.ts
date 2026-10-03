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
