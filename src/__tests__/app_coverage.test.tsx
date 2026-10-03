import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';

// Supabaseモック
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'test-est-id' }, error: null }),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })),
    auth: {
      signUp: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { user: { email: 'test@example.com' } }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { email: 'test@example.com' } } }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { email: 'test@example.com' } }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

describe('Phase 9 カバレッジ補完テスト: App.tsx & ガードレール検証', () => {
  it('PDF以外のファイルを選択した場合にエラーメッセージが表示されること (REQ-005)', async () => {
    const { container } = render(<App />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    const textFile = new File(['dummy'], 'sample.txt', { type: 'text/plain' });
    fireEvent.change(fileInput, { target: { files: [textFile] } });

    expect(screen.getByText(/PDFファイル形式（\.pdf）のみ対応しています/i)).toBeInTheDocument();
  });

  it('5MBを超える巨大PDFを選択した場合に即座にリジェクトされること (Phase 4 TECH-001)', async () => {
    const { container } = render(<App />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    const largeFile = new File([new Uint8Array(6 * 1024 * 1024)], 'large.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    expect(screen.getByText(/ファイルサイズが制限/i)).toBeInTheDocument();
  });

  it('タブ切り替え（履歴検索 ⇔ 取込）が正常に動作すること (REQ-007)', () => {
    render(<App />);
    const searchTabBtn = screen.getByText(/履歴検索 & 帳票作成/i);
    fireEvent.click(searchTabBtn);

    expect(screen.getByText(/半角・全角カタカナや平仮名/i)).toBeInTheDocument();

    const parseTabBtn = screen.getByText(/見積書取込 & パース/i);
    fireEvent.click(parseTabBtn);

    expect(screen.getByText(/本システムはPDFファイルをサーバーに送信・保存せず/i)).toBeInTheDocument();
  });

  it('設定モーダルの開閉およびログイン状態の表示が動作すること (REQ-012, REQ-017)', async () => {
    render(<App />);
    
    // ログイン済み状態の表示確認
    expect(await screen.findByText(/test@example\.com/i)).toBeInTheDocument();

    const settingsBtn = screen.getByText(/⚙️ 設定/i);
    fireEvent.click(settingsBtn);

    expect(screen.getByText(/自社情報・基本設定/i)).toBeInTheDocument();
  });

  it('ログアウト・未ログイン時に操作ロックと警告バナーが表示されること', async () => {
    render(<App />);
    expect(await screen.findByText(/test@example\.com/i)).toBeInTheDocument();

    // ログアウト実行
    const logoutBtn = screen.getByRole('button', { name: 'ログアウト' });
    fireEvent.click(logoutBtn);

    // ロックバナーおよびドロップゾーンの無効化メッセージの表示確認
    expect(await screen.findByText(/🔒 ログインが必要です/i)).toBeInTheDocument();
    expect(screen.getByText(/ログイン後に見積書PDFの取込・解析が利用可能になります/i)).toBeInTheDocument();

    // 商社マスタボタン・設定ボタンが無効化されていること
    expect(screen.getByRole('button', { name: /🏢 商社マスタ/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /⚙️ 設定/i })).toBeDisabled();
  });
});
