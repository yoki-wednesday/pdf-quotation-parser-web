import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  generateReportPdf,
  downloadPdfBlob,
  DEFAULT_COMPANY_INFO,
  type CompanyInfo,
} from '../lib/pdfGenerator';
import type { CartItem } from '../lib/cart';

interface DocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
}

interface SupplierOption {
  id: string;
  name: string;
  person_name?: string;
}

export function DocumentModal({ isOpen, onClose, items }: DocumentModalProps) {
  const [docType, setDocType] = useState<'ESTIMATE_REQUEST' | 'PURCHASE_ORDER'>('ESTIMATE_REQUEST');
  const [vendorName, setVendorName] = useState('岩瀬産業 株式会社');
  const [vendorPerson, setVendorPerson] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryPlace, setDeliveryPlace] = useState('');
  const [responseDeadline, setResponseDeadline] = useState('');
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(DEFAULT_COMPANY_INFO);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState('');

  // 自社設定 & 取引先マスタのロード
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      try {
        // 自社設定
        const { data: userSettings } = await supabase
          .from('user_settings')
          .select('*')
          .maybeSingle();

        if (userSettings) {
          setCompanyInfo({
            name: userSettings.company_name || DEFAULT_COMPANY_INFO.name,
            address: userSettings.address || DEFAULT_COMPANY_INFO.address,
            tel: userSettings.tel || DEFAULT_COMPANY_INFO.tel,
            fax: userSettings.fax || DEFAULT_COMPANY_INFO.fax,
            email: userSettings.email || DEFAULT_COMPANY_INFO.email,
            personInCharge: userSettings.person_in_charge || DEFAULT_COMPANY_INFO.personInCharge,
          });
        }

        // 取引先マスタ
        const { data: supplierData } = await supabase
          .from('suppliers')
          .select('id, name, person_last_name, person_first_name')
          .is('deleted_at', null);

        if (supplierData && supplierData.length > 0) {
          const list = supplierData.map((s) => ({
            id: s.id,
            name: s.name,
            person_name: s.person_last_name || [s.person_last_name, s.person_first_name].filter(Boolean).join(' '),
          }));
          setSuppliers(list);
          if (list[0]) {
            setSelectedSupplierId(list[0].id);
            setVendorName(list[0].name);
            setVendorPerson(list[0].person_name || '');
          }
        }
      } catch (err) {
        console.warn('DocumentModal loadData error:', err);
      }
    };

    loadData();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSupplierSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) {
      setSelectedSupplierId(null);
      return;
    }
    const found = suppliers.find((s) => s.id === val);
    if (found) {
      setSelectedSupplierId(found.id);
      setVendorName(found.name);
      setVendorPerson(found.person_name || '');
    }
  };

  const handleGeneratePdf = async () => {
    if (items.length === 0) return;
    setIsGenerating(true);
    setMessage('');

    try {
      const docNo = `${docType === 'ESTIMATE_REQUEST' ? 'REQ-' : 'PO-'}${Date.now().toString().slice(-6)}`;
      const pdfBytes = await generateReportPdf(
        docType,
        vendorName,
        items,
        companyInfo,
        {
          estimateNumber: docNo,
          customerDeptPerson: vendorPerson,
          deliveryDate: deliveryDate.trim() || undefined,
          deliveryPlace: deliveryPlace.trim() || undefined,
          responseDeadline: responseDeadline.trim() || undefined,
        }
      );

      const fileName = `${docType === 'PURCHASE_ORDER' ? '御発注書' : '御見積依頼書'}_${docNo}.pdf`;
      downloadPdfBlob(pdfBytes, fileName);

      // 調達案件・アウトバウンド帳票履歴 (procurement_projects) への保存
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const currentUserId = user?.id || null;

        const totalAmount = docType === 'PURCHASE_ORDER'
          ? items.reduce((acc, it) => acc + (it.amount || (it.quantity * it.unit_price) || 0), 0)
          : 0;

        const projectName = `${vendorName} 向け ${docType === 'PURCHASE_ORDER' ? '発注' : '見積依頼'} (${docNo})`;

        const notesParts = [
          deliveryPlace ? `納入場所: ${deliveryPlace}` : '',
          responseDeadline ? `回答期限: ${responseDeadline}` : '',
          vendorPerson ? `担当者: ${vendorPerson}` : '',
        ].filter(Boolean).join(' / ');

        await supabase.from('procurement_projects').insert([
          {
            user_id: currentUserId,
            project_name: projectName,
            document_type: docType,
            status: docType === 'PURCHASE_ORDER' ? 'ORDERED' : 'REQUESTED',
            supplier_id: selectedSupplierId,
            target_date: deliveryDate.trim() || null,
            total_amount: totalAmount,
            notes: notesParts || null,
          },
        ]);
      } catch (saveHistoryErr) {
        console.warn('Failed to record procurement project history:', saveHistoryErr);
      }

      setMessage(`PDFを出力しました（${fileName}）`);
    } catch (err: any) {
      console.error('PDF generation error:', err);
      setMessage(`PDF生成エラー: ${err.message}`);
    } finally {
      setIsGenerating(false);
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
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          width: '540px',
          maxWidth: '90%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.5rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>📑 帳票PDF作成</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', fontSize: '0.9rem' }}>
          {/* 帳票種別 */}
          <div>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>帳票種別:</label>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <input
                  type="radio"
                  name="docType"
                  value="ESTIMATE_REQUEST"
                  checked={docType === 'ESTIMATE_REQUEST'}
                  onChange={() => setDocType('ESTIMATE_REQUEST')}
                />
                📄 見積依頼書 (金額非表示)
              </label>
              <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <input
                  type="radio"
                  name="docType"
                  value="PURCHASE_ORDER"
                  checked={docType === 'PURCHASE_ORDER'}
                  onChange={() => setDocType('PURCHASE_ORDER')}
                />
                📑 発注書 (金額明記)
              </label>
            </div>
          </div>

          {/* 取引先商社 */}
          <div>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>宛先（商社・仕入先）:</label>
            {suppliers.length > 0 && (
              <select
                onChange={handleSupplierSelect}
                style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                <option value="">商社マスタから選択...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.person_name ? `(${s.person_name})` : ''}
                  </option>
                ))}
              </select>
            )}
            <input
              type="text"
              value={vendorName}
              placeholder="宛先会社名 (例: 岩瀬産業 株式会社)"
              onChange={(e) => setVendorName(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
            />
          </div>

          {/* 宛先担当者 */}
          <div>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>宛先担当者 (任意):</label>
            <input
              type="text"
              value={vendorPerson}
              placeholder="担当者の姓 (例: 山田)"
              onChange={(e) => setVendorPerson(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
            />
          </div>

          {/* 条件項目 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.2rem', fontSize: '0.85rem' }}>希望納期 (任意):</label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
              />
            </div>
            {docType === 'ESTIMATE_REQUEST' && (
              <div>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.2rem', fontSize: '0.85rem' }}>回答期限 (任意):</label>
                <input
                  type="date"
                  value={responseDeadline}
                  onChange={(e) => setResponseDeadline(e.target.value)}
                  style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                />
              </div>
            )}
            <div style={{ gridColumn: docType === 'ESTIMATE_REQUEST' ? 'span 2' : 'span 2' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.2rem', fontSize: '0.85rem' }}>納入場所 (任意):</label>
              <input
                type="text"
                value={deliveryPlace}
                placeholder={`自社（${companyInfo.name}）`}
                onChange={(e) => setDeliveryPlace(e.target.value)}
                style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* 対象明細プレビュー概要 */}
          <div style={{ backgroundColor: '#f6f8fa', padding: '0.75rem', borderRadius: '4px' }}>
            <span style={{ fontWeight: 'bold' }}>出力明細:</span> {items.length} 件
            {docType === 'PURCHASE_ORDER' && (
              <span style={{ marginLeft: '1rem', color: '#0070f3', fontWeight: 'bold' }}>
                合計: ¥{items.reduce((acc, it) => acc + (it.amount || (it.quantity * it.unit_price) || 0), 0).toLocaleString()} (税抜)
              </span>
            )}
          </div>

          {message && (
            <div style={{ color: message.includes('エラー') ? '#cf222e' : '#1a7f37', fontSize: '0.85rem' }}>
              {message}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button
              onClick={onClose}
              style={{
                padding: '0.6rem 1rem',
                backgroundColor: '#f6f8fa',
                border: '1px solid #d0d7de',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              閉じる
            </button>
            <button
              data-ai-id="btn-generate-pdf-execute"
              onClick={handleGeneratePdf}
              disabled={isGenerating || items.length === 0}
              style={{
                padding: '0.6rem 1.5rem',
                backgroundColor: isGenerating ? '#999' : '#0070f3',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
              }}
            >
              {isGenerating ? '生成中...' : '📥 PDFをダウンロード'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
