import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getSearchVariants, splitSearchKeywords } from '../lib/search';
import { getFavoriteItems, addFavoriteItem, removeFavoriteItem, type FavoriteItem } from '../lib/favorites';
import type { CartItem } from '../lib/cart';

interface SearchResultItem {
  id: string;
  item_name: string;
  unit_price: number;
  unit: string;
  quantity: number;
  maker_name?: string;
  estimate_number?: string;
  issue_date?: string;
  customer_name?: string;
}

interface PriceSearchProps {
  onAddToCart: (item: Omit<CartItem, 'id'>) => void;
}

export function PriceSearch({ onAddToCart }: PriceSearchProps) {
  const [activeTab, setActiveTab] = useState<'search' | 'favorites'>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);

  // お気に入り一覧の読み込み
  const loadFavorites = async () => {
    setIsLoadingFavorites(true);
    try {
      const items = await getFavoriteItems();
      setFavorites(items);
    } finally {
      setIsLoadingFavorites(false);
    }
  };

  useEffect(() => {
    loadFavorites();
  }, []);

  // 複数キーワード対応AND検索
  const executeSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    const keywords = splitSearchKeywords(trimmed);
    if (keywords.length === 0) return;

    setIsSearching(true);
    setSearchMessage('');

    try {
      // Supabaseクエリ構築
      let queryBuilder = supabase
        .from('estimate_items')
        .select(`
          id,
          item_name,
          unit_price,
          unit,
          quantity,
          maker_name,
          estimates (
            estimate_number,
            issue_date,
            customer_name
          )
        `);

      // 各キーワードごとに、表記揺れバリアント（品名 OR メーカー名）を .or() でチェーン（= AND検索）
      for (const kw of keywords) {
        const variants = getSearchVariants(kw);
        const orConditions = variants
          .flatMap((v) => [`item_name.ilike.%${v}%`, `maker_name.ilike.%${v}%`])
          .join(',');
        queryBuilder = queryBuilder.or(orConditions);
      }

      const { data, error } = await queryBuilder.limit(50);

      if (error) {
        throw error;
      }

      const items = data || [];
      const uniqueMap = new Map<string, SearchResultItem>();
      for (const row of items) {
        if (!uniqueMap.has(row.id)) {
          const est = (row as any).estimates || {};
          uniqueMap.set(row.id, {
            id: row.id,
            item_name: row.item_name,
            unit_price: row.unit_price,
            unit: row.unit || '個',
            quantity: row.quantity || 1,
            maker_name: row.maker_name,
            estimate_number: est.estimate_number || '-',
            issue_date: est.issue_date || '-',
            customer_name: est.customer_name || '-',
          });
        }
      }

      const formattedResults = Array.from(uniqueMap.values());
      setResults(formattedResults);

      if (formattedResults.length === 0) {
        setSearchMessage(`「${keywords.join(' + ')}」に一致する仕入単価実績は見つかりませんでした。`);
      } else {
        setSearchMessage(`${formattedResults.length} 件の仕入単価実績が見つかりました（AND検索）。`);
      }
    } catch (err: any) {
      console.error('Search error:', err);
      setSearchMessage(`検索中にエラーが発生しました: ${err.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  // お気に入りトグル（登録または解除）
  const handleToggleFavorite = async (item: {
    id?: string;
    maker_name?: string;
    item_name: string;
    unit_price?: number;
    unit?: string;
  }) => {
    // 既存のお気に入りか判定 (item_name と maker_name で判定)
    const existing = favorites.find(
      (f) =>
        f.item_name === item.item_name &&
        (f.maker_name || '') === (item.maker_name || '')
    );

    if (existing) {
      // 解除
      await removeFavoriteItem(existing.id);
      setFavorites((prev) => prev.filter((f) => f.id !== existing.id));
    } else {
      // 登録
      const created = await addFavoriteItem({
        maker_name: item.maker_name,
        item_name: item.item_name,
        unit_price: item.unit_price,
        unit: item.unit,
      });
      if (created) {
        setFavorites((prev) => [created, ...prev]);
      }
    }
  };

  const isFavorited = (itemName: string, makerName?: string) => {
    return favorites.some(
      (f) => f.item_name === itemName && (f.maker_name || '') === (makerName || '')
    );
  };

  return (
    <div style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.75rem' }}>
        <h2 style={{ margin: 0 }}>履歴検索</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            data-ai-id="btn-tab-history"
            onClick={() => setActiveTab('search')}
            style={{
              padding: '0.4rem 0.9rem',
              backgroundColor: activeTab === 'search' ? '#0070f3' : '#f0f0f0',
              color: activeTab === 'search' ? '#fff' : '#333',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.85rem',
            }}
          >
            🔍 履歴検索
          </button>
          <button
            data-ai-id="btn-tab-favorites"
            onClick={() => {
              setActiveTab('favorites');
              loadFavorites();
            }}
            style={{
              padding: '0.4rem 0.9rem',
              backgroundColor: activeTab === 'favorites' ? '#f59e0b' : '#f0f0f0',
              color: activeTab === 'favorites' ? '#fff' : '#333',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.85rem',
            }}
          >
            ★ お気に入り ({favorites.length})
          </button>
        </div>
      </div>

      {activeTab === 'search' ? (
        <div>
          <p style={{ color: '#666', fontSize: '0.85rem', marginTop: 0 }}>
            半角・全角カタカナや平仮名、大文字小文字の揺れを自動吸収して横断検索します。スペースまたはカンマ区切りで複数キーワード（AND検索）も可能です。
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              data-ai-id="input-price-search-query"
              type="text"
              value={query}
              placeholder="品名・型番・メーカー名を入力 (例: オムロン リレー, MY4N)"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && executeSearch()}
              style={{ flex: 1, padding: '0.6rem 1rem', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <button
              data-ai-id="btn-execute-price-search"
              onClick={executeSearch}
              disabled={isSearching || !query.trim()}
              style={{
                padding: '0.6rem 1.5rem',
                backgroundColor: '#0070f3',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: isSearching ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
              }}
            >
              {isSearching ? '検索中...' : '検索'}
            </button>
          </div>

          {searchMessage && (
            <div style={{ marginBottom: '1rem', fontSize: '0.9rem', color: results.length > 0 ? '#1a7f37' : '#666' }}>
              {searchMessage}
            </div>
          )}

          {results.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f6f8fa', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem', border: '1px solid #ddd', width: '50px', textAlign: 'center' }}>★</th>
                  <th style={{ padding: '0.5rem', border: '1px solid #ddd' }}>見積番号</th>
                  <th style={{ padding: '0.5rem', border: '1px solid #ddd' }}>見積日</th>
                  <th style={{ padding: '0.5rem', border: '1px solid #ddd' }}>メーカー</th>
                  <th style={{ padding: '0.5rem', border: '1px solid #ddd' }}>品名・型番</th>
                  <th style={{ padding: '0.5rem', border: '1px solid #ddd', width: '90px' }}>採用単価</th>
                  <th style={{ padding: '0.5rem', border: '1px solid #ddd', width: '85px', textAlign: 'center' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row) => {
                  const fav = isFavorited(row.item_name, row.maker_name);
                  return (
                    <tr key={row.id}>
                      <td style={{ padding: '0.5rem', border: '1px solid #ddd', textAlign: 'center' }}>
                        <button
                          data-ai-id={`btn-toggle-favorite-${row.id}`}
                          onClick={() => handleToggleFavorite(row)}
                          title={fav ? 'お気に入りから解除' : 'お気に入りに追加'}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '1.2rem',
                            color: fav ? '#f59e0b' : '#ccc',
                            padding: '0 0.2rem',
                          }}
                        >
                          {fav ? '★' : '☆'}
                        </button>
                      </td>
                      <td style={{ padding: '0.5rem', border: '1px solid #ddd' }}>{row.estimate_number}</td>
                      <td style={{ padding: '0.5rem', border: '1px solid #ddd' }}>{row.issue_date}</td>
                      <td style={{ padding: '0.5rem', border: '1px solid #ddd' }}>{row.maker_name || '-'}</td>
                      <td style={{ padding: '0.5rem', border: '1px solid #ddd' }}>{row.item_name}</td>
                      <td style={{ padding: '0.5rem', border: '1px solid #ddd', textAlign: 'right', fontWeight: 'bold' }}>
                        ¥{row.unit_price.toLocaleString()}
                      </td>
                      <td style={{ padding: '0.5rem', border: '1px solid #ddd', textAlign: 'center' }}>
                        <button
                          data-ai-id={`btn-add-to-cart-${row.id}`}
                          onClick={() =>
                            onAddToCart({
                              item_name: row.item_name,
                              unit_price: row.unit_price,
                              quantity: 1,
                              unit: row.unit,
                              amount: row.unit_price,
                              maker_name: row.maker_name,
                              source_estimate_number: row.estimate_number,
                              source_date: row.issue_date,
                            })
                          }
                          style={{
                            padding: '0.3rem 0.6rem',
                            backgroundColor: '#2ea44f',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                          }}
                        >
                          カートに追加
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div>
          <p style={{ color: '#666', fontSize: '0.85rem', marginTop: 0 }}>
            検索結果や日々の発注から登録した「お気に入りアイテム」一覧です。ワンクリックでカートに追加できます。
          </p>

          {isLoadingFavorites ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>読み込み中...</div>
          ) : favorites.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#888', border: '1px dashed #ccc', borderRadius: '4px' }}>
              お気に入りに登録されたアイテムはありません。履歴検索結果の「☆」をクリックすると登録できます。
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f6f8fa', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem', border: '1px solid #ddd', width: '50px', textAlign: 'center' }}>★</th>
                  <th style={{ padding: '0.5rem', border: '1px solid #ddd' }}>メーカー</th>
                  <th style={{ padding: '0.5rem', border: '1px solid #ddd' }}>品名・型番</th>
                  <th style={{ padding: '0.5rem', border: '1px solid #ddd', width: '90px' }}>参考単価</th>
                  <th style={{ padding: '0.5rem', border: '1px solid #ddd', width: '60px' }}>単位</th>
                  <th style={{ padding: '0.5rem', border: '1px solid #ddd', width: '85px', textAlign: 'center' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {favorites.map((fav) => (
                  <tr key={fav.id}>
                    <td style={{ padding: '0.5rem', border: '1px solid #ddd', textAlign: 'center' }}>
                      <button
                        data-ai-id={`btn-toggle-favorite-${fav.id}`}
                        onClick={() => handleToggleFavorite(fav)}
                        title="お気に入りから解除"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '1.2rem',
                          color: '#f59e0b',
                          padding: '0 0.2rem',
                        }}
                      >
                        ★
                      </button>
                    </td>
                    <td style={{ padding: '0.5rem', border: '1px solid #ddd' }}>{fav.maker_name || '-'}</td>
                    <td style={{ padding: '0.5rem', border: '1px solid #ddd' }}>{fav.item_name}</td>
                    <td style={{ padding: '0.5rem', border: '1px solid #ddd', textAlign: 'right', fontWeight: 'bold' }}>
                      ¥{fav.unit_price.toLocaleString()}
                    </td>
                    <td style={{ padding: '0.5rem', border: '1px solid #ddd' }}>{fav.unit || '個'}</td>
                    <td style={{ padding: '0.5rem', border: '1px solid #ddd', textAlign: 'center' }}>
                      <button
                        data-ai-id={`btn-add-to-cart-${fav.id}`}
                        onClick={() =>
                          onAddToCart({
                            item_name: fav.item_name,
                            unit_price: fav.unit_price,
                            quantity: 1,
                            unit: fav.unit,
                            amount: fav.unit_price,
                            maker_name: fav.maker_name,
                          })
                        }
                        style={{
                          padding: '0.3rem 0.6rem',
                          backgroundColor: '#2ea44f',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                        }}
                      >
                        カートに追加
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
