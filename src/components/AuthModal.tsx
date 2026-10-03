import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (email: string) => void;
  isMandatory?: boolean;
}

export function AuthModal({ isOpen, onClose, onAuthSuccess, isMandatory = false }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    setIsError(false);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage('確認メールを送信しました。メール内のリンクから認証を完了してください。');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setMessage('ログインに成功しました！');
        if (data.user?.email) onAuthSuccess(data.user.email);
        setTimeout(() => onClose(), 800);
      }
    } catch (err: any) {
      setIsError(true);
      setMessage(`認証エラー: ${err.message}`);
    } finally {
      setIsLoading(false);
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
          width: '400px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0 }}>{isSignUp ? '新規アカウント登録' : 'ログイン'}</h2>
          {!isMandatory && (
            <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>
              ✕
            </button>
          )}
        </div>

        {message && (
          <div
            style={{
              padding: '0.6rem',
              marginBottom: '1rem',
              backgroundColor: isError ? '#ffebe9' : '#e6ffec',
              color: isError ? '#cf222e' : '#1a7f37',
              borderRadius: '4px',
            }}
          >
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold' }}>メールアドレス</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.2rem' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold' }}>パスワード</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.2rem' }}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              padding: '0.7rem',
              backgroundColor: '#0070f3',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              marginTop: '0.5rem',
            }}
          >
            {isLoading ? '処理中...' : isSignUp ? '登録する' : 'ログイン'}
          </button>
        </form>

        <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.85rem' }}>
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setMessage('');
            }}
            style={{ border: 'none', background: 'none', color: '#0070f3', cursor: 'pointer' }}
          >
            {isSignUp ? 'すでにアカウントをお持ちの方はこちら (ログイン)' : 'アカウントをお持ちでない方はこちら (新規登録)'}
          </button>
        </div>
      </div>
    </div>
  );
}
