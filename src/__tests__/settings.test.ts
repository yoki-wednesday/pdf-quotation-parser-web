import { describe, it, expect, vi } from 'vitest';
import { supabase } from '../lib/supabase';
import { syncProductMaster } from '../lib/productMaster';

describe('TEST-013-SETTINGS-CRUD: マスタ設定および製品マスタ同期検証', () => {
  it('未登録製品が product_master へ自動同期されること', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      if (table === 'product_master') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          insert: insertMock,
        } as any;
      }
      return {} as any;
    });

    await syncProductMaster([
      { maker_name: 'オムロン', item_name: 'リレー G2R-1', unit: '個' },
    ]);

    expect(insertMock).toHaveBeenCalled();
  });
});
