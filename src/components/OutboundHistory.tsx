import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface OutboundProject {
  id: string;
  project_name: string;
  document_type: string;
  status: string;
  total_amount: number;
  target_date?: string;
  notes?: string;
  created_at: string;
}

export function OutboundHistory() {
  const [projects, setProjects] = useState<OutboundProject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchProjects = async () => {
    setIsLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('procurement_projects')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (err) throw err;
      setProjects(data || []);
    } catch (err: any) {
      console.error('Failed to fetch outbound history:', err);
      setError(`履歴取得に失敗しました: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  return (
    <div style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>📋 帳票発行・調達履歴</h2>
        <button
          onClick={fetchProjects}
          disabled={isLoading}
          style={{
            padding: '0.4rem 0.8rem',
            backgroundColor: '#f6f8fa',
            border: '1px solid #d0d7de',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          {isLoading ? '更新中...' : '更新'}
        </button>
      </div>

      {error && <div style={{ color: '#cf222e', marginBottom: '1rem' }}>{error}</div>}

      {projects.length === 0 ? (
        <p style={{ color: '#888', textAlign: 'center', padding: '2rem' }}>発行履歴はありません。</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f6f8fa', textAlign: 'left' }}>
              <th style={{ padding: '0.5rem', border: '1px solid #ddd' }}>発行日時</th>
              <th style={{ padding: '0.5rem', border: '1px solid #ddd' }}>帳票種別</th>
              <th style={{ padding: '0.5rem', border: '1px solid #ddd' }}>案件名 / 宛先</th>
              <th style={{ padding: '0.5rem', border: '1px solid #ddd' }}>希望納期</th>
              <th style={{ padding: '0.5rem', border: '1px solid #ddd', textAlign: 'right' }}>金額 (税抜)</th>
              <th style={{ padding: '0.5rem', border: '1px solid #ddd' }}>条件・備考</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id}>
                <td style={{ padding: '0.5rem', border: '1px solid #ddd', whiteSpace: 'nowrap' }}>
                  {new Date(p.created_at).toLocaleString()}
                </td>
                <td style={{ padding: '0.5rem', border: '1px solid #ddd', whiteSpace: 'nowrap' }}>
                  {p.document_type === 'ESTIMATE_REQUEST' ? '📄 見積依頼書' : '📑 発注書'}
                </td>
                <td style={{ padding: '0.5rem', border: '1px solid #ddd' }}>{p.project_name}</td>
                <td style={{ padding: '0.5rem', border: '1px solid #ddd', whiteSpace: 'nowrap' }}>
                  {p.target_date || '-'}
                </td>
                <td style={{ padding: '0.5rem', border: '1px solid #ddd', textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                  {p.total_amount > 0 ? `¥${p.total_amount.toLocaleString()}` : '-'}
                </td>
                <td style={{ padding: '0.5rem', border: '1px solid #ddd', fontSize: '0.85rem', color: '#555' }}>
                  {p.notes || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
