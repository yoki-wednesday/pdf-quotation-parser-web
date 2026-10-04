import { useState, useEffect } from 'react';
import type { CartItem } from '../lib/cart';
import {
  type NewCartItem,
  loadDraftNewCartItems,
  addNewCartItem,
  removeNewCartItem,
  clearNewCartItems,
  convertNewCartItemsToCartItems,
  validateManualCartItem,
} from '../lib/cart';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: string, qty: number) => void;
  onUpdateNote?: (id: string, note: string) => void;
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  onOpenDocumentModal?: () => void;
  /** 手入力明細および帳票種別を引き渡して帳票モーダルを開くコールバック */
  onOpenDocumentModalWithItems?: (
    items: CartItem[],
    defaultDocType?: 'ESTIMATE_REQUEST' | 'PURCHASE_ORDER',
    isManualEntry?: boolean
  ) => void;
}

const MAX_MANUAL_ITEMS = 20;

export function CartDrawer({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onUpdateNote,
  onRemoveItem,
  onClearCart,
  onOpenDocumentModal,
  onOpenDocumentModalWithItems,
}: CartDrawerProps) {
  const [activeTab, setActiveTab] = useState<'history' | 'manual'>('history');

  // 手入力カートの状態 (localStorageと同期)
  const [manualDocType, setManualDocType] = useState<'ESTIMATE_REQUEST' | 'PURCHASE_ORDER'>('ESTIMATE_REQUEST');
  const [manualItems, setManualItems] = useState<NewCartItem[]>([]);
  
  // 入力フォームの状態
  const [inputMaker, setInputMaker] = useState('');
  const [inputProduct, setInputProduct] = useState('');
  const [inputQty, setInputQty] = useState<number>(1);
  const [inputUnit, setInputUnit] = useState('個');
  const [inputUnitPrice, setInputUnitPrice] = useState<string>('');
  const [inputRemarks, setInputRemarks] = useState('');
  const [validationError, setValidationError] = useState<string>('');

  // ドロワーオープン時に下書きをロード
  useEffect(() => {
    if (isOpen) {
      setManualItems(loadDraftNewCartItems());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const totalAmount = items.reduce((acc, it) => acc + it.amount, 0);
  const manualTotalAmount = manualItems.reduce(
    (acc, it) => acc + (it.unitPrice ?? 0) * it.quantity,
    0
  );

  // 手入力アイテムの追加ハンドラ (Task-014 バリデーション実装)
  const handleAddManualItem = () => {
    setValidationError('');

    const validation = validateManualCartItem({
      manufacturer: inputMaker,
      productName: inputProduct,
      quantity: inputQty,
      unit: inputUnit,
      unitPriceStr: inputUnitPrice,
      remarks: inputRemarks,
      docType: manualDocType,
      currentCount: manualItems.length,
      maxCount: MAX_MANUAL_ITEMS,
    });

    if (!validation.success) {
      setValidationError(validation.error);
      return;
    }

    const updated = addNewCartItem(manualItems, validation.item);
    setManualItems(updated);

    // フォームリセット
    setInputMaker('');
    setInputProduct('');
    setInputQty(1);
    setInputUnit('個');
    setInputUnitPrice('');
    setInputRemarks('');
  };

  const handleRemoveManualItem = (id: string) => {
    const updated = removeNewCartItem(manualItems, id);
    setManualItems(updated);
  };

  const handleClearManualItems = () => {
    const updated = clearNewCartItems();
    setManualItems(updated);
    setValidationError('');
  };

  const handleGenerateManualDocument = () => {
    setValidationError('');

    let itemsToProcess = [...manualItems];

    // フォームに入力中（品名が存在する）のデータがある場合は自動的に追加対象に含める
    if (inputProduct.trim()) {
      const validation = validateManualCartItem({
        manufacturer: inputMaker,
        productName: inputProduct,
        quantity: inputQty,
        unit: inputUnit,
        unitPriceStr: inputUnitPrice,
        remarks: inputRemarks,
        docType: manualDocType,
      });

      if (!validation.success) {
        setValidationError(validation.error);
        return;
      }

      itemsToProcess.push({
        id: 'auto-' + Date.now().toString(),
        ...validation.item,
      });
      
      // 暗黙的に追加した場合は、リスト側も更新しておく
      const updated = addNewCartItem(manualItems, validation.item);
      setManualItems(updated);
      setInputMaker('');
      setInputProduct('');
      setInputQty(1);
      setInputUnit('個');
      setInputUnitPrice('');
      setInputRemarks('');
    }

    if (itemsToProcess.length === 0) {
      setValidationError('明細を「＋ 明細を追加」ボタンで追加するか、フォームに入力してください。');
      return;
    }

    if (manualDocType === 'PURCHASE_ORDER') {
      const hasMissingPrice = itemsToProcess.some(
        (it) => it.unitPrice === undefined || it.unitPrice === null || it.unitPrice < 0
      );
      if (hasMissingPrice) {
        setValidationError('発注書を作成する場合はすべての明細に単価が必要です。');
        return;
      }
    }

    const converted = convertNewCartItemsToCartItems(itemsToProcess);
    if (onOpenDocumentModalWithItems) {
      onOpenDocumentModalWithItems(converted, manualDocType, true);
    } else if (onOpenDocumentModal) {
      onOpenDocumentModal();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '450px',
        backgroundColor: '#fff',
        boxShadow: '-2px 0 8px rgba(0,0,0,0.15)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        padding: '1.25rem',
      }}
    >
      {/* ヘッダー */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.2rem' }}>🛒 帳票作成・カート</h3>
        <button
          onClick={onClose}
          style={{ border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer' }}
        >
          ✕
        </button>
      </div>

      {/* モード切替タブ */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e1e4e8', marginBottom: '1rem' }}>
        <button
          data-ai-id="btn-tab-history-cart"
          onClick={() => setActiveTab('history')}
          style={{
            flex: 1,
            padding: '0.6rem 0.4rem',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: activeTab === 'history' ? 'bold' : 'normal',
            borderBottom: activeTab === 'history' ? '3px solid #0070f3' : '3px solid transparent',
            color: activeTab === 'history' ? '#0070f3' : '#586069',
            fontSize: '0.9rem',
          }}
        >
          取込履歴から ({items.length}件)
        </button>
        <button
          data-ai-id="btn-tab-manual-cart"
          onClick={() => setActiveTab('manual')}
          style={{
            flex: 1,
            padding: '0.6rem 0.4rem',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: activeTab === 'manual' ? 'bold' : 'normal',
            borderBottom: activeTab === 'manual' ? '3px solid #0070f3' : '3px solid transparent',
            color: activeTab === 'manual' ? '#0070f3' : '#586069',
            fontSize: '0.9rem',
          }}
        >
          ✍️ 新規手入力 ({manualItems.length}件)
        </button>
      </div>

      {/* タブ1: 既存取込履歴からのカート */}
      {activeTab === 'history' && (
        <>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {items.length === 0 ? (
              <p style={{ color: '#888', textAlign: 'center', marginTop: '3rem' }}>カートは空です。</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {items.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      border: '1px solid #e1e4e8',
                      borderRadius: '6px',
                      padding: '0.8rem',
                      backgroundColor: '#fafbfc',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                      <span>{item.item_name}</span>
                      <button
                        onClick={() => onRemoveItem(item.id)}
                        style={{ color: '#cf222e', border: 'none', background: 'none', cursor: 'pointer' }}
                      >
                        削除
                      </button>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#586069', marginTop: '0.3rem' }}>
                      単価: ¥{item.unit_price.toLocaleString()} ({item.unit})
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <label style={{ fontSize: '0.8rem' }}>数量:</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => onUpdateQuantity(item.id, parseInt(e.target.value, 10) || 1)}
                          style={{ width: '60px', padding: '0.2rem' }}
                        />
                      </div>
                      <div style={{ fontWeight: 'bold' }}>¥{item.amount.toLocaleString()}</div>
                    </div>
                    <div style={{ marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <label style={{ fontSize: '0.8rem', color: '#586069', flexShrink: 0 }}>備考:</label>
                      <input
                        type="text"
                        placeholder="備考 (帳票の備考欄に印字)"
                        value={item.note || ''}
                        onChange={(e) => onUpdateNote && onUpdateNote(item.id, e.target.value)}
                        style={{
                          flex: 1,
                          padding: '0.25rem 0.4rem',
                          fontSize: '0.8rem',
                          borderRadius: '4px',
                          border: '1px solid #d0d7de',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div style={{ borderTop: '1px solid #e1e4e8', paddingTop: '1rem', marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                <span>合計金額:</span>
                <span>¥{totalAmount.toLocaleString()}</span>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={onClearCart}
                  style={{
                    flex: 1,
                    padding: '0.6rem',
                    backgroundColor: '#f6f8fa',
                    border: '1px solid #d0d7de',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  カートを空にする
                </button>
                <button
                  data-ai-id="btn-generate-estimate-request"
                  onClick={() => {
                    if (onOpenDocumentModalWithItems) {
                      onOpenDocumentModalWithItems(items, 'ESTIMATE_REQUEST', false);
                    } else if (onOpenDocumentModal) {
                      onOpenDocumentModal();
                    }
                  }}
                  style={{
                    flex: 2,
                    padding: '0.6rem',
                    backgroundColor: '#0070f3',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  帳票作成へ
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* タブ2: 新規品目手入力カート (REQ-22-013, Task-013) */}
      {activeTab === 'manual' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* 帳票作成種別の選択 */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.8rem' }}>
            <button
              data-ai-id="btn-select-manual-estimate"
              onClick={() => {
                setManualDocType('ESTIMATE_REQUEST');
                setValidationError('');
              }}
              style={{
                flex: 1,
                padding: '0.4rem',
                fontSize: '0.85rem',
                borderRadius: '4px',
                border: manualDocType === 'ESTIMATE_REQUEST' ? '2px solid #0070f3' : '1px solid #d0d7de',
                backgroundColor: manualDocType === 'ESTIMATE_REQUEST' ? '#e6f0fd' : '#fff',
                color: manualDocType === 'ESTIMATE_REQUEST' ? '#0070f3' : '#333',
                cursor: 'pointer',
                fontWeight: manualDocType === 'ESTIMATE_REQUEST' ? 'bold' : 'normal',
              }}
            >
              📄 新規見積依頼書
            </button>
            <button
              data-ai-id="btn-select-manual-order"
              onClick={() => {
                setManualDocType('PURCHASE_ORDER');
                setValidationError('');
              }}
              style={{
                flex: 1,
                padding: '0.4rem',
                fontSize: '0.85rem',
                borderRadius: '4px',
                border: manualDocType === 'PURCHASE_ORDER' ? '2px solid #0070f3' : '1px solid #d0d7de',
                backgroundColor: manualDocType === 'PURCHASE_ORDER' ? '#e6f0fd' : '#fff',
                color: manualDocType === 'PURCHASE_ORDER' ? '#0070f3' : '#333',
                cursor: 'pointer',
                fontWeight: manualDocType === 'PURCHASE_ORDER' ? 'bold' : 'normal',
              }}
            >
              📦 新規発注書
            </button>
          </div>

          {/* 手入力フォーム */}
          <div
            style={{
              backgroundColor: '#f6f8fa',
              padding: '0.8rem',
              borderRadius: '6px',
              border: '1px solid #d0d7de',
              marginBottom: '0.8rem',
            }}
          >
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#24292f' }}>
              ➕ 明細の新規手入力 (DB非保存・メモリ完結)
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginBottom: '0.4rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#586069' }}>メーカー名 (任意)</label>
                <input
                  data-ai-id="input-manual-maker"
                  type="text"
                  placeholder="例: オムロン"
                  value={inputMaker}
                  onChange={(e) => setInputMaker(e.target.value)}
                  style={{ width: '100%', padding: '0.3rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #d0d7de', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#586069' }}>品名・型番 (必須)</label>
                <input
                  data-ai-id="input-manual-product"
                  type="text"
                  placeholder="例: リレー MY4N"
                  value={inputProduct}
                  onChange={(e) => setInputProduct(e.target.value)}
                  style={{ width: '100%', padding: '0.3rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #d0d7de', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '70px 70px 1fr', gap: '0.4rem', marginBottom: '0.4rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#586069' }}>数量 (必須)</label>
                <input
                  data-ai-id="input-manual-quantity"
                  type="number"
                  min="1"
                  value={inputQty}
                  onChange={(e) => setInputQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  style={{ width: '100%', padding: '0.3rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #d0d7de', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#586069' }}>単位</label>
                <input
                  data-ai-id="input-manual-unit"
                  type="text"
                  placeholder="例: 個"
                  value={inputUnit}
                  onChange={(e) => setInputUnit(e.target.value)}
                  style={{ width: '100%', padding: '0.3rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #d0d7de', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#586069' }}>
                  単価 (円) {manualDocType === 'PURCHASE_ORDER' ? '(発注時必須)' : '(任意)'}
                </label>
                <input
                  data-ai-id="input-manual-unitprice"
                  type="number"
                  min="0"
                  placeholder={manualDocType === 'PURCHASE_ORDER' ? '必須' : '未定・空欄可'}
                  value={inputUnitPrice}
                  onChange={(e) => setInputUnitPrice(e.target.value)}
                  style={{ width: '100%', padding: '0.3rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #d0d7de', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.75rem', color: '#586069' }}>備考 (任意)</label>
              <input
                data-ai-id="input-manual-remarks"
                type="text"
                placeholder="納期希望、指定納入場所など"
                value={inputRemarks}
                onChange={(e) => setInputRemarks(e.target.value)}
                style={{ width: '100%', padding: '0.3rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #d0d7de', boxSizing: 'border-box' }}
              />
            </div>

            {validationError && (
              <div
                data-ai-id="error-manual-validation"
                style={{ color: '#cf222e', fontSize: '0.8rem', marginBottom: '0.4rem', fontWeight: 'bold' }}
              >
                ⚠️ {validationError}
              </div>
            )}

            <button
              data-ai-id="btn-manual-add-item"
              onClick={handleAddManualItem}
              style={{
                width: '100%',
                padding: '0.5rem',
                backgroundColor: '#2da44e',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.85rem',
              }}
            >
              ＋ 明細を追加
            </button>
          </div>

          {/* 入力済み明細リスト */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {manualItems.length === 0 ? (
              <p style={{ color: '#888', textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem' }}>
                手入力明細はありません。上のフォームから追加してください。
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {manualItems.map((item, index) => (
                  <div
                    key={item.id}
                    style={{
                      border: '1px solid #e1e4e8',
                      borderRadius: '6px',
                      padding: '0.6rem 0.8rem',
                      backgroundColor: '#fafbfc',
                      fontSize: '0.85rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                      <span>
                        #{index + 1} {item.manufacturer ? `[${item.manufacturer}] ` : ''}{item.productName}
                      </span>
                      <button
                        data-ai-id={`btn-manual-remove-${item.id}`}
                        onClick={() => handleRemoveManualItem(item.id)}
                        style={{ color: '#cf222e', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem' }}
                      >
                        削除
                      </button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#586069', marginTop: '0.2rem' }}>
                      <span>数量: {item.quantity} {item.unit || '個'}</span>
                      <span>
                        単価: {item.unitPrice !== undefined ? `¥${item.unitPrice.toLocaleString()}` : '―'}
                      </span>
                    </div>
                    {item.remarks && (
                      <div style={{ fontSize: '0.75rem', color: '#6e7781', marginTop: '0.2rem' }}>
                        備考: {item.remarks}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 手入力カート フッター */}
          <div style={{ borderTop: '1px solid #e1e4e8', paddingTop: '0.8rem', marginTop: '0.8rem' }}>
            {manualDocType === 'PURCHASE_ORDER' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.8rem' }}>
                <span>合計金額(発注):</span>
                <span>¥{manualTotalAmount.toLocaleString()}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                data-ai-id="btn-manual-clear-cart"
                onClick={handleClearManualItems}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  backgroundColor: '#f6f8fa',
                  border: '1px solid #d0d7de',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                下書きクリア
              </button>
              <button
                data-ai-id="btn-manual-generate-doc"
                onClick={handleGenerateManualDocument}
                style={{
                  flex: 2,
                  padding: '0.5rem',
                  backgroundColor: '#0070f3',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                }}
              >
                {manualDocType === 'PURCHASE_ORDER' ? '発注書PDF作成へ' : '見積依頼書PDF作成へ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
