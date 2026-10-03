import { describe, it, expect, beforeEach } from 'vitest';
import {
  addItemToCart,
  removeItemFromCart,
  updateCartItemQuantity,
  updateCartItemNote,
  loadCartFromStorage,
  clearCart,
  type CartItem,
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
