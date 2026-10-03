import type { CartItem } from '../lib/cart';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: string, qty: number) => void;
  onUpdateNote?: (id: string, note: string) => void;
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  onOpenDocumentModal?: () => void;
}

export function CartDrawer({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onUpdateNote,
  onRemoveItem,
  onClearCart,
  onOpenDocumentModal,
}: CartDrawerProps) {
  if (!isOpen) return null;

  const totalAmount = items.reduce((acc, it) => acc + it.amount, 0);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '420px',
        backgroundColor: '#fff',
        boxShadow: '-2px 0 8px rgba(0,0,0,0.15)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        padding: '1.5rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>🛒 カート ({items.length}件)</h3>
        <button
          onClick={onClose}
          style={{ border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer' }}
        >
          ✕
        </button>
      </div>

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
              onClick={onOpenDocumentModal}
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
    </div>
  );
}
