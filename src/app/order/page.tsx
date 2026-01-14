'use client';

import { useState, useRef } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const MANAGERS = ['태일', '서지은', '자인'];

// 자동 추출 필드 (OCR)
const AUTO_FIELDS = ['제품명', '수취인명', '연락처', '주소', '주문번호', '결제금액'];

// 직접 입력 필드 (AI 파싱)
const MANUAL_FIELDS = ['은행', '계좌', '예금주', '아이디', '닉네임', '회수이름', '회수연락처'];

// 전체 필드 순서 (시트 저장용)
const ALL_FIELD_KEYS = [
  '제품명', '수취인명', '연락처', '은행', '계좌', '예금주',
  '결제금액', '아이디', '주문번호', '주소', '닉네임', '회수이름', '회수연락처'
];

interface OrderItem {
  id: number;
  image: File | null;
  imagePreview: string | null;
  autoData: Record<string, string>;  // OCR 추출 데이터
  manualText: string;                 // 직접 입력 텍스트
  manualData: Record<string, string>; // AI 파싱된 직접 입력 데이터
  isAnalyzing: boolean;
  isAnalyzed: boolean;
  isParsingManual: boolean;
  manualParsed: boolean;
  error: string | null;
}

export default function OrderPage() {
  const [manager, setManager] = useState<string>('');
  const [orders, setOrders] = useState<OrderItem[]>([createNewOrder()]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  function createNewOrder(): OrderItem {
    return {
      id: Date.now(),
      image: null,
      imagePreview: null,
      autoData: {},
      manualText: '',
      manualData: {},
      isAnalyzing: false,
      isAnalyzed: false,
      isParsingManual: false,
      manualParsed: false,
      error: null
    };
  }

  const addOrder = () => {
    setOrders([...orders, createNewOrder()]);
  };

  const removeOrder = (id: number) => {
    if (orders.length > 1) {
      setOrders(orders.filter(o => o.id !== id));
    }
  };

  // 여러 이미지 한번에 업로드
  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // 첫 번째 빈 주문이 있으면 제거
    const hasEmptyFirst = orders.length === 1 && !orders[0].image && !orders[0].isAnalyzed;
    
    const newOrders: OrderItem[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const newOrder = createNewOrder();
      newOrder.id = Date.now() + i;
      newOrders.push(newOrder);
    }

    // 기존 주문 + 새 주문 (빈 첫 주문 제거)
    const updatedOrders = hasEmptyFirst 
      ? [...newOrders]
      : [...orders, ...newOrders];
    
    setOrders(updatedOrders);

    // 각 이미지에 대해 OCR 분석 시작
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const orderId = newOrders[i].id;
      
      // 약간의 딜레이로 순차 처리 (서버 부하 방지)
      setTimeout(() => {
        processImageForOrder(orderId, file);
      }, i * 500);
    }

    // input 초기화
    e.target.value = '';
  };

  // 이미지 처리 (OCR)
  const processImageForOrder = async (orderId: number, file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageData = e.target?.result as string;
      
      setOrders(prev => prev.map(o => 
        o.id === orderId 
          ? { ...o, image: file, imagePreview: imageData, isAnalyzing: true, error: null }
          : o
      ));

      // OCR API 호출
      try {
        const response = await fetch(`${API_URL}/api/analyze-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageData })
        });

        const data = await response.json();

        if (data.success && data.data) {
          setOrders(prev => prev.map(o => 
            o.id === orderId 
              ? { ...o, autoData: data.data, isAnalyzing: false, isAnalyzed: true, error: null }
              : o
          ));
        } else {
          throw new Error(data.error || 'OCR 분석 실패');
        }
      } catch (error: any) {
        setOrders(prev => prev.map(o => 
          o.id === orderId 
            ? { ...o, isAnalyzing: false, error: error.message }
            : o
        ));
      }
    };
    reader.readAsDataURL(file);
  };

  // 이미지 업로드 및 OCR 분석
  const handleImageUpload = async (orderId: number, file: File | null) => {
    if (!file) return;

    // 미리보기 생성
    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageData = e.target?.result as string;
      
      setOrders(prev => prev.map(o => 
        o.id === orderId 
          ? { ...o, image: file, imagePreview: imageData, isAnalyzing: true, error: null }
          : o
      ));

      // OCR API 호출
      try {
        const response = await fetch(`${API_URL}/api/analyze-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageData })
        });

        const data = await response.json();

        if (data.success && data.data) {
          setOrders(prev => prev.map(o => 
            o.id === orderId 
              ? { ...o, autoData: data.data, isAnalyzing: false, isAnalyzed: true, error: null }
              : o
          ));
        } else {
          throw new Error(data.error || 'OCR 분석 실패');
        }
      } catch (error: any) {
        setOrders(prev => prev.map(o => 
          o.id === orderId 
            ? { ...o, isAnalyzing: false, error: error.message }
            : o
        ));
      }
    };
    reader.readAsDataURL(file);
  };

  // 재분석
  const retryAnalysis = (orderId: number) => {
    const order = orders.find(o => o.id === orderId);
    if (order?.image) {
      handleImageUpload(orderId, order.image);
    }
  };

  // 자동 추출 필드 수정
  const updateAutoField = (orderId: number, key: string, value: string) => {
    setOrders(prev => prev.map(o => 
      o.id === orderId 
        ? { ...o, autoData: { ...o.autoData, [key]: value } }
        : o
    ));
  };

  // 직접 입력 텍스트 수정
  const updateManualText = (orderId: number, text: string) => {
    setOrders(prev => prev.map(o => 
      o.id === orderId ? { ...o, manualText: text } : o
    ));
  };

  // AI로 직접 입력 텍스트 파싱
  const parseManualWithAI = async (orderId: number) => {
    const order = orders.find(o => o.id === orderId);
    if (!order?.manualText.trim()) return;

    setOrders(prev => prev.map(o => 
      o.id === orderId ? { ...o, isParsingManual: true } : o
    ));

    try {
      const response = await fetch(`${API_URL}/api/parse-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: order.manualText })
      });

      const data = await response.json();

      if (data.success && data.data) {
        // AI 파싱 결과를 manualData에 저장
        setOrders(prev => prev.map(o => 
          o.id === orderId 
            ? { ...o, manualData: data.data, isParsingManual: false, manualParsed: true }
            : o
        ));
      } else {
        throw new Error(data.error || '파싱 실패');
      }
    } catch (error: any) {
      setResult({ type: 'error', message: 'AI 파싱 실패: ' + error.message });
      setOrders(prev => prev.map(o => 
        o.id === orderId ? { ...o, isParsingManual: false } : o
      ));
    }
  };

  // 제출
  const handleSubmit = async () => {
    if (!manager) {
      setResult({ type: 'error', message: '담당자를 선택해주세요.' });
      return;
    }

    const notAnalyzed = orders.filter(o => !o.isAnalyzed);
    if (notAnalyzed.length > 0) {
      setResult({ type: 'error', message: '모든 주문의 이미지를 업로드하고 분석을 완료해주세요.' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('manager', manager);

      // 각 주문의 데이터를 배열로 변환
      const ordersData = orders.map(order => {
        // OCR 데이터 기본으로 시작
        const merged = { ...order.autoData };
        
        // manualData에서 값이 있는 것만 덮어쓰기
        Object.entries(order.manualData).forEach(([key, value]) => {
          if (value && value.trim() !== '') {
            merged[key] = value;
          }
        });
        
        // ALL_FIELD_KEYS 순서대로 배열 생성
        return ALL_FIELD_KEYS.map(key => merged[key] || '');
      });

      formData.append('orders', JSON.stringify(ordersData));

      // 이미지 첨부
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
        setOrders([createNewOrder()]);
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
      {/* 이미지 모달 */}
      {modalImage && (
        <div style={styles.modalOverlay} onClick={() => setModalImage(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button style={styles.modalClose} onClick={() => setModalImage(null)}>✕</button>
            <img src={modalImage} alt="크게보기" style={styles.modalImage} />
          </div>
        </div>
      )}

      <h1 style={styles.title}>📸 구매내역 제출</h1>
      <p style={styles.subtitle}>이미지를 올리면 AI가 자동으로 정보를 추출합니다</p>

      {/* 담당자 선택 */}
      <div style={styles.managerCard}>
        <label style={styles.label}>담당자 선택</label>
        <div style={styles.managerButtons}>
          {MANAGERS.map(m => (
            <button
              key={m}
              onClick={() => setManager(m)}
              style={{
                ...styles.managerBtn,
                ...(manager === m ? styles.managerBtnActive : {})
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* 주문 목록 */}
      {orders.map((order, index) => (
        <div key={order.id} style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.orderNum}>주문 #{index + 1}</span>
            {orders.length > 1 && (
              <button onClick={() => removeOrder(order.id)} style={styles.removeBtn}>✕</button>
            )}
          </div>

          {/* 이미지 업로드 */}
          <div style={styles.imageContainer}>
            <div
              onClick={() => fileInputRefs.current[order.id]?.click()}
              style={{
                ...styles.uploadZone,
                borderColor: order.isAnalyzed ? '#10b981' : order.isAnalyzing ? '#f59e0b' : order.error ? '#ef4444' : '#d0d0d0',
                backgroundColor: order.isAnalyzed ? '#ecfdf5' : order.isAnalyzing ? '#fffbeb' : order.error ? '#fef2f2' : '#fafafa'
              }}
            >
              {order.imagePreview ? (
                <>
                  <img src={order.imagePreview} alt="미리보기" style={styles.previewImage} />
                  <div style={{
                    ...styles.imageStatus,
                    color: order.isAnalyzing ? '#f59e0b' : order.error ? '#ef4444' : '#10b981'
                  }}>
                    {order.isAnalyzing ? '🔄 AI 분석 중...' : order.error ? `❌ ${order.error}` : '✅ 분석 완료'}
                  </div>
                  {order.error && (
                    <button onClick={(e) => { e.stopPropagation(); retryAnalysis(order.id); }} style={styles.retryBtn}>
                      다시 시도
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div style={styles.uploadIcon}>📷</div>
                  <div style={styles.uploadText}>주문 캡쳐 이미지 업로드</div>
                  <div style={styles.uploadHint}>클릭하여 이미지 선택</div>
                </>
              )}
            </div>
            {order.imagePreview && (
              <div style={styles.imageActions}>
                <button 
                  onClick={() => setModalImage(order.imagePreview)}
                  style={styles.viewImageBtn}
                >
                  🔍 이미지 크게보기
                </button>
                <button 
                  onClick={() => fileInputRefs.current[order.id]?.click()}
                  style={styles.changeImageBtn}
                >
                  📷 다른 이미지
                </button>
              </div>
            )}
          </div>
          <input
            ref={(el) => { fileInputRefs.current[order.id] = el; }}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => handleImageUpload(order.id, e.target.files?.[0] || null)}
          />

          {/* 분석 결과 폼 */}
          {order.isAnalyzed && (
            <div style={styles.formSection}>
              <div style={styles.fieldGroupLabel}>🤖 자동 추출 항목</div>
              <div style={styles.formGrid}>
                {AUTO_FIELDS.map(field => (
                  <div key={field} style={styles.formRow}>
                    <label style={styles.formLabel}>
                      {field}
                      {field === '주문번호' && <span style={styles.checkHint}>⚠️확인</span>}
                    </label>
                    <input
                      type="text"
                      value={order.autoData[field] || ''}
                      onChange={(e) => updateAutoField(order.id, field, e.target.value)}
                      style={{
                        ...styles.formInputAuto,
                        ...(field === '주문번호' ? styles.orderNumInput : {})
                      }}
                      placeholder="자동 추출됨"
                    />
                  </div>
                ))}
              </div>

              <div style={styles.fieldGroupLabel}>✍️ 직접 입력 (그냥 붙여넣기하면 AI가 자동 분류)</div>
              
              {!order.manualParsed ? (
                <>
                  <textarea
                    value={order.manualText}
                    onChange={(e) => updateManualText(order.id, e.target.value)}
                    style={styles.manualTextarea}
                    placeholder={`카카오뱅크 3333-12-1234567 홍길동 user123\n\n이렇게 그냥 붙여넣기하면 AI가 알아서 분류해요`}
                  />
                  <button
                    onClick={() => parseManualWithAI(order.id)}
                    disabled={order.isParsingManual || !order.manualText.trim()}
                    style={{
                      ...styles.applyBtn,
                      opacity: (order.isParsingManual || !order.manualText.trim()) ? 0.6 : 1
                    }}
                  >
                    {order.isParsingManual ? '🔄 AI 분석 중...' : '✓ 적용하기'}
                  </button>
                </>
              ) : (
                <>
                  <div style={styles.parsedDataGrid}>
                    {MANUAL_FIELDS.map(field => (
                      order.manualData[field] && (
                        <div key={field} style={styles.parsedItem}>
                          <span style={styles.parsedLabel}>{field}</span>
                          <span style={styles.parsedValue}>{order.manualData[field]}</span>
                        </div>
                      )
                    ))}
                  </div>
                  <button
                    onClick={() => setOrders(prev => prev.map(o => 
                      o.id === order.id ? { ...o, manualParsed: false } : o
                    ))}
                    style={styles.editBtn}
                  >
                    ✏️ 수정
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      ))}

      {/* 여러 이미지 한번에 추가 */}
      <div style={styles.bulkUploadSection}>
        <input
          type="file"
          id="bulkUpload"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleBulkUpload}
        />
        <button 
          onClick={() => document.getElementById('bulkUpload')?.click()}
          style={styles.bulkUploadBtn}
        >
          📷 이미지 여러장 한번에 추가
        </button>
      </div>

      {/* 주문 추가 버튼 */}
      <button onClick={addOrder} style={styles.addOrderBtn}>+ 주문 추가</button>

      {/* 결과 메시지 */}
      {result && (
        <div style={{
          ...styles.resultMessage,
          backgroundColor: result.type === 'success' ? '#ecfdf5' : '#fef2f2',
          color: result.type === 'success' ? '#059669' : '#dc2626'
        }}>
          {result.message}
        </div>
      )}

      {/* 제출 전 확인 안내 */}
      <div style={styles.confirmNotice}>
        ⚠️ 제출 전 확인해주세요!
        <ul style={styles.confirmList}>
          <li>주문번호가 이미지와 일치하나요? (5↔S, 0↔O 헷갈림 주의)</li>
          <li>수취인명, 연락처, 주소가 정확한가요?</li>
          <li>직접 입력 항목(은행, 계좌 등)을 입력하셨나요?</li>
        </ul>
      </div>

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
  modalOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px'
  },
  modalContent: {
    position: 'relative' as const,
    maxWidth: '90vw',
    maxHeight: '90vh'
  },
  modalClose: {
    position: 'absolute' as const,
    top: '-40px',
    right: '0',
    backgroundColor: 'transparent',
    border: 'none',
    color: 'white',
    fontSize: '30px',
    cursor: 'pointer',
    padding: '10px'
  },
  modalImage: {
    maxWidth: '100%',
    maxHeight: '85vh',
    borderRadius: '8px'
  },
  container: {
    maxWidth: '500px',
    margin: '0 auto',
    padding: '20px',
    backgroundColor: '#667eea',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  },
  title: {
    textAlign: 'center',
    color: 'white',
    marginBottom: '8px',
    fontSize: '24px',
    fontWeight: '700'
  },
  subtitle: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: '24px',
    fontSize: '14px'
  },
  managerCard: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '20px',
    marginBottom: '16px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.15)'
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '12px'
  },
  managerButtons: {
    display: 'flex',
    gap: '8px'
  },
  managerBtn: {
    flex: 1,
    padding: '12px',
    border: '2px solid #e0e0e0',
    borderRadius: '10px',
    backgroundColor: 'white',
    fontSize: '15px',
    fontWeight: '600',
    color: '#666',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  managerBtnActive: {
    borderColor: '#667eea',
    backgroundColor: '#667eea',
    color: 'white'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '20px',
    marginBottom: '16px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
    position: 'relative' as const
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  orderNum: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#333'
  },
  removeBtn: {
    width: '28px',
    height: '28px',
    border: 'none',
    borderRadius: '50%',
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    fontSize: '16px',
    cursor: 'pointer'
  },
  uploadZone: {
    border: '2px dashed #d0d0d0',
    borderRadius: '12px',
    padding: '30px 20px',
    textAlign: 'center' as const,
    cursor: 'pointer',
    transition: 'all 0.3s'
  },
  uploadIcon: {
    fontSize: '48px',
    marginBottom: '12px'
  },
  uploadText: {
    fontSize: '15px',
    color: '#666',
    marginBottom: '4px'
  },
  uploadHint: {
    fontSize: '13px',
    color: '#999'
  },
  imageContainer: {
    marginBottom: '0'
  },
  imageActions: {
    display: 'flex',
    gap: '8px',
    marginTop: '8px'
  },
  viewImageBtn: {
    flex: 1,
    padding: '10px',
    backgroundColor: '#3b82f6',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  changeImageBtn: {
    flex: 1,
    padding: '10px',
    backgroundColor: '#6b7280',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  previewImage: {
    maxWidth: '100%',
    maxHeight: '150px',
    borderRadius: '8px',
    marginBottom: '12px'
  },
  imageStatus: {
    fontSize: '14px',
    fontWeight: '600'
  },
  retryBtn: {
    marginTop: '8px',
    padding: '8px 16px',
    backgroundColor: '#667eea',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    fontSize: '13px',
    cursor: 'pointer'
  },
  formSection: {
    marginTop: '20px'
  },
  fieldGroupLabel: {
    fontSize: '12px',
    color: '#888',
    marginBottom: '12px',
    paddingBottom: '8px',
    borderBottom: '1px dashed #eee'
  },
  formGrid: {
    display: 'grid',
    gap: '10px',
    marginBottom: '20px'
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '90px 1fr',
    alignItems: 'center',
    gap: '8px'
  },
  formLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#555',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  checkHint: {
    fontSize: '10px',
    color: '#f59e0b',
    fontWeight: '500'
  },
  formInputAuto: {
    width: '100%',
    padding: '10px 12px',
    border: '1.5px solid #86efac',
    borderRadius: '8px',
    fontSize: '14px',
    backgroundColor: '#f0fdf4',
    boxSizing: 'border-box' as const
  },
  orderNumInput: {
    borderColor: '#fcd34d',
    backgroundColor: '#fffbeb'
  },
  manualTextarea: {
    width: '100%',
    minHeight: '100px',
    padding: '12px',
    border: '1.5px solid #fcd34d',
    borderRadius: '8px',
    fontSize: '14px',
    backgroundColor: '#fffbeb',
    resize: 'vertical' as const,
    fontFamily: 'inherit',
    lineHeight: '1.6',
    boxSizing: 'border-box' as const,
    marginBottom: '10px'
  },
  applyBtn: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#10b981',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  parsedDataGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
    marginBottom: '10px'
  },
  parsedItem: {
    backgroundColor: '#f0fdf4',
    padding: '8px 10px',
    borderRadius: '6px',
    border: '1px solid #86efac'
  },
  parsedLabel: {
    display: 'block',
    fontSize: '11px',
    color: '#666',
    marginBottom: '2px'
  },
  parsedValue: {
    display: 'block',
    fontSize: '13px',
    color: '#333',
    fontWeight: '500'
  },
  editBtn: {
    padding: '8px 16px',
    backgroundColor: '#6b7280',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    fontSize: '13px',
    cursor: 'pointer'
  },
  addOrderBtn: {
    width: '100%',
    padding: '14px',
    backgroundColor: 'white',
    border: '2px dashed rgba(255,255,255,0.5)',
    borderRadius: '12px',
    color: 'white',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    marginBottom: '16px',
    background: 'rgba(255,255,255,0.1)'
  },
  bulkUploadSection: {
    marginBottom: '12px'
  },
  bulkUploadBtn: {
    width: '100%',
    padding: '16px',
    backgroundColor: '#10b981',
    border: 'none',
    borderRadius: '12px',
    color: 'white',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
  },
  resultMessage: {
    padding: '14px',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: '600',
    textAlign: 'center' as const,
    marginBottom: '16px'
  },
  confirmNotice: {
    backgroundColor: '#fef3c7',
    border: '1px solid #f59e0b',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '16px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#92400e'
  },
  confirmList: {
    margin: '10px 0 0 0',
    paddingLeft: '20px',
    fontSize: '13px',
    fontWeight: '500',
    lineHeight: '1.8'
  },
  submitBtn: {
    width: '100%',
    padding: '16px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    borderRadius: '12px',
    color: 'white',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
  }
};
