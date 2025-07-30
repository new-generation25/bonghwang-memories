# 네이버 지도 API 인증 실패 문제 해결 가이드

## 🔍 문제 상황

현재 네이버 지도 API에서 인증 실패가 발생하고 있습니다:
```
23-9a36b6f83cfae84c.js:1 네이버 지도 API 인증 실패
```

## 🛠️ 해결 방안

### 1. 네이버 클라우드 플랫폼 설정 확인

#### 1.1 API 키 확인
- **현재 API 키**: `o8bhr6higo`
- **설정 위치**: Vercel 환경 변수 `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID`

#### 1.2 도메인 등록 확인
현재 프로덕션 도메인을 네이버 클라우드 플랫폼에 등록해야 합니다:

**등록해야 할 도메인:**
```
https://bonghwang-memories-k84k6dpza-new-generation25s-projects.vercel.app
```

#### 1.3 네이버 클라우드 플랫폼 설정 단계

1. **네이버 클라우드 플랫폼 콘솔** 접속
   - https://console.ncloud.com/

2. **Maps API 서비스** 선택
   - 서비스 > AI·NAVER API > Maps

3. **애플리케이션 관리** 클릭
   - 현재 등록된 애플리케이션 선택

4. **웹 서비스 URL 등록**
   - **등록할 URL**: `https://bonghwang-memories-k84k6dpza-new-generation25s-projects.vercel.app`
   - **서비스 환경**: Dynamic Map, Geocoding, Reverse Geocoding

5. **변경사항 저장**

### 2. 안드로이드 HTTP 통신 문제

#### 2.1 문제 설명
안드로이드 9 이상에서는 HTTP 평문 통신이 기본적으로 차단됩니다.

#### 2.2 해결 방법
현재 코드에서 HTTPS를 강제로 사용하도록 설정되어 있습니다:
```javascript
src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=..."
```

### 3. Manifest 401 오류

#### 3.1 문제 설명
```
manifest.json:1 GET https://.../manifest.json 401 (Unauthorized)
```

#### 3.2 해결 방법
이는 Vercel 설정 문제로, 앱 기능에는 영향을 주지 않습니다. 무시해도 됩니다.

## 📱 테스트 방법

### 1. PC에서 테스트
- 브라우저 개발자 도구 > Console 탭에서 오류 메시지 확인
- 네이버 지도가 모의 지도로 표시되는지 확인

### 2. 모바일에서 테스트
- 실제 네이버 지도가 표시되는지 확인
- 위치 권한 요청이 정상적으로 작동하는지 확인

## 🔧 추가 디버깅

### 1. 콘솔 로그 확인
브라우저 개발자 도구에서 다음 로그를 확인하세요:
```
현재 도메인: [도메인명]
네이버 지도 API 키: [API키]
네이버 지도 API 로딩 완료
네이버 지도 초기화 완료
```

### 2. 네트워크 탭 확인
- 네이버 지도 API 요청이 성공적으로 완료되는지 확인
- 401, 403 오류가 없는지 확인

## 📞 지원

문제가 지속되면 다음 정보를 제공해주세요:
1. 브라우저 콘솔의 전체 오류 메시지
2. 현재 접속한 도메인 URL
3. 사용 중인 기기 정보 (PC/모바일, 브라우저 종류)