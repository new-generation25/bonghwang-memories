// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('오류 수정 검증 테스트', () => {
  test('콘솔 에러가 경고로 변경되었는지 확인', async ({ page }) => {
    const consoleLogs = [];
    
    page.on('console', msg => {
      consoleLogs.push({ 
        type: msg.type(), 
        text: msg.text(),
        location: msg.location()
      });
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // 에러 메시지들을 분류
    const errors = consoleLogs.filter(log => log.type === 'error');
    const warnings = consoleLogs.filter(log => log.type === 'warning');
    const infos = consoleLogs.filter(log => log.type === 'info');
    
    console.log('=== 콘솔 로그 분석 ===');
    console.log(`에러: ${errors.length}개`);
    console.log(`경고: ${warnings.length}개`);
    console.log(`정보: ${infos.length}개`);
    
    if (errors.length > 0) {
      console.log('남은 에러들:');
      errors.forEach(error => console.log(`- ${error.text}`));
    }
    
    if (warnings.length > 0) {
      console.log('경고 메시지들:');
      warnings.forEach(warning => console.log(`- ${warning.text}`));
    }
    
    // 네이버 지도 관련 에러가 경고로 변경되었는지 확인
    const naverMapErrors = errors.filter(log => 
      log.text.includes('네이버 지도') || 
      log.text.includes('navermap')
    );
    
    expect(naverMapErrors.length).toBe(0);
    
    // Service Worker 관련 에러가 경고로 변경되었는지 확인
    const swErrors = errors.filter(log => 
      log.text.includes('Service Worker') ||
      log.text.includes('sw.js')
    );
    
    expect(swErrors.length).toBe(0);
  });

  test('페이지가 정상적으로 렌더링되는지 확인', async ({ page }) => {
    await page.goto('/');
    
    // 페이지 제목 확인
    await expect(page).toHaveTitle(/봉황 메모리즈/);
    
    // body 요소가 보이는지 확인
    const body = page.locator('body');
    await expect(body).toBeVisible();
    
    // 백그라운드 이미지가 로드되는지 확인
    const heroImage = page.locator('img[alt*="봉황 메모리즈"]');
    if (await heroImage.count() > 0) {
      await expect(heroImage).toBeVisible();
    }
    
    console.log('✅ 페이지가 정상적으로 렌더링되었습니다.');
  });

  test('네트워크 요청 성공률 확인', async ({ page }) => {
    const failedRequests = [];
    
    page.on('requestfailed', request => {
      failedRequests.push({
        url: request.url(),
        method: request.method(),
        failure: request.failure()
      });
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    console.log(`실패한 요청: ${failedRequests.length}개`);
    
    if (failedRequests.length > 0) {
      console.log('실패한 요청들:');
      failedRequests.forEach(req => 
        console.log(`- ${req.method} ${req.url}: ${req.failure?.errorText}`)
      );
    }
    
    // 개발 환경에서는 일부 요청 실패가 예상됨 (네이버 지도 API 등)
    const criticalFailures = failedRequests.filter(req => 
      !req.url.includes('naver.com') && 
      !req.url.includes('sw.js')
    );
    
    expect(criticalFailures.length).toBe(0);
  });
});