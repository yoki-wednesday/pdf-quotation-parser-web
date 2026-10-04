import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  addNewCartItem,
  updateNewCartItem,
  removeNewCartItem,
  clearNewCartItems,
  convertNewCartItemToCartItem,
  convertNewCartItemsToCartItems,
  loadDraftNewCartItems,
  type NewCartItem,
} from '../lib/cart';
import { recordDocumentExportAudit } from '../lib/auditLogger';
import { CartDrawer } from '../components/CartDrawer';

describe('Loop 2: 新規品目手入力帳票作成機能 (REQ-22-013)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  describe('1. インメモリカート操作ヘルパー (cart.ts)', () => {
    it('手入力明細の追加とオートセーブが動作すること', () => {
      let items: NewCartItem[] = [];
      items = addNewCartItem(items, {
        manufacturer: '三菱電機',
        productName: 'シーケンサ FX5U',
        quantity: 2,
        unitPrice: 45000,
        remarks: '特急手配',
      });

      expect(items).toHaveLength(1);
      expect(items[0].id).toContain('manual-');
      expect(items[0].productName).toBe('シーケンサ FX5U');
      expect(items[0].quantity).toBe(2);

      // localStorageに下書きが保存されていること (Task-012)
      const draft = loadDraftNewCartItems();
      expect(draft).toHaveLength(1);
      expect(draft[0].productName).toBe('シーケンサ FX5U');
    });

    it('手入力明細の更新・削除・クリアが動作すること', () => {
      let items: NewCartItem[] = [
        { id: 'm-1', manufacturer: 'オムロン', productName: 'センサ A', quantity: 1, unitPrice: 5000 },
        { id: 'm-2', manufacturer: 'SMC', productName: 'シリンダ B', quantity: 3, unitPrice: 8000 },
      ];

      // 更新
      items = updateNewCartItem(items, 'm-1', { quantity: 5, unitPrice: 4800 });
      expect(items.find((it) => it.id === 'm-1')?.quantity).toBe(5);
      expect(items.find((it) => it.id === 'm-1')?.unitPrice).toBe(4800);

      // 削除
      items = removeNewCartItem(items, 'm-1');
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe('m-2');

      // クリア
      items = clearNewCartItems();
      expect(items).toHaveLength(0);
      expect(loadDraftNewCartItems()).toHaveLength(0);
    });

    it('NewCartItem から CartItem への変換が正しく行われること (Task-015)', () => {
      const manual: NewCartItem = {
        id: 'manual-999',
        manufacturer: 'キーエンス',
        productName: 'レーザーセンサ',
        quantity: 3,
        unitPrice: 20000,
        remarks: '検査用',
      };

      const converted = convertNewCartItemToCartItem(manual);
      expect(converted.id).toBe('manual-999');
      expect(converted.maker_name).toBe('キーエンス');
      expect(converted.item_name).toBe('レーザーセンサ');
      expect(converted.quantity).toBe(3);
      expect(converted.unit_price).toBe(20000);
      expect(converted.amount).toBe(60000);
      expect(converted.note).toBe('検査用');

      const listConverted = convertNewCartItemsToCartItems([manual]);
      expect(listConverted).toHaveLength(1);
      expect(listConverted[0].amount).toBe(60000);
    });
  });

  describe('2. 監査メタデータログ (auditLogger.ts / REQ-13-002)', () => {
    it('手入力明細の帳票出力時に監査メタデータがセキュアに記録されること', () => {
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      recordDocumentExportAudit({
        documentType: 'PURCHASE_ORDER',
        vendorName: '岩瀬産業 株式会社',
        itemCount: 3,
        totalAmount: 150000,
        sourceType: 'MANUAL_CART',
        timestamp: '2026-10-04T00:00:00.000Z',
      });

      expect(infoSpy).toHaveBeenCalled();
      const loggedJson = infoSpy.mock.calls[0][1];
      const parsed = JSON.parse(loggedJson);

      expect(parsed.event).toBe('DOCUMENT_EXPORT_AUDIT');
      expect(parsed.requirementId).toBe('REQ-13-002');
      expect(parsed.sourceType).toBe('MANUAL_CART');
      expect(parsed.itemCount).toBe(3);
      expect(parsed.totalAmount).toBe(150000);

      // sessionStorage に直近ログが保持されていること
      const rawStored = sessionStorage.getItem('pdf_quotation_audit_logs');
      expect(rawStored).toBeTruthy();
      const stored = JSON.parse(rawStored!);
      expect(stored[0].requirementId).toBe('REQ-13-002');

      infoSpy.mockRestore();
    });
  });

  describe('3. CartDrawer 手入力モード UI & バリデーション (Task-013, Task-014)', () => {
    it('手入力タブへの切替と空フォームの表示、バリデーションエラー検知', () => {
      render(
        <CartDrawer
          isOpen={true}
          onClose={vi.fn()}
          items={[]}
          onUpdateQuantity={vi.fn()}
          onRemoveItem={vi.fn()}
          onClearCart={vi.fn()}
        />
      );

      // 手入力タブを押下
      const manualTab = screen.getByRole('button', { name: /新規手入力/i });
      fireEvent.click(manualTab);

      // 品名が空のまま「明細を追加」を押下 -> エラー
      const addBtn = screen.getByRole('button', { name: /明細を追加/i });
      fireEvent.click(addBtn);

      expect(screen.getByText(/品名を入力してください/i)).toBeInTheDocument();
    });

    it('発注書モード時に単価未入力でバリデーションエラーが発生すること', () => {
      render(
        <CartDrawer
          isOpen={true}
          onClose={vi.fn()}
          items={[]}
          onUpdateQuantity={vi.fn()}
          onRemoveItem={vi.fn()}
          onClearCart={vi.fn()}
        />
      );

      // 手入力タブ押下
      fireEvent.click(screen.getByRole('button', { name: /新規手入力/i }));

      // 新規発注書を選択
      const orderBtn = screen.getByRole('button', { name: /新規発注書/i });
      fireEvent.click(orderBtn);

      // 品名のみ入力し単価は空欄
      const productInput = screen.getByPlaceholderText(/例: リレー MY4N/i);
      fireEvent.change(productInput, { target: { value: 'テスト品目X' } });

      const addBtn = screen.getByRole('button', { name: /明細を追加/i });
      fireEvent.click(addBtn);

      expect(screen.getByText(/発注書を作成する場合は単価が必須です/i)).toBeInTheDocument();
    });

    it('手入力明細を追加し、帳票作成コールバックが正常に呼び出されること', () => {
      const handleOpenManualDoc = vi.fn();

      render(
        <CartDrawer
          isOpen={true}
          onClose={vi.fn()}
          items={[]}
          onUpdateQuantity={vi.fn()}
          onRemoveItem={vi.fn()}
          onClearCart={vi.fn()}
          onOpenDocumentModalWithItems={handleOpenManualDoc}
        />
      );

      // 手入力タブ押下
      fireEvent.click(screen.getByRole('button', { name: /新規手入力/i }));

      // メーカー、品名、単価、数量を入力
      fireEvent.change(screen.getByPlaceholderText(/例: オムロン/i), { target: { value: 'オムロン' } });
      fireEvent.change(screen.getByPlaceholderText(/例: リレー MY4N/i), { target: { value: 'MY4N 24VDC' } });
      fireEvent.change(screen.getByPlaceholderText(/未定・空欄可/i), { target: { value: '1200' } });

      // 追加
      fireEvent.click(screen.getByRole('button', { name: /明細を追加/i }));

      // リストに表示されたことを確認
      expect(screen.getByText(/MY4N 24VDC/i)).toBeInTheDocument();

      // 帳票作成へ
      const genBtn = screen.getByRole('button', { name: /見積依頼書PDF作成へ/i });
      fireEvent.click(genBtn);

      expect(handleOpenManualDoc).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            item_name: 'MY4N 24VDC',
            maker_name: 'オムロン',
            unit_price: 1200,
          }),
        ]),
        'ESTIMATE_REQUEST',
        true
      );
    });
  });
});
