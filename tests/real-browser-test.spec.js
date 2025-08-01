// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('실제 브라우저 사용자 설정 테스트', () => {
  test('실제 브라우저로 사용자 설정 플로우 확인', async ({ page }) => {
    // 모든 콘솔 로그와 에러 수집
    const logs = [];
    const errors = [];
    
    page.on('console', msg => {
      logs.push({ type: msg.type(), text: msg.text(), location: msg.location() });
    });
    
    page.on('pageerror', error => {
      errors.push(error.message);
    });
    
    // 홈페이지로 이동
    await page.goto('/');
    
    // JavaScript 로딩 대기
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('networkidle');
    
    console.log('=== 페이지 로딩 완료 ===');
    
    // 에러 확인
    if (errors.length > 0) {
      console.log('❌ JavaScript 에러 발견:');
      errors.forEach(error => console.log(`- ${error}`));
    } else {
      console.log('✅ JavaScript 에러 없음');
    }
    
    // 콘솔 로그 확인
    console.log('=== 콘솔 로그 ===');
    logs.forEach(log => {
      if (log.type === 'error') {
        console.log(`❌ [${log.type}] ${log.text}`);
      } else if (log.type === 'warning') {
        console.log(`⚠️ [${log.type}] ${log.text}`);
      } else {
        console.log(`ℹ️ [${log.type}] ${log.text}`);
      }
    });
    
    // DOM 상태 확인
    const pageContent = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      const images = document.querySelectorAll('img');
      const scripts = document.querySelectorAll('script');
      
      return {
        buttonsCount: buttons.length,
        imagesCount: images.length,
        scriptsCount: scripts.length,
        hasReact: typeof window.React !== 'undefined',
        hasNext: typeof window.__NEXT_DATA__ !== 'undefined',
        bodyClasses: document.body.className,
        title: document.title
      };
    });
    
    console.log('=== DOM 상태 ===');
    console.log(`버튼 개수: ${pageContent.buttonsCount}`);
    console.log(`이미지 개수: ${pageContent.imagesCount}`);
    console.log(`스크립트 개수: ${pageContent.scriptsCount}`);
    console.log(`React 로딩: ${pageContent.hasReact}`);
    console.log(`Next.js 데이터: ${pageContent.hasNext}`);
    console.log(`페이지 제목: ${pageContent.title}`);
    
    // 3초 대기 후 다시 확인 (useState 효과 확인)
    console.log('=== 3초 대기 후 상태 ===');
    await page.waitForTimeout(3000);
    
    const pageContentAfter = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      const buttonTexts = Array.from(buttons).map(btn => btn.textContent);
      
      return {
        buttonsCount: buttons.length,
        buttonTexts: buttonTexts,
        timestamp: Date.now()
      };
    });
    
    console.log(`대기 후 버튼 개수: ${pageContentAfter.buttonsCount}`);
    console.log(`버튼 텍스트들: ${JSON.stringify(pageContentAfter.buttonTexts)}`);
    
    // 스크린샷 촬영
    await page.screenshot({ 
      path: 'screenshots/real-browser-test.png', 
      fullPage: true 
    });
    
    // localStorage 상태 확인
    const localStorageData = await page.evaluate(() => {
      return {
        userId: localStorage.getItem('userId'),
        userGender: localStorage.getItem('userGender'),
        keys: Object.keys(localStorage)
      };
    });
    
    console.log('=== localStorage 상태 ===');
    console.log(`userId: ${localStorageData.userId}`);
    console.log(`userGender: ${localStorageData.userGender}`);
    console.log(`전체 키들: ${JSON.stringify(localStorageData.keys)}`);
    
    console.log('✅ 실제 브라우저 테스트 완료');
  });
});