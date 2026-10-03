import { supabase } from './supabase';

export interface FavoriteItem {
  id: string;
  user_id?: string;
  maker_name?: string;
  item_name: string;
  unit_price: number;
  unit: string;
  created_at?: string;
  deleted_at?: string | null;
}

/**
 * お気に入り一覧を取得する
 */
export async function getFavoriteItems(): Promise<FavoriteItem[]> {
  try {
    const { data, error } = await supabase
      .from('favorite_items')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Failed to fetch favorite items:', error);
      return [];
    }
    return (data as FavoriteItem[]) || [];
  } catch (err) {
    console.warn('getFavoriteItems unexpected error:', err);
    return [];
  }
}

/**
 * お気に入りに追加する
 */
export async function addFavoriteItem(item: {
  maker_name?: string;
  item_name: string;
  unit_price?: number;
  unit?: string;
}): Promise<FavoriteItem | null> {
  try {
    let userId: string | undefined;
    try {
      const { data: authData } = await supabase.auth.getUser();
      userId = authData?.user?.id;
    } catch {
      // 匿名環境
    }

    const payload = {
      user_id: userId || null,
      maker_name: item.maker_name || '',
      item_name: item.item_name,
      unit_price: item.unit_price || 0,
      unit: item.unit || '個',
      deleted_at: null,
    };

    const { data, error } = await supabase
      .from('favorite_items')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Failed to add favorite item:', error);
      return null;
    }
    return data as FavoriteItem;
  } catch (err) {
    console.error('addFavoriteItem unexpected error:', err);
    return null;
  }
}

/**
 * お気に入りを削除する（物理削除）
 */
export async function removeFavoriteItem(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('favorite_items')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to remove favorite item:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('removeFavoriteItem unexpected error:', err);
    return false;
  }
}
