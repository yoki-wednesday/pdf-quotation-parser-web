import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

// Supabaseモック
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}));

describe('TEST-008-AI-ID-CHECK: UI要素識別子 (data-ai-id) 検証', () => {
  it('主要な操作要素に定義通りの data-ai-id が付与されていること', () => {
    const { container } = render(<App />);

    // ドロップゾーン
    const dropzone = container.querySelector('[data-ai-id="pdf-upload-dropzone"]');
    expect(dropzone).toBeInTheDocument();

    // ファイル入力
    const fileInput = container.querySelector('[data-ai-id="pdf-file-input"]');
    expect(fileInput).toBeInTheDocument();
  });

  it('PDFクラウド非保存ポリシーの案内文が表示されていること (REQ-001/016)', () => {
    render(<App />);
    expect(
      screen.getByText(/本システムはPDFファイルをサーバーに送信・保存せず/i)
    ).toBeInTheDocument();
  });
});
