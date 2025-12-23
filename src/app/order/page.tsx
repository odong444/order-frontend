'use client';

import { useState, useRef } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const MANAGERS = ['태일', '서지은', '자인'];

// 필드 목록 수정
const DEFAULT_FIELDS = [
  '제품명', '수취인명', '연락처', '은행', '계좌', '예금주',
  '결제금액', '아이디', '주문번호', '주소', '닉네임', '회수이름', '회수연락처'
];

interface OrderItem {
  id: number;
  data: Record<string, string>;
  image: File | null;
  imagePreview: string | null;
  isApplied: boolean; // 적용 여부
}

// 이미지 압축 함수
const compressImage = (file: File, maxWidth = 1200, quality = 0.7): Promise<File> => {
  return new Promise((resolve) => {
    if (file.size < 100 * 1024) {
      resolve(file);
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    
    img.onload = () => {
      let { width, height } = img;
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        },
        'image/jpeg',
        quality
      );
    };
    
    img.src = URL.createObjectURL(file);
  });
};

export default function OrderPage() {
  const [manager, setManager] = useState<string>('');
  const [orders, setOrders] = useState<OrderItem[]>([
    { id: Date.now(), data: {}, image: null, imagePreview: null, isApplied: false }
  ]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const textInputRefs = useRef<Record<number, string>>({});

  const addOrder = () => {
    setOrders([...orders, { id: Date.now(), data: {}, image: null, imagePreview: null, isApplied: false }]);
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
      data: { ...lastOrder.data },
      image: null,
      imagePreview: null,
      isApplied: true // 복사된 건 바로 적용 상태
    }]);
  };

  // 텍스트 파싱 후 적용
  const applyText = (orderId: number) => {
    const text = textInputRefs.current[orderId] || '';
    const lines = text.split('\n');
    const data: Record<string, string> = {};
    
    lines.forEach(line => {
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        data[match[1].trim()] = match[2].trim();
      }
    });
    
    setOrders(orders.map(o => 
      o.id === orderId ? { ...o, data, isApplied: true } : o
    ));
  };

  // 수정 모드로 전환
  const editOrder = (orderId: number) => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
      // 현재 데이터를 텍스트로 변환
      const text = Object.entries(order.data)
        .filter(([_, value]) => value)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
      textInputRefs.current[orderId] = text;
    }
    setOrders(orders.map(o => 
      o.id === orderId ? { ...o, isApplied: false } : o
    ));
  };

  // 필드 직접 수정
  const updateField = (orderId: number, field: string, value: string) => {
    setOrders(orders.map(o => 
      o.id === orderId ? { ...o, data: { ...o.data, [field]: value } } : o
    ));
  };

  const handleImageChange = async (orderId: number, file: File | null) => {
    if (file) {
      setProgress('이미지 압축 중...');
      const compressedFile = await compressImage(file);
      setProgress('');
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setOrders(orders.map(o => 
          o.id === orderId 
            ? { ...o, image: compressedFile, imagePreview: e.target?.result as string }
            : o
        ));
      };
      reader.readAsDataURL(compressedFile);
    }
  };

  const handleSubmit = async () => {
    if (!manager) {
      setResult({ type: 'error', message: '담당자를 선택해주세요.' });
      return;
    }

    // 적용 안된 주문 체크
    const notApplied = orders.filter(o => !o.isApplied);
    if (notApplied.length > 0) {
      setResult({ type: 'error', message: '모든 주문의 정보를 적용해주세요.' });
      return;
    }

    setLoading(true);
    setResult(null);
    setProgress('업로드 준비 중...');

    try {
      const formData = new FormData();
      formData.append('manager', manager);
      formData.append('orders', JSON.stringify(orders.map(o => o.data)));
      
      orders.forEach((order) => {
        if (order.image) {
          formData.append('images', order.image);
        }
      });

      setProgress('서버에 전송 중...');

      const response = await fetch(`${API_URL}/api/submit-orders`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setResult({ type: 'success', message: data.message });
        setOrders([{ id: Date.now(), data: {}, image: null, imagePreview: null, isApplied: false }]);
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
      
      {/* 담당자 선택 */}
      <div style={styles.managerSection}>
        <label style={styles.managerLabel}>담당자 선택</label>
        <div style={styles.managerButtons}>
          {MANAGERS.map(m => (
            <button
              key={m}
              onClick={() => setManager(m)}
              style={{
                ...styles.managerBtn,
                backgroundColor: manager === m ? '#4285f4' : '#fff',
                color: manager === m ? '#fff' : '#333',
                border: manager === m ? '2px solid #4285f4' : '2px solid #ddd'
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.buttonGroup}>
        <button onClick={addOrder} style={styles.addBtn}>+ 새 주문 추가</button>
        <button onClick={copyLastOrder} style={styles.copyBtn}>📋 마지막 주문 복사</button>
      </div>

      {orders.map((order, index) => (
        <div key={order.id} style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.orderNum}>
              주문 #{index + 1}
              {order.isApplied && <span style={styles.appliedBadge}>✓ 적용됨</span>}
            </span>
            {orders.length > 1 && (
              <button onClick={() => removeOrder(order.id)} style={styles.removeBtn}>✕ 삭제</button>
            )}
          </div>

          {!order.isApplied ? (
            /* 텍스트 입력 모드 */
            <div style={styles.inputMode}>
              <label style={styles.label}>📝 주문 정보 입력 (복사/붙여넣기)</label>
              <textarea
                placeholder={`제품명: \n수취인명: \n연락처: \n은행: \n계좌: \n예금주: \n결제금액: \n아이디: \n주문번호: \n주소: \n닉네임: \n회수이름: \n회수연락처: `}
                style={styles.textarea}
                defaultValue={textInputRefs.current[order.id] || ''}
                onChange={(e) => { textInputRefs.current[order.id] = e.target.value; }}
              />
              <button onClick={() => applyText(order.id)} style={styles.applyBtn}>
                ✓ 적용하기
              </button>
            </div>
          ) : (
            /* 적용된 데이터 보기 모드 */
            <div style={styles.viewMode}>
              <div style={styles.dataGrid}>
                {DEFAULT_FIELDS.map(field => (
                  order.data[field] && (
                    <div key={field} style={styles.dataItem}>
                      <span style={styles.dataLabel}>{field}</span>
                      <span style={styles.dataValue}>{order.data[field]}</span>
                    </div>
                  )
                ))}
              </div>
              <button onClick={() => editOrder(order.id)} style={styles.editBtn}>
                ✏️ 수정
              </button>
            </div>
          )}

          {/* 이미지 업로드 */}
          <div style={styles.imageSection}>
            <label style={styles.label}>📸 구매내역 캡쳐</label>
            <div 
              style={{
                ...styles.dropzone,
                borderColor: order.imagePreview ? '#28a745' : '#ddd',
                backgroundColor: order.imagePreview ? '#f0fff4' : '#fafafa'
              }}
              onClick={() => fileInputRefs.current[order.id]?.click()}
            >
              {order.imagePreview ? (
                <div>
                  <img src={order.imagePreview} alt="미리보기" style={styles.preview} />
                  <p style={{ color: '#28a745', margin: '10px 0 0', fontSize: '14px' }}>✅ 이미지 첨부됨</p>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: '32px', margin: 0 }}>📷</p>
                  <p style={{ color: '#666', fontSize: '14px' }}>클릭하여 이미지 선택</p>
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
  managerSection: { backgroundColor: 'white', padding: '20px', borderRadius: '12px', marginBottom: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', textAlign: 'center' },
  managerLabel: { display: 'block', fontSize: '16px', fontWeight: 'bold', marginBottom: '15px', color: '#333' },
  managerButtons: { display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' },
  managerBtn: { padding: '12px 30px', borderRadius: '8px', fontSize: '16px', fontWeight: '500', cursor: 'pointer' },
  buttonGroup: { display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'center' },
  addBtn: { backgroundColor: '#4285f4', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: '500' },
  copyBtn: { backgroundColor: '#34a853', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: '500' },
  card: { backgroundColor: 'white', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', paddingBottom: '10px', borderBottom: '2px solid #4285f4' },
  orderNum: { fontSize: '18px', fontWeight: 'bold', color: '#4285f4', display: 'flex', alignItems: 'center', gap: '10px' },
  appliedBadge: { fontSize: '12px', backgroundColor: '#28a745', color: 'white', padding: '3px 8px', borderRadius: '12px' },
  removeBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' },
  
  // 입력 모드
  inputMode: { marginBottom: '15px' },
  label: { display: 'block', marginBottom: '8px', fontWeight: '500', color: '#333' },
  textarea: { width: '100%', height: '200px', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box', marginBottom: '10px' },
  applyBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' },
  
  // 보기 모드
  viewMode: { marginBottom: '15px' },
  dataGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', marginBottom: '10px' },
  dataItem: { backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '6px', border: '1px solid #e9ecef' },
  dataLabel: { display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' },
  dataValue: { display: 'block', fontSize: '14px', color: '#333', fontWeight: '500' },
  editBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
  
  // 이미지
  imageSection: { marginTop: '15px' },
  dropzone: { border: '2px dashed #ddd', borderRadius: '8px', padding: '20px', textAlign: 'center', cursor: 'pointer' },
  preview: { maxWidth: '100%', maxHeight: '150px', borderRadius: '8px' },
  
  // 상태
  progress: { padding: '15px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', backgroundColor: '#fff3cd', color: '#856404' },
  result: { padding: '15px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', fontWeight: '500' },
  submitBtn: { width: '100%', backgroundColor: '#4285f4', color: 'white', border: 'none', padding: '16px', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }
};
