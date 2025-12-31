'use client';

import { useState, useRef } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const MANAGERS = ['태일', '서지은', '자인'];

// 필드 라벨 (표시용)
const FIELD_LABELS = [
  '제품명', '수취인명', '연락처', '은행', '계좌(-)', '예금주',
  '결제금액(원 쓰지 마세요)', '아이디', '주문번호', '주소', '닉네임', '회수이름', '회수연락처'
];

// AI 파싱용 키 (라벨과 매칭)
const FIELD_KEYS = [
  '제품명', '수취인명', '연락처', '은행', '계좌', '예금주',
  '결제금액', '아이디', '주문번호', '주소', '닉네임', '회수이름', '회수연락처'
];

// 복사용 템플릿
const TEMPLATE = `제품명: 
수취인명: 
연락처: 
은행: 
계좌(-): 
예금주: 
결제금액(원 쓰지 마세요): 
아이디: 
주문번호: 
주소: 
닉네임: 
회수이름: 
회수연락처: `;

interface OrderItem {
  id: number;
  values: string[];
  image: File | null;
  imagePreview: string | null;
  isApplied: boolean;
  isProcessing: boolean;
}

export default function OrderPage() {
  const [manager, setManager] = useState<string>('');
  const [orders, setOrders] = useState<OrderItem[]>([
    { id: Date.now(), values: [], image: null, imagePreview: null, isApplied: false, isProcessing: false }
  ]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const textInputRefs = useRef<Record<number, string>>({});
  const textareaRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});

  const addOrder = () => {
    setOrders([...orders, { id: Date.now(), values: [], image: null, imagePreview: null, isApplied: false, isProcessing: false }]);
  };

  const removeOrder = (id: number) => {
    if (orders.length > 1) {
      setOrders(orders.filter(o => o.id !== id));
    }
  };

  const copyLastOrder = () => {
    const lastOrder = orders[orders.length - 1];
    setOrders([...orders, {
      id: Date.now(),
      values: [...lastOrder.values],
      image: null,
      imagePreview: null,
      isApplied: true,
      isProcessing: false
    }]);
  };

  const copyTemplate = async () => {
    try {
      await navigator.clipboard.writeText(TEMPLATE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert('복사 실패');
    }
  };

  const fillTemplate = (orderId: number) => {
    textInputRefs.current[orderId] = TEMPLATE;
    if (textareaRefs.current[orderId]) {
      textareaRefs.current[orderId]!.value = TEMPLATE;
    }
  };

  // 템플릿 형식인지 확인 (콜론이 여러 개 있으면 템플릿)
  const isTemplateFormat = (text: string): boolean => {
    const lines = text.split('\n');
    let colonCount = 0;
    lines.forEach(line => {
      if (line.includes(':')) colonCount++;
    });
    return colonCount >= 5; // 5개 이상 콜론이 있으면 템플릿 형식으로 간주
  };

  // 템플릿 형식에서 값 추출
  const extractFromTemplate = (text: string): string[] => {
    const lines = text.split('\n');
    const values: string[] = [];
    lines.forEach(line => {
      const colonIndex = line.indexOf(':');
      if (colonIndex !== -1) {
        const value = line.substring(colonIndex + 1).trim();
        values.push(value);
      }
    });
    return values;
  };

  // 적용하기 버튼 - 자동으로 AI 분석 또는 템플릿 파싱
  const applyText = async (orderId: number) => {
    const text = textInputRefs.current[orderId] || '';
    
    if (!text.trim()) {
      setResult({ type: 'error', message: '텍스트를 입력해주세요.' });
      return;
    }

    // 템플릿 형식이면 바로 파싱
    if (isTemplateFormat(text)) {
      const values = extractFromTemplate(text);
      setOrders(orders.map(o => 
        o.id === orderId ? { ...o, values, isApplied: true } : o
      ));
      return;
    }

    // 템플릿 형식이 아니면 AI 분석
    setOrders(prev => prev.map(o => 
      o.id === orderId ? { ...o, isProcessing: true } : o
    ));
    setResult(null);

    try {
      const response = await fetch(`${API_URL}/api/parse-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      const data = await response.json();

      if (data.success && data.data) {
        // AI 파싱 결과를 values 배열로 변환
        const values = FIELD_KEYS.map(key => data.data[key] || '');
        
        setOrders(prev => prev.map(o => 
          o.id === orderId ? { ...o, values, isApplied: true, isProcessing: false } : o
        ));

        setResult({ type: 'success', message: '✨ AI 분석 완료! 내용을 확인해주세요.' });
      } else {
        setResult({ type: 'error', message: data.error || 'AI 분석 실패' });
        setOrders(prev => prev.map(o => 
          o.id === orderId ? { ...o, isProcessing: false } : o
        ));
      }
    } catch (error: any) {
      setResult({ type: 'error', message: 'AI 서버 연결 실패: ' + error.message });
      setOrders(prev => prev.map(o => 
        o.id === orderId ? { ...o, isProcessing: false } : o
      ));
    }
  };

  const editOrder = (orderId: number) => {
    const order = orders.find(o => o.id === orderId);
    if (order && order.values.length > 0) {
      const text = FIELD_LABELS.map((label, i) => 
        `${label}: ${order.values[i] || ''}`
      ).join('\n');
      textInputRefs.current[orderId] = text;
      if (textareaRefs.current[orderId]) {
        textareaRefs.current[orderId]!.value = text;
      }
    }
    setOrders(orders.map(o => 
      o.id === orderId ? { ...o, isApplied: false } : o
    ));
  };

  // 이미지 압축 없이 바로 저장
  const handleImageChange = (orderId: number, file: File | null) => {
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setOrders(orders.map(o => 
          o.id === orderId 
            ? { ...o, image: file, imagePreview: e.target?.result as string }
            : o
        ));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!manager) {
      setResult({ type: 'error', message: '담당자를 선택해주세요.' });
      return;
    }

    const notApplied = orders.filter(o => !o.isApplied);
    if (notApplied.length > 0) {
      setResult({ type: 'error', message: '모든 주문의 정보를 적용해주세요.' });
      return;
    }

    // 이미지 첨부 체크
    const noImage = orders.filter(o => !o.image);
    if (noImage.length > 0) {
      setResult({ type: 'error', message: '모든 주문에 구매내역 캡쳐를 첨부해주세요.' });
      return;
    }

    setLoading(true);
    setResult(null);
    setProgress('서버에 전송중입니다.. 완료 메세지 뜨기 전까지 페이지 유지해주세요!');

    try {
      const formData = new FormData();
      formData.append('manager', manager);
      formData.append('orders', JSON.stringify(orders.map(o => o.values)));
      
      orders.forEach((order) => {
        if (order.image) {
          formData.append('images', order.image);
        }
      });

      const response = await fetch(`${API_URL}/api/submit-orders`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setResult({ type: 'success', message: '✅ 완료되었습니다!' });
        setOrders([{ id: Date.now(), values: [], image: null, imagePreview: null, isApplied: false, isProcessing: false }]);
        textInputRefs.current = {};
      } else {
        setResult({ type: 'error', message: data.error || '저장 실패' });
      }
    } catch (error: any) {
      setResult({ type: 'error', message: error.message || '네트워크 오류' });
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>📦 주문 정보 입력</h1>
      
      <div style={styles.topBar}>
        <div style={styles.managerSection}>
          <label style={styles.managerLabel}>담당자</label>
          <select
            value={manager}
            onChange={(e) => setManager(e.target.value)}
            style={styles.managerSelect}
          >
            <option value="">-- 선택 --</option>
            {MANAGERS.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <button onClick={copyTemplate} style={styles.templateBtn}>
          {copied ? '✅ 복사됨!' : '📋 항목 복사'}
        </button>
      </div>

      <div style={styles.buttonGroup}>
        <button onClick={addOrder} style={styles.addBtn}>+ 새 주문 추가</button>
        <button onClick={copyLastOrder} style={styles.copyBtn}>📋 마지막 주문 복사</button>
      </div>

      <div style={styles.notice}>
        💡 다계정자는 [새 주문 추가] 버튼 눌러서 각각 제출해주세요!
      </div>

      {orders.map((order, index) => (
        <div key={order.id} style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.orderNum}>
              주문 #{index + 1}
              {order.isApplied && <span style={styles.appliedBadge}>✓ 적용됨</span>}
            </span>
            {orders.length > 1 && (
              <button onClick={() => removeOrder(order.id)} style={styles.removeBtn}>✕</button>
            )}
          </div>

          {!order.isApplied ? (
            <div style={styles.inputMode}>
              <div style={styles.inputHeader}>
                <div>
                  <label style={styles.label}>📝 주문 정보 입력</label>
                  <p style={styles.hint}>* 주문 정보를 붙여넣고 [적용하기]를 누르면 AI가 자동 분석합니다.</p>
                  <p style={styles.hint}>* 템플릿 형식으로 입력해도 됩니다.</p>
                </div>
                <button onClick={() => fillTemplate(order.id)} style={styles.fillBtn}>
                  항목 채우기
                </button>
              </div>
              <textarea
                ref={(el) => { textareaRefs.current[order.id] = el; }}
                placeholder="주문 정보를 붙여넣기 하세요 (AI가 자동 분석합니다)"
                style={styles.textarea}
                defaultValue={textInputRefs.current[order.id] || ''}
                onChange={(e) => { textInputRefs.current[order.id] = e.target.value; }}
              />
              <button 
                onClick={() => applyText(order.id)} 
                style={{
                  ...styles.applyBtn,
                  opacity: order.isProcessing ? 0.7 : 1,
                  cursor: order.isProcessing ? 'not-allowed' : 'pointer'
                }}
                disabled={order.isProcessing}
              >
                {order.isProcessing ? '🔄 AI 분석중...' : '✓ 적용하기'}
              </button>
            </div>
          ) : (
            <div style={styles.viewMode}>
              <div style={styles.dataGrid}>
                {FIELD_LABELS.map((label, i) => (
                  order.values[i] && (
                    <div key={i} style={styles.dataItem}>
                      <span style={styles.dataLabel}>{label}</span>
                      <span style={styles.dataValue}>{order.values[i]}</span>
                    </div>
                  )
                ))}
              </div>
              <button onClick={() => editOrder(order.id)} style={styles.editBtn}>
                ✏️ 수정
              </button>
            </div>
          )}

          <div style={styles.imageSection}>
            <div 
              style={{
                ...styles.dropzone,
                borderColor: order.imagePreview ? '#28a745' : '#ddd',
                backgroundColor: order.imagePreview ? '#f0fff4' : '#fafafa'
              }}
              onClick={() => fileInputRefs.current[order.id]?.click()}
            >
              {order.imagePreview ? (
                <div style={styles.imageRow}>
                  <img src={order.imagePreview} alt="미리보기" style={styles.preview} />
                  <span style={{ ...styles.imageText, color: '#28a745' }}>✅ 이미지 첨부됨</span>
                </div>
              ) : (
                <div style={styles.imageRow}>
                  <span style={{ fontSize: '20px' }}>📷</span>
                  <span style={styles.imageText}>클릭하여 구매내역 캡쳐 첨부 (필수)</span>
                </div>
              )}
            </div>
            <input
              ref={(el) => { fileInputRefs.current[order.id] = el; }}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => handleImageChange(order.id, e.target.files?.[0] || null)}
            />
          </div>
        </div>
      ))}

      {progress && <div style={styles.progress}>{progress}</div>}

      {result && (
        <div style={{
          ...styles.result,
          backgroundColor: result.type === 'success' ? '#e6f4ea' : '#fce8e6',
          color: result.type === 'success' ? '#137333' : '#c5221f'
        }}>
          {result.message}
        </div>
      )}

      <button 
        onClick={handleSubmit} 
        disabled={loading}
        style={{
          ...styles.submitBtn,
          opacity: loading ? 0.6 : 1,
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? '⏳ 저장 중...' : `📤 ${orders.length}건 제출하기`}
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: '900px', margin: '0 auto', padding: '20px', backgroundColor: '#f8f9fa', minHeight: '100vh' },
  title: { textAlign: 'center', color: '#333', marginBottom: '20px' },
  topBar: { display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center', backgroundColor: 'white', padding: '15px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' },
  managerSection: { display: 'flex', alignItems: 'center', gap: '10px', flex: 1 },
  managerLabel: { fontSize: '15px', fontWeight: 'bold', color: '#333', whiteSpace: 'nowrap' },
  managerSelect: { flex: 1, padding: '10px 15px', fontSize: '15px', border: '2px solid #ddd', borderRadius: '8px', cursor: 'pointer', backgroundColor: 'white', maxWidth: '150px' },
  templateBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500', whiteSpace: 'nowrap' },
  buttonGroup: { display: 'flex', gap: '10px', marginBottom: '15px', justifyContent: 'center' },
  addBtn: { backgroundColor: '#4285f4', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: '500' },
  copyBtn: { backgroundColor: '#34a853', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: '500' },
  notice: { backgroundColor: '#fff3cd', color: '#856404', padding: '12px 20px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', fontSize: '15px', fontWeight: '500', border: '1px solid #ffc107' },
  card: { backgroundColor: 'white', borderRadius: '12px', padding: '20px', marginBottom: '15px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', paddingBottom: '10px', borderBottom: '2px solid #4285f4' },
  orderNum: { fontSize: '18px', fontWeight: 'bold', color: '#4285f4', display: 'flex', alignItems: 'center', gap: '10px' },
  appliedBadge: { fontSize: '12px', backgroundColor: '#28a745', color: 'white', padding: '3px 8px', borderRadius: '12px' },
  removeBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' },
  inputMode: { marginBottom: '15px' },
  inputHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' },
  label: { fontWeight: '500', color: '#333' },
  hint: { fontSize: '12px', color: '#888', margin: '4px 0 0 0' },
  fillBtn: { backgroundColor: '#e9ecef', color: '#495057', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' },
  textarea: { width: '100%', height: '180px', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box', marginBottom: '10px' },
  applyBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' },
  viewMode: { marginBottom: '15px' },
  dataGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px', marginBottom: '10px' },
  dataItem: { backgroundColor: '#f8f9fa', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e9ecef' },
  dataLabel: { display: 'block', fontSize: '11px', color: '#666', marginBottom: '2px' },
  dataValue: { display: 'block', fontSize: '13px', color: '#333', fontWeight: '500' },
  editBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
  imageSection: { marginTop: '12px' },
  dropzone: { border: '2px dashed #ddd', borderRadius: '8px', padding: '12px 15px', cursor: 'pointer' },
  imageRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  preview: { width: '50px', height: '50px', objectFit: 'cover', borderRadius: '6px' },
  imageText: { fontSize: '14px', color: '#666' },
  progress: { padding: '12px', borderRadius: '8px', marginBottom: '15px', textAlign: 'center', backgroundColor: '#fff3cd', color: '#856404', fontWeight: '500' },
  result: { padding: '12px', borderRadius: '8px', marginBottom: '15px', textAlign: 'center', fontWeight: '500' },
  submitBtn: { width: '100%', backgroundColor: '#4285f4', color: 'white', border: 'none', padding: '16px', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }
};
