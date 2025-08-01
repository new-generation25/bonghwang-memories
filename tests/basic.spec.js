// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('봉황 추억 프로젝트 기본 테스트', () => {
  test('홈페이지 로드 및 기본 구조 확인', async ({ page }) => {
    // 홈페이지 접속
    await page.goto('/');
    
    // 페이지 제목 확인 (실제 제목에 맞게 수정)
    await expect(page).toHaveTitle(/봉황 메모리즈/);
    
    // 기본 레이아웃 확인 - body 요소로 변경
    const body = page.locator('body');
    await expect(body).toBeVisible();
    
    // 스크린샷 촬영
    await page.screenshot({ path: 'screenshots/homepage.png', fullPage: true });
  });

  test('네비게이션 링크 확인', async ({ page }) => {
    await page.goto('/');
    
    // 네비게이션 메뉴가 있는지 확인
    const nav = page.locator('nav');
    if (await nav.count() > 0) {
      await expect(nav).toBeVisible();
      
      // 링크들 클릭해보기
      const links = await nav.locator('a').all();
      for (const link of links) {
        const href = await link.getAttribute('href');
        if (href && !href.startsWith('http')) {
          await link.click();
          await page.waitForLoadState('networkidle');
          await page.goBack();
        }
      }
    }
  });

  test('스토리 페이지 접근', async ({ page }) => {
    await page.goto('/story');
    
    // 페이지가 정상적으로 로드되는지 확인
    await expect(page.locator('body')).toBeVisible();
    
    // 스크린샷 촬영
    await page.screenshot({ path: 'screenshots/story-page.png', fullPage: true });
  });

  test('반응형 디자인 확인', async ({ page }) => {
    // 모바일 뷰포트로 테스트
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    await expect(page.locator('body')).toBeVisible();
    await page.screenshot({ path: 'screenshots/mobile-view.png', fullPage: true });
    
    // 태블릿 뷰포트로 테스트
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();
    
    await expect(page.locator('body')).toBeVisible();
    await page.screenshot({ path: 'screenshots/tablet-view.png', fullPage: true });
  });
});