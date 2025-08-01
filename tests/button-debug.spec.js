// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('시작하기 버튼 디버깅', () => {
  test('홈페이지 DOM 구조 확인', async ({ page }) => {
    await page.goto('/');
    
    // 페이지 로드 대기
    await page.waitForLoadState('networkidle');
    
    // 전체 body 내용 확인
    const bodyContent = await page.locator('body').innerHTML();
    console.log('Body content length:', bodyContent.length);
    
    // 버튼 관련 요소들 확인
    const buttons = await page.locator('button').count();
    console.log('Total buttons found:', buttons);
    
    if (buttons > 0) {
      const buttonTexts = await page.locator('button').allTextContents();
      console.log('Button texts:', buttonTexts);
    }
    
    // "시작하기" 텍스트가 있는지 확인
    const startText = await page.locator('text=시작하기').count();
    console.log('Start text count:', startText);
    
    // showButton state 확인을 위해 잠시 대기
    console.log('Waiting 3 seconds for button to appear...');
    await page.waitForTimeout(3000);
    
    const buttonsAfterWait = await page.locator('button').count();
    console.log('Buttons after wait:', buttonsAfterWait);
    
    if (buttonsAfterWait > 0) {
      const buttonTextsAfter = await page.locator('button').allTextContents();
      console.log('Button texts after wait:', buttonTextsAfter);
    }
    
    // 스크린샷 촬영
    await page.screenshot({ path: 'screenshots/homepage-debug.png', fullPage: true });
    
    console.log('✅ 홈페이지 디버깅 완료');
  });

  test('JavaScript console 확인', async ({ page }) => {
    const logs = [];
    page.on('console', msg => {
      logs.push({ type: msg.type(), text: msg.text() });
    });
    
    await page.goto('/');
    await page.waitForTimeout(3000);
    
    console.log('=== Console Logs ===');
    logs.forEach(log => {
      console.log(`[${log.type}] ${log.text}`);
    });
    
    // React 상태 확인을 위한 스크립트 실행
    const showButtonState = await page.evaluate(() => {
      // React DevTools가 있다면 상태 확인
      return {
        hasReact: typeof window.React !== 'undefined',
        timestamp: Date.now()
      };
    });
    
    console.log('React state info:', showButtonState);
  });
});