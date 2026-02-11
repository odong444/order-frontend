'use client';

import { useState, useRef } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const MANAGERS = ['태일', '서지은', '자인'];

const AUTO_FIELDS = ['수취인명', '연락처', '주소', '주문번호', '결제금액'];
const MANUAL_FIELDS = ['제품명', '아이디', '은행', '계좌', '예금주'];
const ALL_FIELD_KEYS = [
  '제품명', '수취인명', '연락처', '은행', '계좌', '예금주',
  '결제금액', '아이디', '주문번호', '주소', '닉네임', '회수이름', '회수연락처'
];

interface OrderItem {
  id: number;
  image: File | null;
  imagePreview: string | null;
  autoData: Record<string, string>;
  manualText: string;
  manualData: Record<string, string>;
  isAnalyzing: boolean;
  isAnalyzed: boolean;
  isParsingManual: boolean;
  manualParsed: boolean;
  error: string | null;
}

export default function OrderPage() {
  const [manager, setManager] = useState<string>('');
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const mainUploadRef = useRef<HTMLInputElement | null>(null);

  function createNewOrder(): OrderItem {
    return {
      id: Date.now(),
      image: null,
      imagePreview: null,
      autoData: {},
      manualText: '제품명:\n아이디:\n은행:\n계좌:\n예금주:',
      manualData: {},
      isAnalyzing: false,
      isAnalyzed: false,
      isParsingManual: false,
      manualParsed: false,
      error: null
    };
  }

  const removeOrder = (id: number) => {
    setOrders(orders.filter(o => o.id !== id));
  };

  // 메인 이미지 업로드 (1장 또는 여러장)
  const handleMainUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newOrders: OrderItem[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const newOrder = createNewOrder();
      newOrder.id = Date.now() + i;
      newOrders.push(newOrder);
    }

    const updatedOrders = [...orders, ...newOrders];
    setOrders(updatedOrders);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const orderId = newOrders[i].id;
      
      setTimeout(() => {
        processImageForOrder(orderId, file);
      }, i * 300);
    }

    e.target.value = '';
  };

  const processImageForOrder = async (orderId: number, file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageData = e.target?.result as string;
      
      setOrders(prev => prev.map(o => 
        o.id === orderId 
          ? { ...o, image: file, imagePreview: imageData, isAnalyzing: true, error: null }
          : o
      ));

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

  const handleImageChange = async (orderId: number, file: File | null) => {
    if (!file) return;
    processImageForOrder(orderId, file);
  };

  const retryAnalysis = (orderId: number) => {
    const order = orders.find(o => o.id === orderId);
    if (order?.image) {
      processImageForOrder(orderId, order.image);
    }
  };

  const updateAutoField = (orderId: number, key: string, value: string) => {
    setOrders(prev => prev.map(o => 
      o.id === orderId 
        ? { ...o, autoData: { ...o.autoData, [key]: value } }
        : o
    ));
  };

  const updateManualText = (orderId: number, text: string) => {
    setOrders(prev => prev.map(o => 
      o.id === orderId ? { ...o, manualText: text } : o
    ));
  };

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

  const handleSubmit = async () => {
    if (!manager) {
      setResult({ type: 'error', message: '담당자를 선택해주세요.' });
      return;
    }

    if (orders.length === 0) {
      setResult({ type: 'error', message: '이미지를 업로드해주세요.' });
      return;
    }

    const notAnalyzed = orders.filter(o => !o.isAnalyzed);
    if (notAnalyzed.length > 0) {
      setResult({ type: 'error', message: '분석 중인 주문이 있습니다. 완료 후 제출해주세요.' });
      return;
    }

    // 직접입력 필수 항목 검증
    const notParsed = orders.filter(o => !o.manualParsed);
    if (notParsed.length > 0) {
      setResult({ type: 'error', message: '직접입력 항목을 입력하고 [적용] 버튼을 눌러주세요.' });
      return;
    }

    // 필수 항목 검증 (제품명, 아이디, 은행, 계좌, 예금주)
    const requiredFields = ['제품명', '아이디', '은행', '계좌', '예금주'];
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      const missingFields = requiredFields.filter(field => !order.manualData[field] || order.manualData[field].trim() === '');
      if (missingFields.length > 0) {
        setResult({ type: 'error', message: `#${i + 1} 주문: ${missingFields.join(', ')} 항목을 입력해주세요.` });
        return;
      }
    }

    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('manager', manager);

      const ordersData = orders.map(order => {
        const merged = { ...order.autoData };
        
        Object.entries(order.manualData).forEach(([key, value]) => {
          if (value && value.trim() !== '') {
            merged[key] = value;
          }
        });
        
        return ALL_FIELD_KEYS.map(key => merged[key] || '');
      });

      formData.append('orders', JSON.stringify(ordersData));

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
        setOrders([]);
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

      {/* AI 안내 공지 */}
      <div style={styles.noticeCard}>
        <div style={styles.noticeTitle}>🤖 AI 업데이트 공지</div>
        <ul style={styles.noticeList}>
          <li>이미지 업로드 하면, AI가 자동으로 데이터 작성해드립니다</li>
          <li>주문번호가 꼭 나오는 이미지로 업로드 부탁드립니다.</li>
          <li>이미지업로드 후, 아래에 구매아이디, 계좌정보 꼭 입력 부탁드립니다.</li>
          <li>아직 AI가 오류가 종종 있는 단계이니, 제출 전 정보 꼭 확인 부탁드립니다.</li>
        </ul>
      </div>

      {/* 메인 이미지 업로드 */}
      <div 
        style={styles.mainUploadZone}
        onClick={() => mainUploadRef.current?.click()}
      >
        <div style={styles.uploadIcon}>📷</div>
        <div style={styles.uploadText}>이미지 업로드 (여러장 선택 가능)</div>
        <div style={styles.uploadHint}>클릭하여 이미지 선택</div>
        {orders.length > 0 && (
          <div style={styles.uploadCount}>현재 {orders.length}건</div>
        )}
      </div>
      <input
        ref={mainUploadRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleMainUpload}
      />

      {/* 주문 목록 */}
      {orders.map((order, index) => (
        <div key={order.id} style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.orderInfo}>
              <span style={styles.orderNum}>#{index + 1}</span>
              {order.isAnalyzing && <span style={styles.analyzingBadge}>분석중...</span>}
              {order.isAnalyzed && <span style={styles.doneBadge}>✓</span>}
              {order.error && <span style={styles.errorBadge}>!</span>}
            </div>
            <button onClick={() => removeOrder(order.id)} style={styles.removeBtn}>✕</button>
          </div>

          {/* 이미지 미리보기 */}
          <div style={styles.imageRow}>
            {order.imagePreview && (
              <img src={order.imagePreview} alt="미리보기" style={styles.thumbImage} />
            )}
            <div style={styles.imageActions}>
              <button onClick={() => setModalImage(order.imagePreview)} style={styles.smallBtn}>
                🔍 크게보기
              </button>
              <button onClick={() => fileInputRefs.current[order.id]?.click()} style={styles.smallBtn}>
                📷 변경
              </button>
            </div>
            <input
              ref={(el) => { fileInputRefs.current[order.id] = el; }}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => handleImageChange(order.id, e.target.files?.[0] || null)}
            />
          </div>

          {order.error && (
            <div style={styles.errorBox}>
              ❌ {order.error}
              <button onClick={() => retryAnalysis(order.id)} style={styles.retryBtn}>다시 시도</button>
            </div>
          )}

          {/* 분석 결과 폼 */}
          {order.isAnalyzed && (
            <div style={styles.formSection}>
              <div style={styles.fieldGroupLabel}>🤖 자동 추출</div>
              <div style={styles.formGrid}>
                {AUTO_FIELDS.map(field => (
                  <div key={field} style={styles.formRow}>
                    <label style={styles.formLabel}>
                      {field}
                    </label>
                    <input
                      type="text"
                      value={order.autoData[field] || ''}
                      onChange={(e) => updateAutoField(order.id, field, e.target.value)}
                      style={styles.formInput}
                    />
                  </div>
                ))}
              </div>

              <div style={styles.manualCheckNotice}>
                ⚠️ 모든항목이 잘 들어갔는지 확인 꼭 해주세요.
              </div>

              <div style={styles.fieldGroupLabel}>✍️ 직접 입력</div>
              
              {!order.manualParsed ? (
                <>
                  <textarea
                    value={order.manualText}
                    onChange={(e) => updateManualText(order.id, e.target.value)}
                    style={styles.manualTextarea}
                  />
                  <button
                    onClick={() => parseManualWithAI(order.id)}
                    disabled={order.isParsingManual || !order.manualText.trim()}
                    style={{
                      ...styles.applyBtn,
                      opacity: (order.isParsingManual || !order.manualText.trim()) ? 0.5 : 1
                    }}
                  >
                    {order.isParsingManual ? '분석중...' : '✓ 적용'}
                  </button>
                </>
              ) : (
                <>
                  <div style={styles.parsedGrid}>
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
      {orders.length > 0 && (
        <div style={styles.confirmNotice}>
          ⚠️ 제출 전 확인! 주문번호(5↔S, 0↔O), 직접입력 항목
        </div>
      )}

      {/* 제출 버튼 */}
      {orders.length > 0 && (
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            ...styles.submitBtn,
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? '⏳ 저장 중...' : `📤 ${orders.length}건 제출하기`}
        </button>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  modalOverlay: {
    position: 'fixed' as const,
    top: 0, left: 0, right: 0, bottom: 0,
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
    cursor: 'pointer'
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
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  },
  title: {
    textAlign: 'center' as const,
    color: 'white',
    marginBottom: '8px',
    fontSize: '24px',
    fontWeight: '700'
  },
  subtitle: {
    textAlign: 'center' as const,
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
    cursor: 'pointer'
  },
  managerBtnActive: {
    borderColor: '#667eea',
    backgroundColor: '#667eea',
    color: 'white'
  },
  noticeCard: {
    backgroundColor: '#fef3c7',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '16px',
    border: '1px solid #fcd34d'
  },
  noticeTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#92400e',
    marginBottom: '10px'
  },
  noticeList: {
    margin: 0,
    paddingLeft: '18px',
    fontSize: '13px',
    color: '#78350f',
    lineHeight: '1.7'
  },
  mainUploadZone: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '30px 20px',
    marginBottom: '16px',
    textAlign: 'center' as const,
    cursor: 'pointer',
    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
    border: '2px dashed #667eea'
  },
  uploadIcon: {
    fontSize: '40px',
    marginBottom: '8px'
  },
  uploadText: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '4px'
  },
  uploadHint: {
    fontSize: '13px',
    color: '#999'
  },
  uploadCount: {
    marginTop: '12px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#667eea'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '12px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  orderInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  orderNum: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#667eea'
  },
  analyzingBadge: {
    fontSize: '11px',
    backgroundColor: '#fef3c7',
    color: '#d97706',
    padding: '2px 8px',
    borderRadius: '10px'
  },
  doneBadge: {
    fontSize: '12px',
    backgroundColor: '#d1fae5',
    color: '#059669',
    padding: '2px 8px',
    borderRadius: '10px'
  },
  errorBadge: {
    fontSize: '12px',
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    padding: '2px 8px',
    borderRadius: '10px'
  },
  removeBtn: {
    width: '24px',
    height: '24px',
    border: 'none',
    borderRadius: '50%',
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    fontSize: '14px',
    cursor: 'pointer'
  },
  imageRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px'
  },
  thumbImage: {
    width: '60px',
    height: '60px',
    objectFit: 'cover' as const,
    borderRadius: '8px'
  },
  imageActions: {
    display: 'flex',
    gap: '8px'
  },
  smallBtn: {
    padding: '6px 12px',
    backgroundColor: '#f3f4f6',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    cursor: 'pointer'
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    padding: '10px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  retryBtn: {
    padding: '4px 10px',
    backgroundColor: '#dc2626',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer'
  },
  formSection: {
    borderTop: '1px solid #eee',
    paddingTop: '12px'
  },
  fieldGroupLabel: {
    fontSize: '12px',
    color: '#888',
    marginBottom: '8px'
  },
  manualCheckNotice: {
    backgroundColor: '#fef3c7',
    borderRadius: '8px',
    padding: '10px',
    marginTop: '12px',
    marginBottom: '12px',
    fontSize: '13px',
    fontWeight: '600',
    color: '#92400e',
    textAlign: 'center' as const
  },
  formGrid: {
    display: 'grid',
    gap: '8px',
    marginBottom: '12px'
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '80px 1fr',
    alignItems: 'center',
    gap: '8px'
  },
  formLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#555',
    display: 'flex',
    alignItems: 'center',
    gap: '2px'
  },
  checkHint: {
    fontSize: '10px',
    color: '#f59e0b'
  },
  formInput: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #e0e0e0',
    borderRadius: '6px',
    fontSize: '13px',
    boxSizing: 'border-box' as const
  },
  warnInput: {
    borderColor: '#fcd34d',
    backgroundColor: '#fffbeb'
  },
  manualTextarea: {
    width: '100%',
    minHeight: '100px',
    padding: '10px',
    border: '1px solid #e0e0e0',
    borderRadius: '6px',
    fontSize: '13px',
    resize: 'vertical' as const,
    marginBottom: '8px',
    boxSizing: 'border-box' as const,
    lineHeight: '1.6'
  },
  applyBtn: {
    width: '100%',
    padding: '10px',
    backgroundColor: '#10b981',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  parsedGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '6px',
    marginBottom: '8px'
  },
  parsedItem: {
    backgroundColor: '#f0fdf4',
    padding: '6px 8px',
    borderRadius: '4px'
  },
  parsedLabel: {
    display: 'block',
    fontSize: '10px',
    color: '#666'
  },
  parsedValue: {
    display: 'block',
    fontSize: '12px',
    fontWeight: '600',
    color: '#333'
  },
  editBtn: {
    padding: '6px 12px',
    backgroundColor: '#6b7280',
    border: 'none',
    borderRadius: '4px',
    color: 'white',
    fontSize: '12px',
    cursor: 'pointer'
  },
  resultMessage: {
    padding: '12px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    textAlign: 'center' as const,
    marginBottom: '12px'
  },
  confirmNotice: {
    backgroundColor: '#fef3c7',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '12px',
    fontSize: '13px',
    fontWeight: '600',
    color: '#92400e',
    textAlign: 'center' as const
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
    cursor: 'pointer'
  }
};
