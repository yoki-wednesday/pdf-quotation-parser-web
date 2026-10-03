import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DEFAULT_COMPANY_INFO, type CompanyInfo } from '../lib/pdfGenerator';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (info: CompanyInfo) => void;
}

export function SettingsModal({ isOpen, onClose, onSaved }: SettingsModalProps) {
  const [info, setInfo] = useState<CompanyInfo>(DEFAULT_COMPANY_INFO);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  
  const [recordId, setRecordId] = useState<string | null>(null);
  
  const [lastName, setLastName] = useState(() => {
    const parts = DEFAULT_COMPANY_INFO.personInCharge.split(/[ 　]+/);
    return parts[0] || '';
  });
  const [firstName, setFirstName] = useState(() => {
    const parts = DEFAULT_COMPANY_INFO.personInCharge.split(/[ 　]+/);
    return parts.length > 1 ? parts.slice(1).join(' ') : '';
  });

  const [middleName, setMiddleName] = useState('');
  const [pdfSavePath, setPdfSavePath] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    // 1. ローカルキャッシュ（localStorage）から復元
    try {
      const cached = localStorage.getItem('user_settings_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed) {
          setInfo(parsed);
          setMiddleName(parsed.personMiddleName || '');
          setPdfSavePath(parsed.pdfSavePath || '');
          const parts = (parsed.personInCharge || '').split(/[ 　]+/);
          if (parts.length > 1) {
            setLastName(parts[0]);
            setFirstName(parts.slice(1).join(' '));
          } else {
            setLastName(parsed.personInCharge || '');
            setFirstName('');
          }
        }
      }
    } catch {
      // ignore
    }

    // 2. Supabaseから取得試行
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          setRecordId(data.id);
          setMiddleName(data.person_middle_name || '');
          setPdfSavePath(data.pdf_save_path || '');
          
          if (data.person_last_name || data.person_first_name) {
            setLastName(data.person_last_name || '');
            setFirstName(data.person_first_name || '');
          } else {
            const pic = data.person_in_charge || DEFAULT_COMPANY_INFO.personInCharge;
            const parts = pic.split(/[ 　]+/);
            if (parts.length > 1) {
              setLastName(parts[0]);
              setFirstName(parts.slice(1).join(' '));
            } else {
              setLastName(pic);
              setFirstName('');
            }
          }
          
          const loadedInfo = {
            name: data.company_name || DEFAULT_COMPANY_INFO.name,
            address: data.address || DEFAULT_COMPANY_INFO.address,
            tel: data.tel || DEFAULT_COMPANY_INFO.tel,
            fax: data.fax || DEFAULT_COMPANY_INFO.fax,
            email: data.email || DEFAULT_COMPANY_INFO.email,
            personInCharge: data.person_in_charge || DEFAULT_COMPANY_INFO.personInCharge,
          };
          setInfo(loadedInfo);
          try {
            localStorage.setItem(
              'user_settings_cache',
              JSON.stringify({
                ...loadedInfo,
                personMiddleName: data.person_middle_name || '',
                pdfSavePath: data.pdf_save_path || '',
              })
            );
          } catch {
            // ignore
          }
        }
      } catch {
        // デフォルト設定を保持
      }
    };
    fetchSettings();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    setMessage('');
    const fullName = [lastName, middleName, firstName].filter(Boolean).join(' ');
    const updatedInfo = { ...info, personInCharge: fullName };

    // 常にブラウザのlocalStorageにフォールバック保存
    try {
      localStorage.setItem(
        'user_settings_cache',
        JSON.stringify({
          ...updatedInfo,
          personMiddleName: middleName,
          pdfSavePath,
        })
      );
    } catch {
      // ignore
    }

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

      const payload = {
        user_id: currentUserId,
        company_name: info.name,
        address: info.address,
        tel: info.tel,
        fax: info.fax,
        email: info.email,
        person_in_charge: fullName,
        person_last_name: lastName,
        person_first_name: firstName,
        person_middle_name: middleName,
        pdf_save_path: pdfSavePath,
        updated_at: new Date().toISOString(),
      };

      let saveError: any = null;

      if (recordId) {
        const { error: err } = await supabase
          .from('user_settings')
          .update(payload)
          .eq('id', recordId);
        saveError = err;
      } else {
        const { data: existing } = await supabase
          .from('user_settings')
          .select('id')
          .limit(1)
          .maybeSingle();

        if (existing?.id) {
          setRecordId(existing.id);
          const { error: err } = await supabase
            .from('user_settings')
            .update(payload)
            .eq('id', existing.id);
          saveError = err;
        } else {
          const { error: err } = await supabase
            .from('user_settings')
            .insert([payload]);
          saveError = err;
        }
      }

      if (saveError) throw saveError;
      setMessage('自社設定を保存しました。');
      if (onSaved) onSaved(updatedInfo);
      setTimeout(() => onClose(), 800);
    } catch (err: any) {
      console.error('Failed to save settings to Supabase:', err);
      if (err.message && (err.message.includes('Could not find the table') || err.message.includes('schema cache'))) {
        setMessage('自社設定を保存しました（ブラウザローカル保存）。※Supabaseのuser_settingsテーブル未作成のためクラウド未同期');
        if (onSaved) onSaved(updatedInfo);
        setTimeout(() => onClose(), 1500);
      } else {
        setMessage(`クラウド保存エラー: ${err.message || '不明なエラー'}（ブラウザには保存されました）`);
      }
    } finally {
      setIsSaving(false);
    }
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
          width: '520px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0 }}>⚙️ 自社情報・基本設定</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>
            ✕
          </button>
        </div>

        {message && (
          <div style={{ padding: '0.6rem', marginBottom: '1rem', backgroundColor: '#e6ffec', color: '#1a7f37', borderRadius: '4px' }}>
            {message}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold' }}>自社企業名</label>
            <input
              type="text"
              value={info.name}
              onChange={(e) => setInfo({ ...info, name: e.target.value })}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.2rem' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold' }}>所在地住所</label>
            <input
              type="text"
              value={info.address}
              onChange={(e) => setInfo({ ...info, address: e.target.value })}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.2rem' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold' }}>
                TEL <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#666' }}>（ハイフン無し）</span>
              </label>
              <input
                type="text"
                value={info.tel}
                onChange={(e) => setInfo({ ...info, tel: e.target.value })}
                style={{ width: '100%', padding: '0.5rem', marginTop: '0.2rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold' }}>
                FAX <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#666' }}>（ハイフン無し）</span>
              </label>
              <input
                type="text"
                value={info.fax}
                onChange={(e) => setInfo({ ...info, fax: e.target.value })}
                style={{ width: '100%', padding: '0.5rem', marginTop: '0.2rem' }}
              />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold' }}>メールアドレス</label>
            <input
              type="email"
              value={info.email}
              placeholder="例: yamada@example.co.jp"
              onChange={(e) => setInfo({ ...info, email: e.target.value })}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.2rem' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold' }}>担当者（姓）</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', marginTop: '0.2rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold' }}>ミドルネーム</label>
              <input
                type="text"
                value={middleName}
                placeholder="任意"
                onChange={(e) => setMiddleName(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', marginTop: '0.2rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold' }}>担当者（名）</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', marginTop: '0.2rem' }}
              />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold' }}>
              PDF保存先パス <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#666' }}>（任意）</span>
            </label>
            <input
              type="text"
              value={pdfSavePath}
              placeholder="例: /quotations/2026 または ローカルフォルダパス"
              onChange={(e) => setPdfSavePath(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.2rem' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
          <button
            onClick={onClose}
            style={{ padding: '0.5rem 1rem', border: '1px solid #ccc', background: '#fff', borderRadius: '4px', cursor: 'pointer' }}
          >
            キャンセル
          </button>
          <button
            data-ai-id="btn-save-user-settings"
            onClick={handleSave}
            disabled={isSaving}
            style={{
              padding: '0.5rem 1.5rem',
              backgroundColor: '#0070f3',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
            }}
          >
            {isSaving ? '保存中...' : '設定を保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
