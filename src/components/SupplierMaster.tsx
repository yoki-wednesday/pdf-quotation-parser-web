import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface Supplier {
  id: string;
  user_id?: string;
  name: string;
  person_last_name?: string;
  person_first_name?: string;
  person_middle_name?: string;
  email?: string;
}

interface SupplierMasterProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SupplierMaster({ isOpen, onClose }: SupplierMasterProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchSuppliers = async () => {
    try {
      const { data, error: err } = await supabase
        .from('suppliers')
        .select('*')
        .is('deleted_at', null)
        .order('name');
      if (err) throw err;
      setSuppliers(data || []);
    } catch (err: any) {
      console.error('Fetch suppliers error:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSuppliers();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsLoading(true);
    setError('');

    try {
      let currentUserId: string | null = null;
      if (supabase?.auth && typeof supabase.auth.getUser === 'function') {
        try {
          const { data } = await supabase.auth.getUser();
          currentUserId = data?.user?.id || null;
        } catch {
          // ignore auth error
        }
      }

      const { error: err } = await supabase.from('suppliers').insert([
        {
          user_id: currentUserId,
          name: name.trim(),
          person_last_name: lastName.trim(),
          person_middle_name: middleName.trim(),
          person_first_name: firstName.trim(),
          email: email.trim(),
        },
      ]);
      if (err) throw err;
      setName('');
      setLastName('');
      setMiddleName('');
      setFirstName('');
      setEmail('');
      fetchSuppliers();
    } catch (err: any) {
      setError(`登録エラー: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('この商社を削除（論理削除）しますか？')) return;
    try {
      await supabase
        .from('suppliers')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      fetchSuppliers();
    } catch (err: any) {
      alert(`削除失敗: ${err.message}`);
    }
  };

  const formatPersonName = (s: Supplier) => {
    const full = [s.person_last_name, s.person_middle_name, s.person_first_name]
      .filter(Boolean)
      .join(' ');
    return full ? `${full} 様` : '-';
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          padding: '2rem',
          borderRadius: '8px',
          width: '760px',
          maxWidth: '92vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0 }}>🏢 取引先・商社マスタ管理</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>
            ✕
          </button>
        </div>

        {error && <div style={{ color: '#cf222e', marginBottom: '1rem' }}>{error}</div>}

        <form onSubmit={handleAdd} style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.2rem' }}>商社・取引先名 *</label>
              <input
                type="text"
                required
                value={name}
                placeholder="例: 岩瀬産業株式会社"
                onChange={(e) => setName(e.target.value)}
                style={{ width: '100%', padding: '0.45rem', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.2rem' }}>メールアドレス</label>
              <input
                type="email"
                value={email}
                placeholder="sample@example.com"
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', padding: '0.45rem', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.2rem' }}>担当者(姓)</label>
              <input
                type="text"
                value={lastName}
                placeholder="例: 山田"
                onChange={(e) => setLastName(e.target.value)}
                style={{ width: '100%', padding: '0.45rem', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.2rem' }}>ミドルネーム</label>
              <input
                type="text"
                value={middleName}
                placeholder="任意"
                onChange={(e) => setMiddleName(e.target.value)}
                style={{ width: '100%', padding: '0.45rem', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.2rem' }}>担当者(名)</label>
              <input
                type="text"
                value={firstName}
                placeholder="例: 太郎"
                onChange={(e) => setFirstName(e.target.value)}
                style={{ width: '100%', padding: '0.45rem', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={isLoading}
              style={{
                padding: '0.45rem 1.25rem',
                backgroundColor: '#2ea44f',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                fontSize: '0.9rem',
              }}
            >
              ＋ 商社を追加
            </button>
          </div>
        </form>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f6f8fa', textAlign: 'left' }}>
              <th style={{ padding: '0.5rem', border: '1px solid #ddd' }}>商社名</th>
              <th style={{ padding: '0.5rem', border: '1px solid #ddd' }}>ご担当者</th>
              <th style={{ padding: '0.5rem', border: '1px solid #ddd' }}>メールアドレス</th>
              <th style={{ padding: '0.5rem', border: '1px solid #ddd', width: '60px' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '1rem', textAlign: 'center', color: '#888' }}>
                  登録されている商社はありません。
                </td>
              </tr>
            ) : (
              suppliers.map((s) => (
                <tr key={s.id}>
                  <td style={{ padding: '0.5rem', border: '1px solid #ddd', fontWeight: 'bold' }}>{s.name}</td>
                  <td style={{ padding: '0.5rem', border: '1px solid #ddd' }}>
                    {formatPersonName(s)}
                  </td>
                  <td style={{ padding: '0.5rem', border: '1px solid #ddd' }}>{s.email || '-'}</td>
                  <td style={{ padding: '0.5rem', border: '1px solid #ddd', textAlign: 'center' }}>
                    <button
                      onClick={() => handleDelete(s.id)}
                      style={{ color: '#cf222e', border: 'none', background: 'none', cursor: 'pointer' }}
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <button
            onClick={onClose}
            style={{ padding: '0.5rem 1rem', border: '1px solid #ccc', background: '#fff', borderRadius: '4px', cursor: 'pointer' }}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
