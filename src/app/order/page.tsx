'use client';

import { useState, useRef } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const MANAGERS = ['태일', '서지은', '자인'];

const DEFAULT_FIELDS = [
  '제품명', '수취인명', '연락처', '은행', '계좌(-)', '예금주',
  '결제금액', '아이디', '주문번호', '주소', '회수연락처'
];

interface OrderItem {
  id: number;
  data: Record<string, string>;
  image: File | null;
  imagePreview: string | null;
}

// 이미지 압축 함수
const compressImage = (file: File, maxWidth = 1200, quality = 0.7): Promise<File> => {
  return new Promise((resolve) => {
    // 이미 작은 파일은 압축 안함
    if (file.size < 100 * 1024) {
      resolve(file);
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    
    img.onload = () => {
      let { width, height } = img;
      
      // 비율 유지하며 리사이즈
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
            console.log(`압축: ${(file.size/1024).toFixed(0)}KB → ${(compressedFile.size/1024).toFixed(0)}KB`);
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
    { id: Date.now(), data: {}, image: null, imagePreview: null }
  ]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const addOrder = () => {
    setOrders([...orders, { id: Date.now(), data: {}, image: null, imagePreview: null }]);
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
      imagePreview: null
    }]);
  };

  const updateField = (orderId: number, field: string, value: string) => {
    setOrders(orders.map(o => 
      o.id === orderId ? { ...o, data: { ...o.data, [field]: value } } : o
    ));
  };

  const parseText = (orderId: number, text: string) => {
    const lines = text.split('\n');
    const data: Record<string, string> = {};
    
    lines.forEach(line => {
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        data[match[1].trim()] = match[2].trim();
      }
    });
    
    setOrders(orders.map(o => o.id === orderId ? { ...o, data } : o));
  };

  // 이미지 선택 시 압축 적용
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
        setOrders([{ id: Date.now(), data: {}, image: null, imagePreview: null }]);
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
            <span style={styles.orderNum}>주문 #{index + 1}</span>
            {orders.length > 1 && (
              <button onClick={() => removeOrder(order.id)} style={styles.removeBtn}>✕ 삭제</button>
            )}
          </div>

          <div style={styles.quickInput}>
            <label style={styles.label}>📝 빠른 입력 (복사/붙여넣기)</label>
            <textarea
              placeholder={`제품명: \n수취인명: \n연락처: \n은행: \n계좌(-): \n예금주: \n결제금액: \n아이디: \n주문번호: \n주소: \n회수연락처: `}
              style={styles.textarea}
              onChange={(e) => parseText(order.id, e.target.value)}
            />
          </div>

          <div style={styles.fieldsGrid}>
            {DEFAULT_FIELDS.map(field => (
              <div key={field} style={styles.fieldGroup}>
                <label style={styles.label}>{field}</label>
                <input
                  type="text"
                  value={order.data[field] || ''}
                  onChange={(e) => updateField(order.id, field, e.target.value)}
                  style={styles.input}
                  placeholder={field}
                />
              </div>
            ))}
          </div>

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
                  <p style={{ color: '#28a745', margin: '10px 0 0' }}>✅ {order.image?.name}</p>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: '40px', margin: 0 }}>📷</p>
                  <p style={{ color: '#666' }}>클릭하여 이미지 선택</p>
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

      {/* 진행 상태 */}
      {progress && (
        <div style={styles.progress}>{progress}</div>
      )}

      {/* 결과 메시지 */}
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
  orderNum: { fontSize: '18px', fontWeight: 'bold', color: '#4285f4' },
  removeBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' },
  quickInput: { marginBottom: '20px' },
  label: { display: 'block', marginBottom: '5px', fontWeight: '500', color: '#333' },
  textarea: { width: '100%', height: '150px', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box' },
  fieldsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' },
  fieldGroup: { display: 'flex', flexDirection: 'column' },
  input: { padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' },
  imageSection: { marginTop: '15px' },
  dropzone: { border: '2px dashed #ddd', borderRadius: '8px', padding: '30px', textAlign: 'center', cursor: 'pointer' },
  preview: { maxWidth: '100%', maxHeight: '200px', borderRadius: '8px' },
  progress: { padding: '15px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', backgroundColor: '#fff3cd', color: '#856404' },
  result: { padding: '15px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', fontWeight: '500' },
  submitBtn: { width: '100%', backgroundColor: '#4285f4', color: 'white', border: 'none', padding: '16px', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }
};
