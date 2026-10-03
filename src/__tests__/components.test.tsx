import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PriceSearch } from '../components/PriceSearch';
import { CartDrawer } from '../components/CartDrawer';
import { SettingsModal } from '../components/SettingsModal';
import { AuthModal } from '../components/AuthModal';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnValue({ data: [], error: null }),
      ilike: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      limit: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        data: [
          {
            id: 'item-101',
            item_name: 'リレー MY4N-D2',
            unit_price: 1500,
            unit: '個',
            quantity: 5,
            maker_name: 'オムロン',
            estimates: {
              estimate_number: 'EST-999',
              issue_date: '2026-10-01',
              customer_name: '岩瀬産業',
            },
          },
        ],
        error: null,
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
    auth: {
      signUp: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { user: { email: 'test@example.com' } }, error: null }),
    },
  },
}));

describe('Phase 9 コンポーネント単体検証テスト', () => {
  it('PriceSearch: 検索実行と結果表示、かご追加トリガー', async () => {
    const handleAddToCart = vi.fn();
    render(<PriceSearch onAddToCart={handleAddToCart} />);

    const input = screen.getByPlaceholderText(/品名・型番・メーカー名を入力/i);
    fireEvent.change(input, { target: { value: 'リレー' } });

    const searchBtn = screen.getByRole('button', { name: '検索' });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(screen.getByText(/リレー MY4N-D2/i)).toBeInTheDocument();
      expect(screen.getByText(/¥1,500/i)).toBeInTheDocument();
    });

    const addBtn = screen.getByRole('button', { name: 'カートに追加' });
    fireEvent.click(addBtn);

    expect(handleAddToCart).toHaveBeenCalledWith(
      expect.objectContaining({
        item_name: 'リレー MY4N-D2',
        unit_price: 1500,
      })
    );
  });

  it('CartDrawer: 数量変更、削除、クリア操作', () => {
    const handleUpdateQuantity = vi.fn();
    const handleRemoveItem = vi.fn();
    const handleClearCart = vi.fn();
    const handleOpenDocModal = vi.fn();

    const dummyItems = [
      {
        id: 'c1',
        item_name: 'テスト部材A',
        quantity: 2,
        unit: '個',
        unit_price: 300,
        amount: 600,
      },
    ];

    render(
      <CartDrawer
        isOpen={true}
        onClose={vi.fn()}
        items={dummyItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        onOpenDocumentModal={handleOpenDocModal}
      />
    );

    expect(screen.getByText(/テスト部材A/i)).toBeInTheDocument();
    expect(screen.getAllByText(/¥600/i).length).toBeGreaterThan(0);

    const delBtn = screen.getByRole('button', { name: '削除' });
    fireEvent.click(delBtn);
    expect(handleRemoveItem).toHaveBeenCalledWith('c1');

    const clearBtn = screen.getByRole('button', { name: 'カートを空にする' });
    fireEvent.click(clearBtn);
    expect(handleClearCart).toHaveBeenCalled();

    const checkoutBtn = screen.getByRole('button', { name: '帳票作成へ' });
    fireEvent.click(checkoutBtn);
    expect(handleOpenDocModal).toHaveBeenCalled();
  });

  it('SettingsModal: 自社設定の入力と保存', async () => {
    const handleSaved = vi.fn();
    render(<SettingsModal isOpen={true} onClose={vi.fn()} onSaved={handleSaved} />);

    const saveBtn = screen.getByRole('button', { name: '設定を保存' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText(/自社設定を保存しました/i)).toBeInTheDocument();
    });
  });

  it('AuthModal: ログイン試行と成功ハンドラ呼び出し', async () => {
    const handleAuthSuccess = vi.fn();
    const { container } = render(<AuthModal isOpen={true} onClose={vi.fn()} onAuthSuccess={handleAuthSuccess} />);

    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement;
    const passInput = container.querySelector('input[type="password"]') as HTMLInputElement;

    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passInput, { target: { value: 'password123' } });

    const submitBtn = screen.getByRole('button', { name: 'ログイン' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/ログインに成功しました/i)).toBeInTheDocument();
      expect(handleAuthSuccess).toHaveBeenCalledWith('test@example.com');
    });
  });
});
