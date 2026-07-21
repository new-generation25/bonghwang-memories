# 네이버 지도 설정 및 문제 해결 가이드

## 설정 정보

| 항목 | 값 |
|---|---|
| 클라이언트 ID | `o8bhr6higo` |
| 환경 변수명 | `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID` |
| 설정 위치 | Vercel 환경 변수 · 로컬 `.env.local` |

> 네이버 지도 클라이언트 ID는 브라우저 번들에 그대로 실려 나가는 **공개 식별자**입니다.
> 실제 보호는 아래의 서비스 URL 등록(도메인 화이트리스트)이 담당합니다.

## 등록해야 할 서비스 URL

네이버 클라우드 플랫폼에 등록되지 않은 도메인에서 호출하면 `navermap_authFailure`가 발생합니다.
현재 등록이 필요한 URL:

```
https://bonghwang-memories.vercel.app
http://localhost:3000
```

> ⚠️ 배포별로 생성되는 임시 주소(`...-k84k6dpza-....vercel.app` 형태)는 배포할 때마다 바뀌고
> 곧 만료됩니다. 등록 대상은 **고정 도메인**이어야 합니다.

### 등록 절차

1. [네이버 클라우드 플랫폼 콘솔](https://console.ncloud.com/) 접속
2. **Services → AI·NAVER API → Application**
3. 해당 애플리케이션 선택 후 **수정**
4. **Web 서비스 URL**에 위 두 주소를 추가
5. 서비스 환경에 **Dynamic Map**, **Geocoding**, **Reverse Geocoding** 체크
6. 저장 (반영까지 몇 분 걸릴 수 있음)

## 로컬 개발 환경 설정

`.env.local`은 `.gitignore` 대상이라 저장소를 클론해도 딸려오지 않습니다.
**새로 클론했다면 직접 만들어야 지도가 뜹니다.**

프로젝트 루트에 `.env.local` 생성:

```
NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=o8bhr6higo
```

`.env.local.example`을 복사해 쓰면 Firebase 변수까지 한 번에 채울 수 있습니다.
환경 변수는 **서버 시작 시점에 읽히므로 반드시 dev 서버를 재시작**해야 반영됩니다.

```
npm run dev
```

## 증상별 진단

### 지도 자리에 "지도 서비스 연결 중"만 표시된다

클라이언트 ID가 비어 있는 경우입니다. `src/app/layout.tsx`의 가드가
키가 없으면 스크립트를 아예 삽입하지 않습니다.

브라우저 콘솔에서 확인:

```js
window.naverMapLoadError   // true → 키 없음 또는 로드 실패
document.querySelectorAll('script[src*="naver"]').length   // 0 → 스크립트 미삽입
```

→ `.env.local`에 키를 넣고 dev 서버 재시작.

### 콘솔에 "네이버 지도 API 인증 실패"가 뜬다

키는 있지만 **현재 도메인이 서비스 URL에 등록되지 않은** 경우입니다.
위의 '등록해야 할 서비스 URL' 절차를 확인하세요.

### 정상 동작 시 콘솔 로그

```
네이버 지도 API 로딩 완료
```

```js
window.naverMapLoaded      // true
typeof window.naver.maps   // 'object'
```

### 지도 컨트롤(저작권·위성 버튼)이 두 벌 보인다

개발 모드 전용 현상입니다. React StrictMode가 effect를 두 번 실행하는데
`Map.tsx`에 재초기화 방지 가드가 없어 지도 인스턴스가 두 개 생성됩니다.
프로덕션 빌드에서는 effect가 한 번만 실행되므로 발생하지 않습니다.

### manifest.json 401 오류

Vercel 배포 설정에서 비롯된 것으로 앱 기능에는 영향이 없습니다.

## CSP 설정

네이버 지도는 여러 도메인에서 리소스를 가져오므로 CSP에 모두 허용돼 있어야 합니다.
관련 설정 위치는 두 곳이며, **둘 다** 네이버 도메인을 포함해야 합니다.

- `next.config.js` — 응답 헤더의 `Content-Security-Policy`
- `src/app/layout.tsx` — `metadata.other`의 `Content-Security-Policy`

허용 대상: `*.naver.com`, `*.naver.net`, `*.pstatic.net` (http · https 양쪽)

## 서비스 워커 캐시 주의

프로덕션에서 CSP나 페이지를 수정했는데 반영되지 않으면 서비스 워커가
옛 응답을 캐시하고 있을 수 있습니다. localhost에서는 `layout.tsx`가
서비스 워커 등록을 건너뛰고 기존 캐시를 정리하도록 되어 있습니다.

배포 환경에서 강제로 지우려면 개발자 도구 → Application → Service Workers → Unregister,
Storage → Clear site data.
