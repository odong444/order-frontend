import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '주문 정보 입력',
  description: '주문 정보 및 구매내역 제출',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <head>
        <link 
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body style={{ margin: 0, fontFamily: "'Noto Sans KR', sans-serif" }}>
        {children}
      </body>
    </html>
  )
}
