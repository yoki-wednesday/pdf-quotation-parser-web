import { useState, useEffect, type ChangeEvent, type DragEvent } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { supabase } from './lib/supabase';
import { calculateFileHash } from './lib/hash';
import { parseEstimateText, type ParsedEstimateResult, type EstimateItem } from './lib/parser';
import { syncProductMaster } from './lib/productMaster';
import { formatQuotationToMarkdown } from './lib/markdownFormatter';
import {
  loadCartFromStorage,
  addItemToCart,
  removeItemFromCart,
  updateCartItemQuantity,
  updateCartItemNote,
  clearCart,
  type CartItem,
} from './lib/cart';
import { PriceSearch } from './components/PriceSearch';
import { CartDrawer } from './components/CartDrawer';
import { SettingsModal } from './components/SettingsModal';
import { SupplierMaster } from './components/SupplierMaster';
import { AuthModal } from './components/AuthModal';
import { DocumentModal } from './components/DocumentModal';
import { OutboundHistory } from './components/OutboundHistory';
import './App.css';

// Configure pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB (Phase 4 壁打ち指摘)
const MIN_EXTRACTED_TEXT_LENGTH = 30; // スキャン画像PDF検知用しきい値

function App() {
  const [activeTab, setActiveTab] = useState<'parse' | 'search' | 'history'>('parse');
  const [file, setFile] = useState<File | null>(null);
  const [fileHash, setFileHash] = useState<string>('');
  const [parsedResult, setParsedResult] = useState<ParsedEstimateResult | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isSaved, setIsSaved] = useState<boolean>(false);

  // 買い物かご状態
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isDocumentOpen, setIsDocumentOpen] = useState<boolean>(false);
  const [documentModalItems, setDocumentModalItems] = useState<CartItem[]>([]);
  const [documentModalType, setDocumentModalType] = useState<'ESTIMATE_REQUEST' | 'PURCHASE_ORDER'>('ESTIMATE_REQUEST');
  const [isDocumentManualEntry, setIsDocumentManualEntry] = useState<boolean>(false);

  // 認証状態
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);

  // Phase 4 UX 3-3 対策: 手入力下書き未保存時のリロード・離脱警告 (Task-012)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      try {
        const raw = localStorage.getItem('pdf_quotation_new_cart_draft');
        if (raw) {
          const items = JSON.parse(raw);
          if (Array.isArray(items) && items.length > 0) {
            e.preventDefault();
            e.returnValue = '';
          }
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // 初回起動時にsessionStorageからカート復帰 & 認証セッション監視
  useEffect(() => {
    setCartItems(loadCartFromStorage());

    // 認証セッション初期確認
    const checkInitialSession = async () => {
      try {
        if (supabase?.auth) {
          if (typeof supabase.auth.getSession === 'function') {
            const { data } = await supabase.auth.getSession();
            if (data?.session?.user?.email) {
              setCurrentUserEmail(data.session.user.email);
            }
          } else if (typeof supabase.auth.getUser === 'function') {
            const { data } = await supabase.auth.getUser();
            if (data?.user?.email) {
              setCurrentUserEmail(data.user.email);
            }
          }
        }
      } catch (err) {
        console.warn('Initial session check warning:', err);
      } finally {
        setIsAuthChecking(false);
      }
    };
    checkInitialSession();

    // 認証リスナー登録
    let subscription: { unsubscribe: () => void } | null = null;
    if (supabase?.auth && typeof supabase.auth.onAuthStateChange === 'function') {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user?.email) {
          setCurrentUserEmail(session.user.email);
          setIsAuthOpen(false);
        } else {
          setCurrentUserEmail('');
        }
      });
      subscription = data?.subscription || null;
    }

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // ログアウト処理
  const handleLogout = async () => {
    try {
      if (supabase?.auth?.signOut) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setCurrentUserEmail('');
      setIsAuthOpen(true);
    }
  };

  // Phase 4 指摘: 編集中データの喪失防止 (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (parsedResult && !isSaved) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [parsedResult, isSaved]);

  const validateAndSetFile = async (selectedFile: File) => {
    setErrorMessage('');
    setStatusMessage('');
    setParsedResult(null);
    setIsSaved(false);

    if (selectedFile.type !== 'application/pdf') {
      setErrorMessage('PDFファイル形式（.pdf）のみ対応しています。');
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage(
        `ファイルサイズが制限（${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB）を超過しています。`
      );
      return;
    }

    setFile(selectedFile);
    try {
      const hash = await calculateFileHash(selectedFile);
      setFileHash(hash);
    } catch (err) {
      console.error('Hash calculation error:', err);
      setErrorMessage('ハッシュ計算中にエラーが発生しました。');
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const processPdf = async () => {
    if (!file || !fileHash) return;
    setIsProcessing(true);
    setErrorMessage('');
    setStatusMessage('');

    try {
      // 1. 重複チェック (import_logs 照合: REQ-002)
      const { data: existingLogs, error: checkError } = await supabase
        .from('import_logs')
        .select('id, file_name, processed_at')
        .eq('file_hash', fileHash);

      if (checkError) {
        console.warn('Duplicate check warning:', checkError.message);
      } else if (existingLogs && existingLogs.length > 0) {
        setErrorMessage(
          `この見積書ファイル（${existingLogs[0].file_name}）は既に登録済みです（登録日時: ${new Date(
            existingLogs[0].processed_at
          ).toLocaleString()}）。`
        );
        setIsProcessing(false);
        return;
      }

      // 2. ブラウザ内メモリパース (pdf.js: REQ-003, REQ-016)
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // 2D座標（Y軸降順・上から下、X軸昇順・左から右）に基づく行整列
        const rawItems = textContent.items
          .map((item) => {
            const str = ('str' in item ? item.str : '').trim();
            const transform = ('transform' in item ? item.transform : [1, 0, 0, 1, 0, 0]);
            return {
              str,
              x: Math.round(transform[4] || 0),
              y: Math.round(transform[5] || 0),
            };
          })
          .filter((it) => it.str);

        // 誤差4px以内の同一行をY座標でグルーピング
        rawItems.sort((a, b) => (Math.abs(a.y - b.y) <= 4 ? a.x - b.x : b.y - a.y));

        const yBands: { y: number; items: typeof rawItems }[] = [];
        for (const it of rawItems) {
          let band = yBands.find((b) => Math.abs(b.y - it.y) <= 4);
          if (!band) {
            band = { y: it.y, items: [] };
            yBands.push(band);
          }
          band.items.push(it);
        }
        yBands.sort((a, b) => b.y - a.y);

        const pageLines = yBands
          .map((b) => b.items.map((it) => it.str).join(' '))
          .join('\n');

        fullText += pageLines + '\n';
      }

      // Phase 4 指摘: スキャン画像PDF検知
      if (fullText.trim().length < MIN_EXTRACTED_TEXT_LENGTH) {
        setErrorMessage(
          'テキストレイヤーが検出されませんでした。スキャン画像PDFには対応していません。'
        );
        setIsProcessing(false);
        return;
      }

      const parsed = parseEstimateText(fullText);
      setParsedResult(parsed);
      setStatusMessage('PDFの解析が正常に完了しました。内容を確認・修正してください。');
    } catch (error: any) {
      console.error('Error processing PDF:', error);
      setErrorMessage(`PDFの解析に失敗しました: ${error.message || error}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 明細行の変更ハンドラ
  const handleItemChange = (index: number, field: keyof EstimateItem, value: any) => {
    if (!parsedResult) return;
    const newItems = [...parsedResult.items];
    const targetItem = { ...newItems[index], [field]: value };
    
    // 金額再計算
    if (field === 'quantity' || field === 'unit_price') {
      targetItem.amount = Number(targetItem.quantity) * Number(targetItem.unit_price);
    }
    newItems[index] = targetItem;

    const newTotal = newItems.reduce((acc, it) => acc + (it.amount || 0), 0);
    setParsedResult({
      ...parsedResult,
      items: newItems,
      header: {
        ...parsedResult.header,
        total_amount: newTotal,
      },
    });
  };

  // 明細行追加
  const handleAddItem = () => {
    if (!parsedResult) return;
    const newItem: EstimateItem = {
      line_number: parsedResult.items.length + 1,
      maker_name: '',
      item_name: '',
      quantity: 1,
      unit: '個',
      unit_price: 0,
      amount: 0,
    };
    setParsedResult({
      ...parsedResult,
      items: [...parsedResult.items, newItem],
    });
  };

  // 明細行削除
  const handleDeleteItem = (index: number) => {
    if (!parsedResult) return;
    const filtered = parsedResult.items.filter((_, idx) => idx !== index);
    const renumbered = filtered.map((it, idx) => ({ ...it, line_number: idx + 1 }));
    const newTotal = renumbered.reduce((acc, it) => acc + (it.amount || 0), 0);
    setParsedResult({
      ...parsedResult,
      items: renumbered,
      header: {
        ...parsedResult.header,
        total_amount: newTotal,
      },
    });
  };

  // AI連携用マークダウンコピー処理 (Loop 22 / PBI-008 / Phase 4 UX-003)
  const copyMarkdownToClipboard = async () => {
    if (!parsedResult) return;
    const md = formatQuotationToMarkdown(parsedResult, { maskSensitiveInfo: true });
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(md);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = md;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setStatusMessage('AI用マークダウンをクリップボードにコピーしました（機密情報マスク済み）。');
    } catch (err: any) {
      console.error('Failed to copy markdown:', err);
      setErrorMessage('クリップボードへのコピーに失敗しました。');
    }
  };

  // Supabaseへの保存処理 (SPEC-004, SPEC-005, SPEC-006: REQ-006)
  const saveToDb = async () => {
    if (!parsedResult || !file || !fileHash) return;
    setIsProcessing(true);
    setStatusMessage('Supabaseに保存中...');
    setErrorMessage('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id || null;

      const { data: estData, error: estError } = await supabase
        .from('estimates')
        .insert([
          {
            user_id: currentUserId,
            estimate_number: parsedResult.header.estimate_number,
            issue_date: parsedResult.header.issue_date,
            customer_name: parsedResult.header.customer_name,
            total_amount: parsedResult.header.total_amount,
            file_name: file.name,
            parsed_text: parsedResult.rawText,
            status: 'draft',
          },
        ])
        .select('id')
        .single();

      if (estError) throw estError;

      if (estData && parsedResult.items.length > 0) {
        const itemsToInsert = parsedResult.items.map((item) => ({
          user_id: currentUserId,
          estimate_id: estData.id,
          line_number: item.line_number,
          maker_name: item.maker_name || null,
          item_name: item.item_name,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          amount: item.amount,
        }));

        const { error: itemsError } = await supabase
          .from('estimate_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        // 製品マスタ (product_master) への自動同期
        await syncProductMaster(parsedResult.items);
      }

      const { error: logError } = await supabase
        .from('import_logs')
        .insert([
          {
            user_id: currentUserId,
            file_name: file.name,
            file_hash: fileHash,
            status: 'SUCCESS',
          },
        ]);

      if (logError) {
        console.warn('Failed to record import log:', logError.message);
      }

      setIsSaved(true);
      setStatusMessage('見積ヘッダー、明細、インポートログ、および製品マスタの保存が正常に完了しました！');
    } catch (error: any) {
      console.error('Error saving to DB:', error);
      setErrorMessage(`DB保存中にエラーが発生しました: ${error.message || error}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // カート操作ハンドラ
  const handleAddToCart = (item: Omit<CartItem, 'id'>) => {
    const updated = addItemToCart(cartItems, item);
    setCartItems(updated);
    setIsCartOpen(true);
  };

  const handleUpdateQuantity = (id: string, qty: number) => {
    const updated = updateCartItemQuantity(cartItems, id, qty);
    setCartItems(updated);
  };

  const handleUpdateNote = (id: string, note: string) => {
    const updated = updateCartItemNote(cartItems, id, note);
    setCartItems(updated);
  };

  const handleRemoveFromCart = (id: string) => {
    const updated = removeItemFromCart(cartItems, id);
    setCartItems(updated);
  };

  const handleClearCart = () => {
    const updated = clearCart();
    setCartItems(updated);
  };

  // モーダル状態
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSupplierOpen, setIsSupplierOpen] = useState(false);

  const isLoggedIn = Boolean(currentUserEmail);

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.75rem', lineHeight: 1.25, whiteSpace: 'nowrap' }}>見積・調達アシスタント</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0, whiteSpace: 'nowrap' }}>
          {isLoggedIn ? (
            <>
              <span style={{ fontSize: '0.85rem', color: '#1a7f37', fontWeight: 'bold' }}>👤 {currentUserEmail}</span>
              <button
                onClick={handleLogout}
                style={{
                  padding: '0.35rem 0.7rem',
                  backgroundColor: '#fff',
                  border: '1px solid #d0d7de',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  color: '#cf222e',
                }}
              >
                ログアウト
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsAuthOpen(true)}
              style={{
                padding: '0.4rem 0.8rem',
                backgroundColor: '#0969da',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                whiteSpace: 'nowrap',
              }}
            >
              ログイン
            </button>
          )}
          <button
            onClick={() => setIsSupplierOpen(true)}
            disabled={!isLoggedIn}
            style={{
              padding: '0.4rem 0.8rem',
              backgroundColor: '#f6f8fa',
              border: '1px solid #d0d7de',
              borderRadius: '4px',
              cursor: isLoggedIn ? 'pointer' : 'not-allowed',
              opacity: isLoggedIn ? 1 : 0.5,
              fontSize: '0.85rem',
              whiteSpace: 'nowrap',
            }}
          >
            🏢 商社マスタ
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            disabled={!isLoggedIn}
            style={{
              padding: '0.4rem 0.8rem',
              backgroundColor: '#f6f8fa',
              border: '1px solid #d0d7de',
              borderRadius: '4px',
              cursor: isLoggedIn ? 'pointer' : 'not-allowed',
              opacity: isLoggedIn ? 1 : 0.5,
              fontSize: '0.85rem',
              whiteSpace: 'nowrap',
            }}
          >
            ⚙️ 設定
          </button>
          <button
            data-ai-id="btn-toggle-cart-drawer"
            onClick={() => setIsCartOpen(!isCartOpen)}
            disabled={!isLoggedIn}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: isLoggedIn ? '#24292e' : '#666',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: isLoggedIn ? 'pointer' : 'not-allowed',
              opacity: isLoggedIn ? 1 : 0.6,
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
            }}
          >
            🛒 カート ({cartItems.length})
          </button>
        </div>
      </div>

      {/* 未ログイン警告・操作ロックバナー */}
      {!isAuthChecking && !isLoggedIn && (
        <div
          data-ai-id="auth-required-banner"
          style={{
            padding: '1.2rem',
            backgroundColor: '#fff8c5',
            border: '1px solid #d4a72c',
            borderRadius: '6px',
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
          }}
        >
          <div>
            <div style={{ fontWeight: 'bold', color: '#9a6700', fontSize: '1rem', marginBottom: '0.2rem' }}>
              🔒 ログインが必要です
            </div>
            <div style={{ color: '#57606a', fontSize: '0.85rem' }}>
              見積書解析・履歴検索・帳票発行等の全機能をご利用いただくにはログインが必要です。
            </div>
          </div>
          <button
            onClick={() => setIsAuthOpen(true)}
            style={{
              padding: '0.5rem 1.2rem',
              backgroundColor: '#1f883d',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            今すぐログイン
          </button>
        </div>
      )}

      {/* ナビゲーションタブ */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid #eaeaea', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setActiveTab('parse')}
          style={{
            padding: '0.6rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'parse' ? '3px solid #0070f3' : '3px solid transparent',
            color: activeTab === 'parse' ? '#0070f3' : '#666',
            fontWeight: activeTab === 'parse' ? 'bold' : 'normal',
            cursor: 'pointer',
          }}
        >
          📄 見積書取込 & パース
        </button>
        <button
          onClick={() => setActiveTab('search')}
          style={{
            padding: '0.6rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'search' ? '3px solid #0070f3' : '3px solid transparent',
            color: activeTab === 'search' ? '#0070f3' : '#666',
            fontWeight: activeTab === 'search' ? 'bold' : 'normal',
            cursor: 'pointer',
          }}
        >
          🔍 履歴検索 & 帳票作成
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            padding: '0.6rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'history' ? '3px solid #0070f3' : '3px solid transparent',
            color: activeTab === 'history' ? '#0070f3' : '#666',
            fontWeight: activeTab === 'history' ? 'bold' : 'normal',
            cursor: 'pointer',
          }}
        >
          📋 帳票発行履歴
        </button>
      </div>

      {activeTab === 'history' ? (
        <OutboundHistory />
      ) : activeTab === 'search' ? (
        <PriceSearch onAddToCart={handleAddToCart} />
      ) : (
        <>
          <div
            data-ai-id="supported-suppliers-banner"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#f6f8fa',
              border: '1px solid #d0d7de',
              borderRadius: '6px',
              padding: '0.6rem 1rem',
              marginBottom: '1rem',
              fontSize: '0.85rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 'bold', color: '#24292f' }}>🏢 解析対応商社:</span>
              <span
                style={{
                  backgroundColor: '#ddf4ff',
                  color: '#0969da',
                  border: '1px solid #54aeff66',
                  borderRadius: '12px',
                  padding: '0.15rem 0.6rem',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                }}
              >
                ✓ 岩瀬産業株式会社
              </span>
              <span style={{ color: '#57606a', fontSize: '0.78rem' }}>（順次対応拡大予定）</span>
            </div>
            <span style={{ color: '#57606a', fontSize: '0.8rem' }}>
              ※ 独自レイアウトの見積書PDFを2D座標エンジンで自動抽出
            </span>
          </div>

          <p style={{ color: '#666', fontSize: '0.9rem', marginTop: 0 }}>
            ※ 本システムはPDFファイルをサーバーに送信・保存せず、お使いのブラウザメモリ上で安全に解析します。
          </p>

          {/* ドロップゾーン & ファイル選択 (REQ-005, REQ-018: data-ai-id) */}
          <div
            data-ai-id="pdf-upload-dropzone"
            onDragOver={isLoggedIn ? handleDragOver : (e) => e.preventDefault()}
            onDragLeave={isLoggedIn ? handleDragLeave : (e) => e.preventDefault()}
            onDrop={isLoggedIn ? handleDrop : (e) => { e.preventDefault(); setIsAuthOpen(true); }}
            style={{
              border: isDragging ? '2px dashed #0070f3' : '2px dashed #ccc',
              backgroundColor: !isLoggedIn ? '#f9f9f9' : isDragging ? '#f0f8ff' : '#fafafa',
              borderRadius: '8px',
              padding: '2rem',
              textAlign: 'center',
              cursor: isLoggedIn ? 'pointer' : 'not-allowed',
              marginBottom: '1.5rem',
              opacity: isLoggedIn ? 1 : 0.7,
            }}
            onClick={() => {
              if (!isLoggedIn) {
                setIsAuthOpen(true);
                return;
              }
              document.getElementById('file-upload-input')?.click();
            }}
          >
            <input
              id="file-upload-input"
              data-ai-id="pdf-file-input"
              type="file"
              accept="application/pdf"
              disabled={!isLoggedIn}
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <p style={{ margin: 0, fontWeight: 'bold' }}>
              {!isLoggedIn
                ? '🔒 ログイン後に見積書PDFの取込・解析が利用可能になります'
                : file
                ? `選択中: ${file.name}`
                : '見積書PDFをここにドラッグ＆ドロップ、またはクリックして選択'}
            </p>
            <span style={{ fontSize: '0.8rem', color: '#888' }}>
              最大 5MB まで / テキストレイヤーを持つPDF限定
            </span>
          </div>

          {file && (
            <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
              <button
                data-ai-id="btn-parse-pdf"
                onClick={processPdf}
                disabled={isProcessing}
                style={{
                  padding: '0.6rem 1.5rem',
                  fontSize: '1rem',
                  backgroundColor: '#0070f3',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                }}
              >
                {isProcessing ? '解析中...' : 'PDFを解析する'}
              </button>
            </div>
          )}

          {errorMessage && (
            <div
              data-ai-id="alert-error"
              style={{
                padding: '1rem',
                backgroundColor: '#ffebe9',
                color: '#cf222e',
                borderRadius: '6px',
                marginBottom: '1rem',
              }}
            >
              {errorMessage}
            </div>
          )}

          {statusMessage && (
            <div
              data-ai-id="alert-status"
              style={{
                padding: '1rem',
                backgroundColor: '#e6ffec',
                color: '#1a7f37',
                borderRadius: '6px',
                marginBottom: '1rem',
              }}
            >
              {statusMessage}
            </div>
          )}

          {/* 解析結果プレビュー & 修正GUI (REQ-004, REQ-018: data-ai-id) */}
          {parsedResult && (
            <div style={{ marginTop: '2rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                }}
              >
                <h2 style={{ margin: 0 }}>抽出プレビュー・修正</h2>
                <button
                  data-ai-id="btn-copy-markdown"
                  onClick={copyMarkdownToClipboard}
                  style={{
                    padding: '0.4rem 0.8rem',
                    backgroundColor: '#f6f8fa',
                    border: '1px solid #d0d7de',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  📋 AI用マークダウン出力
                </button>
              </div>

              {/* ヘッダー情報編集 */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1rem',
                  backgroundColor: '#f6f8fa',
                  padding: '1rem',
                  borderRadius: '6px',
                  marginBottom: '1.5rem',
                }}
              >
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold' }}>
                    見積番号
                  </label>
                  <input
                    data-ai-id="input-estimate-number"
                    type="text"
                    value={parsedResult.header.estimate_number}
                    onChange={(e) =>
                      setParsedResult({
                        ...parsedResult,
                        header: { ...parsedResult.header, estimate_number: e.target.value },
                      })
                    }
                    style={{ width: '100%', padding: '0.4rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold' }}>
                    見積日
                  </label>
                  <input
                    data-ai-id="input-issue-date"
                    type="date"
                    value={parsedResult.header.issue_date}
                    onChange={(e) =>
                      setParsedResult({
                        ...parsedResult,
                        header: { ...parsedResult.header, issue_date: e.target.value },
                      })
                    }
                    style={{ width: '100%', padding: '0.4rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold' }}>
                    得意先・宛名
                  </label>
                  <input
                    data-ai-id="input-vendor-name"
                    type="text"
                    value={parsedResult.header.customer_name}
                    onChange={(e) =>
                      setParsedResult({
                        ...parsedResult,
                        header: { ...parsedResult.header, customer_name: e.target.value },
                      })
                    }
                    style={{ width: '100%', padding: '0.4rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold' }}>
                    合計金額 (税込)
                  </label>
                  <input
                    data-ai-id="input-total-amount"
                    type="number"
                    value={parsedResult.header.total_amount}
                    onChange={(e) =>
                      setParsedResult({
                        ...parsedResult,
                        header: { ...parsedResult.header, total_amount: Number(e.target.value) },
                      })
                    }
                    style={{ width: '100%', padding: '0.4rem' }}
                  />
                </div>
              </div>

              {/* 明細行テーブル */}
              <h3>明細一覧</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f0f0f0', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem', border: '1px solid #ddd', width: '40px' }}>No</th>
                    <th style={{ padding: '0.5rem', border: '1px solid #ddd', width: '130px' }}>メーカ</th>
                    <th style={{ padding: '0.5rem', border: '1px solid #ddd' }}>品名・型番</th>
                    <th style={{ padding: '0.5rem', border: '1px solid #ddd', width: '80px' }}>数量</th>
                    <th style={{ padding: '0.5rem', border: '1px solid #ddd', width: '60px' }}>単位</th>
                    <th style={{ padding: '0.5rem', border: '1px solid #ddd', width: '100px' }}>単価</th>
                    <th style={{ padding: '0.5rem', border: '1px solid #ddd', width: '100px' }}>金額</th>
                    <th style={{ padding: '0.5rem', border: '1px solid #ddd', width: '60px' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedResult.items.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: '0.5rem', border: '1px solid #ddd', textAlign: 'center' }}>
                        {item.line_number}
                      </td>
                      <td style={{ padding: '0.5rem', border: '1px solid #ddd' }}>
                        <input
                          type="text"
                          value={item.maker_name || ''}
                          placeholder="メーカ名"
                          onChange={(e) => handleItemChange(idx, 'maker_name', e.target.value)}
                          style={{ width: '100%' }}
                        />
                      </td>
                      <td style={{ padding: '0.5rem', border: '1px solid #ddd' }}>
                        <input
                          type="text"
                          value={item.item_name}
                          onChange={(e) => handleItemChange(idx, 'item_name', e.target.value)}
                          style={{ width: '100%' }}
                        />
                      </td>
                      <td style={{ padding: '0.5rem', border: '1px solid #ddd' }}>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', Number(e.target.value))}
                          style={{ width: '100%' }}
                        />
                      </td>
                      <td style={{ padding: '0.5rem', border: '1px solid #ddd' }}>
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                          style={{ width: '100%' }}
                        />
                      </td>
                      <td style={{ padding: '0.5rem', border: '1px solid #ddd' }}>
                        <input
                          type="number"
                          value={item.unit_price}
                          onChange={(e) => handleItemChange(idx, 'unit_price', Number(e.target.value))}
                          style={{ width: '100%' }}
                        />
                      </td>
                      <td style={{ padding: '0.5rem', border: '1px solid #ddd', textAlign: 'right' }}>
                        {item.amount.toLocaleString()}
                      </td>
                      <td style={{ padding: '0.5rem', border: '1px solid #ddd', textAlign: 'center' }}>
                        <button
                          data-ai-id={`btn-delete-item-row-${idx}`}
                          onClick={() => handleDeleteItem(idx)}
                          style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginBottom: '1.5rem' }}>
                <button
                  data-ai-id="btn-add-item-row"
                  onClick={handleAddItem}
                  style={{
                    padding: '0.4rem 0.8rem',
                    backgroundColor: '#f6f8fa',
                    border: '1px solid #d0d7de',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  ＋ 明細行を追加
                </button>
              </div>

              {/* 原本テキストプレビュー */}
              <details style={{ marginBottom: '1.5rem' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>原文テキストプレビュー</summary>
                <textarea
                  data-ai-id="txt-extracted-preview"
                  readOnly
                  value={parsedResult.rawText}
                  style={{
                    width: '100%',
                    height: '150px',
                    marginTop: '0.5rem',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                  }}
                />
              </details>

              {/* DB保存ボタン (REQ-006, REQ-018: data-ai-id) */}
              <div style={{ textAlign: 'right' }}>
                <button
                  data-ai-id="btn-save-to-db"
                  onClick={saveToDb}
                  disabled={isProcessing || isSaved}
                  style={{
                    padding: '0.7rem 2rem',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    backgroundColor: isSaved ? '#2ea44f' : '#0070f3',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: isProcessing || isSaved ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isSaved ? '保存完了' : isProcessing ? '保存中...' : 'Supabaseに保存'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* 買い物かごドロワー */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onUpdateNote={handleUpdateNote}
        onRemoveItem={handleRemoveFromCart}
        onClearCart={handleClearCart}
        onOpenDocumentModal={() => {
          setDocumentModalItems(cartItems);
          setDocumentModalType('ESTIMATE_REQUEST');
          setIsDocumentManualEntry(false);
          setIsDocumentOpen(true);
        }}
        onOpenDocumentModalWithItems={(items, defaultDocType = 'ESTIMATE_REQUEST', isManual = false) => {
          setDocumentModalItems(items);
          setDocumentModalType(defaultDocType);
          setIsDocumentManualEntry(isManual);
          setIsDocumentOpen(true);
        }}
      />

      {/* 帳票PDF作成モーダル */}
      <DocumentModal
        isOpen={isDocumentOpen && isLoggedIn}
        onClose={() => setIsDocumentOpen(false)}
        items={documentModalItems.length > 0 ? documentModalItems : cartItems}
        defaultDocType={documentModalType}
        isManualEntry={isDocumentManualEntry}
      />

      {/* 自社設定モーダル */}
      <SettingsModal
        isOpen={isSettingsOpen && isLoggedIn}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* 取引先商社マスタモーダル */}
      <SupplierMaster
        isOpen={isSupplierOpen && isLoggedIn}
        onClose={() => setIsSupplierOpen(false)}
      />

      {/* ログイン・認証モーダル (未ログイン時は強制モーダル) */}
      <AuthModal
        isOpen={isAuthOpen || (!isAuthChecking && !isLoggedIn)}
        onClose={() => {
          if (isLoggedIn) {
            setIsAuthOpen(false);
          }
        }}
        isMandatory={!isLoggedIn}
        onAuthSuccess={(email) => {
          setCurrentUserEmail(email);
          setIsAuthOpen(false);
        }}
      />
    </div>
  );
}

export default App;
