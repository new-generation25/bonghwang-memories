# 봉황동 메모리즈: 아버지의 유산을 찾아서

봉황동의 역사와 문화를 스토리텔링과 게임형 미션을 통해 체험하는 인터랙티브 투어 앱입니다.

## 🎯 프로젝트 개요

- **앱 이름**: 봉황동 메모리즈: 아버지의 유산을 찾아서
- **플랫폼**: 모바일 웹 기반 애플리케이션 (PWA)
- **타겟**: 가족 단위 관광객, 20-30대 방문객
- **핵심 경험**: 스토리텔링, 미션 해결, 가족 추억 생성

## 🛠 기술 스택

- **Frontend**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Firebase (Firestore, Auth, Storage)
- **Deployment**: Vercel

## 📱 주요 기능

### 1. 인트로 & 스토리
- 감성적인 시작 화면
- 아버지의 편지로 시작하는 스토리텔링
- 위치/카메라 권한 요청

### 2. 탐험 페이지 (메인)
- 인터랙티브 지도 (커스텀 빈티지 스타일)
- 5개 메인 미션 위치 표시
- 사용자 현재 위치 트래킹
- 미션 진행률 표시

### 3. 미션 시스템
- **사진 촬영**: 특정 장소/물건 촬영
- **퀴즈**: 역사/문화 관련 문제
- **GPS 인증**: 특정 위치 방문 확인
- **QR 스캔**: 숨겨진 QR 코드 찾기
- **AR 체험**: 증강현실 콘텐츠

### 4. 보물 페이지
- 5×5 빙고판 형태의 서브 미션
- 메인 미션 완료 후 해금
- 빙고 달성 시 보너스 점수

### 5. 커뮤니티
- 방명록 (폴라로이드 사진 형태)
- 랭킹 시스템
- 좋아요 및 댓글 기능

## 🚀 시작하기

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 변수 설정
`.env.local.example`을 참고하여 `.env.local` 파일을 생성하고 Firebase 설정을 입력하세요.

### 3. 개발 서버 실행
```bash
npm run dev
```

### 4. 빌드
```bash
npm run build
```

## 📂 프로젝트 구조

```
src/
├── app/                    # Next.js App Router
│   ├── globals.css        # 전역 스타일
│   ├── layout.tsx         # 루트 레이아웃
│   ├── page.tsx          # 인트로 페이지
│   ├── story/            # 스토리 페이지
│   ├── exploration/      # 탐험 페이지
│   ├── treasure/         # 보물 페이지
│   ├── community/        # 커뮤니티 페이지
│   └── mission/          # 미션 수행 페이지
├── components/            # 재사용 컴포넌트
│   ├── Map.tsx           # 지도 컴포넌트
│   ├── MissionModal.tsx  # 미션 상세 모달
│   └── Navigation.tsx    # 하단 네비게이션
├── lib/                  # 유틸리티 및 설정
│   ├── firebase.ts       # Firebase 설정
│   ├── types.ts         # TypeScript 타입 정의
│   └── missions.ts      # 미션 데이터
└── public/              # 정적 파일
```

## 🎨 디자인 시스템

### 컬러 팔레트
- **Sepia 톤**: 따뜻한 브라운 계열 (#F7F3E9 ~ #543F2C)
- **Vintage**: 빈티지 브라운 (#8B4513), 골드 (#DAA520)
- **크림**: 부드러운 크림색 (#F5F5DC)

### 폰트
- **기본**: Nanum Pen Script (손글씨체)
- **제목**: Playfair Display (빈티지 세리프)

### UI 컴포넌트
- 빈티지 버튼 (그라데이션 + 그림자)
- 폴라로이드 사진 효과
- 나침반 아이콘 (미션 마커)
- 양피지 텍스처 배경

## 📊 점수 시스템

| 항목 | 점수 |
|------|------|
| 메인 미션 완료 | 100점 |
| 서브 미션 완료 | 30점 |
| 올클리어 보너스 | 500점 |
| 빙고 달성 | 50점/줄 |
| 방명록 작성 | 10점 |
| 좋아요 획득 | 1점 |

## 🗺 미션 위치 (김해시 봉황동)

1. **첫 번째 기억**: 옛 미하사 목욕탕 자리 카페
2. **두 번째 기억**: 봉황 1935 앞 우물터
3. **세 번째 기억**: 김해 음악 라이브러리
4. **네 번째 기억**: 회현동 벽화마을 포토존
5. **마지막 기억**: 봉황대 공원 정상

## 🔧 주요 라이브러리

- **지도**: 커스텀 SVG 기반 (향후 Naver Maps API 연동 가능)
- **QR 스캔**: jsqr
- **성공 연출**: react-confetti
- **상태 관리**: React Hooks + localStorage
- **데이터베이스**: Firebase Firestore

## 📱 PWA 기능

- 오프라인 지원
- 홈 화면 추가 가능
- 푸시 알림 (향후 추가)
- 위치 기반 서비스

## 🚀 배포

Vercel을 통한 자동 배포 설정:
1. GitHub 리포지토리 연결
2. 환경 변수 설정
3. 자동 빌드 및 배포

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 있습니다.

## 👥 기여

프로젝트에 기여하고 싶으시다면:
1. Fork this repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

---

**Made with ❤️ for 봉황동 community**