import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';

// Supabaseモック
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { email: 'operator@example.com' } } }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { email: 'operator@example.com' } }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

// pdfjs-distモック
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(() => ({
    promise: Promise.resolve({
      numPages: 1,
      getPage: vi.fn(() =>
        Promise.resolve({
          getTextContent: vi.fn(() =>
            Promise.resolve({
              items: [
                {
                  str: 'No.EST-2026-999 2026/03/01 株式会社テスト 朝海様 合計 ¥50,000 モータ 5 台 10000 50000',
                },
              ],
            })
          ),
        })
      ),
    }),
  })),
}));

// hashモック
vi.mock('../lib/hash', () => ({
  calculateFileHash: vi.fn().mockResolvedValue('fake-hash-64chars-long-0000000000000000000000000000000000000000000'),
}));

describe('TEST-014-MD-EXPORT: App.tsx AIマークダウン出力UI統合テスト', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('PDFパース完了後に btn-copy-markdown ボタンが表示され、クリップボードコピーが動作すること', async () => {
    // navigator.clipboard モック
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const { container } = render(<App />);

    // 1. PDFファイルを選択
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const dummyPdf = new File(['%PDF-1.4 dummy'], 'quotation.pdf', { type: 'application/pdf' });
    dummyPdf.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));
    fireEvent.change(fileInput, { target: { files: [dummyPdf] } });

    // ハッシュ計算の完了を待機（解析ボタンが表示・クリック可能になるまで）
    const parseBtn = await screen.findByRole('button', { name: /PDFを解析する/i });
    // 少し待機してfileHashステートの更新を確実に反映
    await waitFor(() => {
      expect(screen.getByText(/選択中: quotation\.pdf/i)).toBeInTheDocument();
    });

    // 2. 解析ボタン押下
    fireEvent.click(parseBtn);

    // 3. パース完了を待機
    await waitFor(() => {
      expect(screen.getByText(/抽出プレビュー・修正/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    // 4. btn-copy-markdown の存在確認
    const copyBtn = container.querySelector('[data-ai-id="btn-copy-markdown"]');
    expect(copyBtn).toBeInTheDocument();

    // 5. ボタンクリック
    fireEvent.click(copyBtn!);

    // 6. クリップボードへの転送と通知メッセージの確認
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(1);
    });

    const copiedText = writeTextMock.mock.calls[0][0];
    expect(copiedText).toContain('# 見積書パース結果 (Quotation Parse Result)');
    expect(copiedText).toContain('EST-2026-999');

    expect(
      screen.getByText(/AI用マークダウンをクリップボードにコピーしました/i)
    ).toBeInTheDocument();
  });

  it('clipboard API非対応環境で execCommand フォールバックが動作すること', async () => {
    // navigator.clipboard を未定義にする
    const originalClipboard = navigator.clipboard;
    // @ts-ignore
    delete navigator.clipboard;

    const execCommandMock = vi.fn().mockReturnValue(true);
    document.execCommand = execCommandMock;

    const { container } = render(<App />);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const dummyPdf = new File(['%PDF-1.4 dummy'], 'quotation.pdf', { type: 'application/pdf' });
    dummyPdf.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));
    fireEvent.change(fileInput, { target: { files: [dummyPdf] } });

    const parseBtn = await screen.findByRole('button', { name: /PDFを解析する/i });
    await waitFor(() => {
      expect(screen.getByText(/選択中: quotation\.pdf/i)).toBeInTheDocument();
    });

    fireEvent.click(parseBtn);

    await waitFor(() => {
      expect(screen.getByText(/抽出プレビュー・修正/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    const copyBtn = container.querySelector('[data-ai-id="btn-copy-markdown"]');
    fireEvent.click(copyBtn!);

    await waitFor(() => {
      expect(execCommandMock).toHaveBeenCalledWith('copy');
      expect(
        screen.getByText(/AI用マークダウンをクリップボードにコピーしました/i)
      ).toBeInTheDocument();
    });

    // 復元
    Object.assign(navigator, { clipboard: originalClipboard });
  });
});
