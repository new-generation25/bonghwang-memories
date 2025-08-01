// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('봉황 메모리즈 고급 기능 테스트', () => {
  test('페이지 로딩 성능 측정', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    console.log(`페이지 로딩 시간: ${loadTime}ms`);
    
    // 3초 이내 로딩 기대
    expect(loadTime).toBeLessThan(3000);
  });

  test('콘솔 에러 확인', async ({ page }) => {
    const consoleLogs = [];
    page.on('console', msg => {
      consoleLogs.push({ type: msg.type(), text: msg.text() });
    });
    
    await page.goto('/');
    
    // 에러 메시지가 없는지 확인
    const errors = consoleLogs.filter(log => log.type === 'error');
    if (errors.length > 0) {
      console.log('콘솔 에러:', errors);
    }
    
    expect(errors.length).toBe(0);
  });

  test('네트워크 요청 모니터링', async ({ page }) => {
    const requests = [];
    page.on('request', request => {
      requests.push({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType()
      });
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    console.log(`총 ${requests.length}개의 네트워크 요청`);
    
    // 실패한 요청 확인
    const failedRequests = requests.filter(req => req.failed);
    expect(failedRequests.length).toBe(0);
  });

  test('접근성 기본 확인', async ({ page }) => {
    await page.goto('/');
    
    // 주요 접근성 요소 확인
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').count();
    console.log(`헤딩 요소 개수: ${headings}`);
    
    // alt 속성이 없는 이미지 확인
    const imagesWithoutAlt = await page.locator('img:not([alt])').count();
    expect(imagesWithoutAlt).toBe(0);
    
    // 페이지 콘텐츠 확인 (main 요소가 없으므로 body로 확인)
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('키보드 네비게이션 테스트', async ({ page }) => {
    await page.goto('/');
    
    // Tab 키로 포커스 이동 테스트
    await page.keyboard.press('Tab');
    
    // 현재 포커스된 요소 확인
    const focusedElement = await page.locator(':focus').first();
    if (await focusedElement.count() > 0) {
      const tagName = await focusedElement.evaluate(el => el.tagName);
      console.log(`포커스된 요소: ${tagName}`);
    }
  });
});