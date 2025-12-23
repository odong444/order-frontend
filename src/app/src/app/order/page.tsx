'use client';

import { useState, useRef } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// 담당자 목록 (시트명과 동일)
const MANAGERS = ['태일', '서지은', '자인'];

// 기본 필드 목록
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

export default function OrderPage() {
  const [manager, setManager] = useState<string>('');
  const [orders, setOrders] = useState<OrderItem[]>([
    { id: Date.now(), data: {}, image: null, imagePreview: null }
  ]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // 주문 추가
  const addOrder = () => {
    setOrders([...orders, { 
      id: Date.now(), 
      data: {}, 
      image: null, 
      imagePreview: null 
    }]);
  };

  // 주문 삭제
  const removeOrder = (id: number) => {
    if (orders.length > 1) {
      setOrders(orders.filter(o => o.id !== id));
    }
  };

  // 주문 복사 (마지막 주문 데이터 복사)
  const copyLastOrder = () => {
    const lastOrder = orders[orders.length - 1];
    setOrders([...orders, {
      id: Date.now(),
      data: { ...lastOrder.data },
      image: null,
      imagePreview: null
    }]);
  };

  // 필드 값 변경
  const updateField = (orderId: number, field: string, value: string) => {
    setOrders(orders.map(o => 
      o.id === orderId 
        ? { ...o, data: { ...o.data, [field]: value } }
        : o
    ));
  };

  // 텍스트 파싱 (필드명: 값 형식)
  const parseText = (orderId: number, text: string) => {
    const lines = text.split('\n');
    const data: Record<string, string> = {};
    
    lines.forEach(line => {
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        data[match[1].trim()] = match[2].trim();
      }
    });
    
    setOrders(orders.map(o => 
      o.id === orderId ? { ...o, data } : o
    ));
  };

  // 이미지 선택
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

  // 제출
  const handleSubmit = async () => {
    if (!manager) {
      setResult({ type: 'error', message: '담당자를 선택해주세요.' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      
      // 담당자 (시트명)
      formData.append('manager', manager);
      
      // 주문 데이터
      const ordersData = orders.map(o => o.data);
      formData.append('orders', JSON.stringify(ordersData));
      
      // 이미지 파일들
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
        setResult({ type: 'success', message: data.message });
        // 폼 초기화
        setOrders([{ id: Date.now(), data: {}, image: null, imagePreview: null }]);
      } else {
        setResult({ type: 'error', message: data.error || '저장 실패' });
      }
    } catch (error: any) {
      setResult({ type: 'error', message: error.message || '네트워크 오류' });
    } finally {
      setLoading(false);
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
        <button onClick={addOrder} style={styles.addBtn}>
          + 새 주문 추가
        </button>
        <button onClick={copyLastOrder} style={styles.copyBtn}>
          📋 마지막 주문 복사
        </button>
      </div>

      {orders.map((order, index) => (
        <div key={order.id} style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.orderNum}>주문 #{index + 1}</span>
            {orders.length > 1 && (
              <button 
                onClick={() => removeOrder(order.id)} 
                style={styles.removeBtn}
              >
                ✕ 삭제
              </button>
            )}
          </div>

          {/* 빠른 입력 (텍스트 파싱) */}
          <div style={styles.quickInput}>
            <label style={styles.label}>📝 빠른 입력 (복사/붙여넣기)</label>
            <textarea
              placeholder={`제품명: \n수취인명: \n연락처: \n은행: \n계좌(-): \n예금주: \n결제금액: \n아이디: \n주문번호: \n주소: \n회수연락처: `}
              style={styles.textarea}
              onChange={(e) => parseText(order.id, e.target.value)}
            />
          </div>

          {/* 필드 입력 */}
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
                  <img 
                    src={order.imagePreview} 
                    alt="미리보기" 
                    style={styles.preview}
                  />
                  <p style={{ color: '#28a745', margin: '10px 0 0' }}>
                    ✅ {order.image?.name}
                  </p>
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

      {/* 제출 버튼 */}
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
  container: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '20px',
    backgroundColor: '#f8f9fa',
    minHeight: '100vh'
  },
  title: {
    textAlign: 'center',
    color: '#333',
    marginBottom: '20px'
  },
  managerSection: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '12px',
    marginBottom: '20px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    textAlign: 'center'
  },
  managerLabel: {
    display: 'block',
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '15px',
    color: '#333'
  },
  managerButtons: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'center',
    flexWrap: 'wrap'
  },
  managerBtn: {
    padding: '12px 30px',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  buttonGroup: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
    justifyContent: 'center'
  },
  addBtn: {
    backgroundColor: '#4285f4',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500'
  },
  copyBtn: {
    backgroundColor: '#34a853',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '20px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
    paddingBottom: '10px',
    borderBottom: '2px solid #4285f4'
  },
  orderNum: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#4285f4'
  },
  removeBtn: {
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  quickInput: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    marginBottom: '5px',
    fontWeight: '500',
    color: '#333'
  },
  textarea: {
    width: '100%',
    height: '150px',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'monospace',
    resize: 'vertical',
    boxSizing: 'border-box'
  },
  fieldsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '15px',
    marginBottom: '20px'
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column'
  },
  input: {
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px'
  },
  imageSection: {
    marginTop: '15px'
  },
  dropzone: {
    border: '2px dashed #ddd',
    borderRadius: '8px',
    padding: '30px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.3s'
  },
  preview: {
    maxWidth: '100%',
    maxHeight: '200px',
    borderRadius: '8px'
  },
  result: {
    padding: '15px',
    borderRadius: '8px',
    marginBottom: '20px',
    textAlign: 'center',
    fontWeight: '500'
  },
  submitBtn: {
    width: '100%',
    backgroundColor: '#4285f4',
    color: 'white',
    border: 'none',
    padding: '16px',
    borderRadius: '8px',
    fontSize: '18px',
    fontWeight: 'bold',
    cursor: 'pointer'
  }
};
