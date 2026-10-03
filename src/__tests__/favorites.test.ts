import { describe, it, expect, vi } from 'vitest';
import { getFavoriteItems, addFavoriteItem, removeFavoriteItem } from '../lib/favorites';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'favorite_items') {
        return {
          select: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'fav-1',
                    maker_name: 'オムロン',
                    item_name: 'リレー MY4N',
                    unit_price: 1200,
                    unit: '個',
                  },
                ],
                error: null,
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'fav-2',
                  maker_name: '三菱電機',
                  item_name: 'CP30-BA',
                  unit_price: 3500,
                  unit: '個',
                },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      return {};
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } } }),
    },
  },
}));

describe('お気に入り管理 (favorites.ts) 単体テスト', () => {
  it('お気に入り一覧が正しく取得できること', async () => {
    const items = await getFavoriteItems();
    expect(items.length).toBe(1);
    expect(items[0].item_name).toBe('リレー MY4N');
  });

  it('お気に入りの追加が正しく行われること', async () => {
    const created = await addFavoriteItem({
      maker_name: '三菱電機',
      item_name: 'CP30-BA',
      unit_price: 3500,
    });
    expect(created).not.toBeNull();
    expect(created?.item_name).toBe('CP30-BA');
  });

  it('お気に入りの削除（物理削除）が正しく行われること', async () => {
    const success = await removeFavoriteItem('fav-1');
    expect(success).toBe(true);
  });
});
