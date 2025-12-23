# 주문 정보 수집 시스템

주문 정보 + 구매내역 이미지를 받아 Google Drive & Sheets에 저장하는 시스템

## 구조

```
프론트엔드 (Vercel) ─→ 백엔드 (Railway) ─→ Google Drive / Sheets
```

---

## 1단계: GitHub 저장소 생성

1. GitHub에서 저장소 2개 생성:
   - `order-backend`
   - `order-frontend`

2. 각 폴더를 해당 저장소에 업로드

---

## 2단계: Railway 배포 (백엔드)

### 2-1. Railway 프로젝트 생성
1. [railway.app](https://railway.app) 접속 → GitHub 연결
2. **New Project** → **Deploy from GitHub repo**
3. `order-backend` 저장소 선택

### 2-2. 환경변수 설정
Railway 대시보드 → Variables 탭에서 추가:

```
GOOGLE_CLIENT_ID=1076100224638-4ionnc68pd3pdkc8mfoc4j5na1o00s57.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
REDIRECT_URI=https://[railway-url]/auth/callback
DRIVE_FOLDER_ID=[구글드라이브 폴더 ID]
SPREADSHEET_ID=[구글스프레드시트 ID]
FRONTEND_URL=https://[vercel-url]
```

### 2-3. 도메인 생성
1. 서비스 클릭 → Settings 탭
2. Public Networking → Generate Domain

### 2-4. Google Cloud Console 설정
1. [console.cloud.google.com](https://console.cloud.google.com) 접속
2. 기존 프로젝트 선택 (리뷰 시스템용)
3. API 및 서비스 → 사용자 인증 정보
4. OAuth 2.0 클라이언트 ID 클릭
5. 승인된 리디렉션 URI에 추가:
   ```
   https://[railway-url]/auth/callback
   ```

### 2-5. Google 인증 (토큰 발급)
1. 브라우저에서 접속: `https://[railway-url]/auth`
2. Google 로그인 → 권한 허용
3. 화면에 나온 GOOGLE_REFRESH_TOKEN을 Railway 환경변수에 추가

---

## 3단계: Vercel 배포 (프론트엔드)

### 3-1. Vercel 프로젝트 생성
1. [vercel.com](https://vercel.com) 접속
2. **Add New** → **Project**
3. `order-frontend` 저장소 선택

### 3-2. 환경변수 설정
```
NEXT_PUBLIC_API_URL=https://[railway-url]
```

### 3-3. 배포
Deploy 클릭 → 완료!

---

## 4단계: 최종 테스트

1. 브라우저에서 접속: `https://[vercel-url]/order`
2. 주문 정보 입력 + 이미지 첨부
3. 제출 → Google Sheets 확인

---

## ID 찾는 방법

### Google Drive 폴더 ID
URL: `https://drive.google.com/drive/folders/[여기가 ID]`

### Google Sheets ID
URL: `https://docs.google.com/spreadsheets/d/[여기가 ID]/edit`

---

## 기능

- ✅ 다중 주문 동시 제출
- ✅ 구매내역 이미지 업로드 (Google Drive 저장)
- ✅ 자동 공유 링크 생성
- ✅ 동적 필드 지원 (새 필드 자동 인식)
- ✅ 빠른 입력 (텍스트 복사/붙여넣기)
