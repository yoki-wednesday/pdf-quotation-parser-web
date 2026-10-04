import { describe, it, expect, beforeEach } from 'vitest';
import {
  addItemToCart,
  removeItemFromCart,
  updateCartItemQuantity,
  updateCartItemNote,
  loadCartFromStorage,
  clearCart,
  type CartItem,
  validateManualCartItem,
} from '../lib/cart';

describe('TEST-010-CART-STATE: 買い物かご状態管理 & sessionStorage同期', () => {
  beforeEach(() => {
    clearCart();
  });

  it('新規アイテムがカートに追加され、amountが正しく算出されること', () => {
    let items: CartItem[] = [];
    items = addItemToCart(items, {
      item_name: 'リレー MY4N',
      quantity: 5,
      unit: '個',
      unit_price: 500,
      amount: 2500,
    });

    expect(items.length).toBe(1);
    expect(items[0].item_name).toBe('リレー MY4N');
    expect(items[0].quantity).toBe(5);
    expect(items[0].amount).toBe(2500);

    // sessionStorage永続化確認
    const stored = loadCartFromStorage();
    expect(stored.length).toBe(1);
    expect(stored[0].item_name).toBe('リレー MY4N');
  });

  it('同一品名・同一単価のアイテムが追加された場合、数量が合算されること', () => {
    let items: CartItem[] = [];
    items = addItemToCart(items, {
      item_name: 'リレー MY4N',
      quantity: 5,
      unit: '個',
      unit_price: 500,
      amount: 2500,
    });

    items = addItemToCart(items, {
      item_name: 'リレー MY4N',
      quantity: 3,
      unit: '個',
      unit_price: 500,
      amount: 1500,
    });

    expect(items.length).toBe(1);
    expect(items[0].quantity).toBe(8);
    expect(items[0].amount).toBe(4000);
  });

  it('数量変更および削除が正しく動作すること', () => {
    let items: CartItem[] = [];
    items = addItemToCart(items, {
      id: 'test-1',
      item_name: 'センサ E2E',
      quantity: 2,
      unit: '個',
      unit_price: 1000,
      amount: 2000,
    });

    items = updateCartItemQuantity(items, 'test-1', 10);
    expect(items[0].quantity).toBe(10);
    expect(items[0].amount).toBe(10000);

    items = removeItemFromCart(items, 'test-1');
    expect(items.length).toBe(0);
  });

  it('備考（note）の更新が正しく動作すること', () => {
    let items: CartItem[] = [];
    items = addItemToCart(items, {
      id: 'test-2',
      item_name: 'リレー MY4N',
      quantity: 1,
      unit: '個',
      unit_price: 500,
      amount: 500,
    });

    expect(items[0].note).toBeUndefined();

    items = updateCartItemNote(items, 'test-2', '客先指定品');
    expect(items[0].note).toBe('客先指定品');

    const stored = loadCartFromStorage();
    expect(stored[0].note).toBe('客先指定品');
  });
});

describe('TEST-011-MANUAL-VALIDATION: 手入力バリデーション (validateManualCartItem)', () => {
  it('正常な入力でバリデーションが成功すること', () => {
    const res = validateManualCartItem({
      manufacturer: 'オムロン',
      productName: 'リレー MY4N',
      quantity: 5,
      unit: '個',
      unitPriceStr: '500',
      remarks: '客先指定品',
      docType: 'PURCHASE_ORDER',
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.item.manufacturer).toBe('オムロン');
      expect(res.item.productName).toBe('リレー MY4N');
      expect(res.item.quantity).toBe(5);
      expect(res.item.unit).toBe('個');
      expect(res.item.unitPrice).toBe(500);
      expect(res.item.remarks).toBe('客先指定品');
    }
  });

  it('品名が空の場合にエラーとなること', () => {
    const res = validateManualCartItem({
      productName: '   ',
      quantity: 1,
      docType: 'ESTIMATE_REQUEST',
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe('品名を入力してください。');
    }
  });

  it('発注書で単価が未入力または負数の場合にエラーとなること', () => {
    const res1 = validateManualCartItem({
      productName: '端子台',
      quantity: 1,
      docType: 'PURCHASE_ORDER',
    });
    expect(res1.success).toBe(false);
    if (!res1.success) {
      expect(res1.error).toBe('発注書を作成する場合は単価が必須です。');
    }

    const res2 = validateManualCartItem({
      productName: '端子台',
      quantity: 1,
      unitPriceStr: '-10',
      docType: 'PURCHASE_ORDER',
    });
    expect(res2.success).toBe(false);
    if (!res2.success) {
      expect(res2.error).toBe('単価には0以上の有効な数値を入力してください。');
    }
  });
});

