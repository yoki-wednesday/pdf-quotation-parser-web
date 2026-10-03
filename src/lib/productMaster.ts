import { supabase } from './supabase';

export interface ProductMasterRecord {
  maker_name: string;
  item_name: string;
  unit?: string;
}

/**
 * 未登録の製品を製品マスタ (product_master) へ自動・手動同期する
 */
export async function syncProductMaster(
  items: Array<{ maker_name?: string; item_name: string; unit?: string }>
): Promise<void> {
  for (const item of items) {
    if (!item.item_name) continue;

    const maker = item.maker_name || '一般・不明';
    try {
      // 既存レコード検索
      const { data: existing } = await supabase
        .from('product_master')
        .select('id')
        .eq('maker_name', maker)
        .eq('item_name', item.item_name)
        .limit(1);

      if (!existing || existing.length === 0) {
        // 新規登録
        await supabase.from('product_master').insert([
          {
            maker_name: maker,
            item_name: item.item_name,
            unit: item.unit || '個',
          },
        ]);
      }
    } catch (err) {
      console.warn('Failed to sync product to master:', err);
    }
  }
}
