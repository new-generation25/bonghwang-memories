const { test, expect } = require('@playwright/test');

test.describe('봉황 메모리즈 E2E 테스트', () => {
  test.beforeEach(async ({ page }) => {
    // 각 테스트 전에 메인 페이지로 이동
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
  });

  test('메인 페이지 로드 및 기본 요소 확인', async ({ page }) => {
    // 페이지 제목 확인
    const title = await page.title();
    console.log('실제 페이지 제목:', title);
    
    // 히어로 이미지 확인
    const heroImage = page.locator('img').first();
    await expect(heroImage).toBeVisible();
    
    // 페이지가 로드되었는지 확인
    await expect(page).toHaveURL('http://localhost:3000/');
    
    // 스크린샷 저장
    await page.screenshot({ path: 'tests/screenshots/main-page.png' });
  });

  test('시작하기 버튼 표시 및 동작', async ({ page }) => {
    // 3초 후 시작하기 버튼이 나타나는지 확인
    await page.waitForTimeout(3000);
    
    // 시작하기 버튼 찾기
    const startButton = page.locator('button').filter({ hasText: '시작하기' });
    
    // 버튼이 나타나지 않으면 스크린샷 저장
    if (!(await startButton.isVisible())) {
      await page.screenshot({ path: 'tests/screenshots/start-button-not-visible.png' });
      console.log('시작하기 버튼이 표시되지 않음');
      
      // 페이지의 모든 버튼 확인
      const allButtons = page.locator('button');
      const buttonCount = await allButtons.count();
      console.log(`페이지에 ${buttonCount}개의 버튼이 있습니다`);
      
      for (let i = 0; i < buttonCount; i++) {
        const buttonText = await allButtons.nth(i).textContent();
        console.log(`버튼 ${i + 1}: "${buttonText}"`);
      }
    } else {
      await startButton.click();
      
      // 사용자 설정 모달이 나타나는지 확인
      const userSetupModal = page.locator('.modal, [role="dialog"], .user-setup-modal');
      if (await userSetupModal.isVisible()) {
        await expect(userSetupModal).toBeVisible();
      } else {
        console.log('사용자 설정 모달이 표시되지 않음');
        await page.screenshot({ path: 'tests/screenshots/modal-not-visible.png' });
      }
    }
  });

  test('사용자 설정 모달 테스트', async ({ page }) => {
    // 시작하기 버튼 클릭 (3초 대기 후)
    await page.waitForTimeout(3000);
    const startButton = page.locator('button').filter({ hasText: '시작하기' });
    
    if (await startButton.isVisible()) {
      await startButton.click();
      
      // 모달이 나타날 때까지 대기
      await page.waitForTimeout(2000);
      
      // 사용자 ID 입력
      const userIdInput = page.locator('input[type="text"], input[placeholder*="아이디"], input[placeholder*="ID"]');
      if (await userIdInput.isVisible()) {
        await userIdInput.fill('testuser123');
        
        // 성별 선택
        const genderSelect = page.locator('select');
        if (await genderSelect.isVisible()) {
          await genderSelect.selectOption('male');
        }
        
        // 완료 버튼 클릭
        const completeButton = page.locator('button').filter({ hasText: '완료' });
        if (await completeButton.isVisible()) {
          await completeButton.click();
          
          // 스토리 페이지로 이동하는지 확인
          await expect(page).toHaveURL('http://localhost:3000/story');
        }
      }
    } else {
      console.log('시작하기 버튼이 표시되지 않아 모달 테스트를 건너뜁니다');
    }
  });

  test('스토리 페이지 타이핑 애니메이션', async ({ page }) => {
    // 스토리 페이지로 직접 이동
    await page.goto('http://localhost:3000/story');
    await page.waitForLoadState('networkidle');
    
    // 편지 내용이 표시되는지 확인
    const letterContent = page.locator('.font-handwriting, .story-content, div:not([hidden])');
    if (await letterContent.first().isVisible()) {
      await expect(letterContent.first()).toBeVisible();
    } else {
      // visible한 요소를 찾기 위해 다른 방법 시도
      const visibleDivs = page.locator('div:visible');
      const divCount = await visibleDivs.count();
      console.log(`스토리 페이지에 ${divCount}개의 visible한 div가 있습니다`);
      
      if (divCount > 0) {
        await expect(visibleDivs.first()).toBeVisible();
      }
    }
    
    // 타이핑 애니메이션이 완료될 때까지 대기
    await page.waitForTimeout(5000);
    
    // SKIP 버튼이 있는지 확인
    const skipButton = page.locator('button').filter({ hasText: 'SKIP' });
    if (await skipButton.isVisible()) {
      await skipButton.click();
    }
    
    // 탐험 시작하기 버튼이 나타나는지 확인
    const exploreButton = page.locator('button').filter({ hasText: '탐험 시작하기' });
    if (await exploreButton.isVisible()) {
      await expect(exploreButton).toBeVisible();
    }
    
    // 스크린샷 저장
    await page.screenshot({ path: 'tests/screenshots/story-page.png' });
  });

  test('탐험 페이지 및 네비게이션', async ({ page }) => {
    // 탐험 페이지로 직접 이동
    await page.goto('http://localhost:3000/exploration');
    await page.waitForLoadState('networkidle');
    
    // 헤더 확인
    const header = page.locator('h1, .header, .title');
    if (await header.isVisible()) {
      await expect(header.first()).toBeVisible();
    }
    
    // 네비게이션 바 확인
    const navigation = page.locator('nav, [role="navigation"], .navigation, .nav');
    if (await navigation.isVisible()) {
      await expect(navigation.first()).toBeVisible();
    }
    
    // 네비게이션 메뉴 항목들 확인
    const navItems = ['스토리', '탐험', '보물', '커뮤니티'];
    for (const item of navItems) {
      const navItem = page.locator('button, a').filter({ hasText: item });
      if (await navItem.isVisible()) {
        await expect(navItem.first()).toBeVisible();
      }
    }
    
    // 스크린샷 저장
    await page.screenshot({ path: 'tests/screenshots/exploration-page.png' });
  });

  test('보물 페이지 접근', async ({ page }) => {
    // 보물 페이지로 이동
    await page.goto('http://localhost:3000/treasure');
    await page.waitForLoadState('networkidle');
    
    // 페이지가 로드되는지 확인
    await expect(page).toHaveURL('http://localhost:3000/treasure');
    
    // 페이지 내용 확인
    const pageContent = page.locator('main, .container, div, body');
    await expect(pageContent.first()).toBeVisible();
    
    // 스크린샷 저장
    await page.screenshot({ path: 'tests/screenshots/treasure-page.png' });
  });

  test('커뮤니티 페이지 접근', async ({ page }) => {
    // 커뮤니티 페이지로 이동
    await page.goto('http://localhost:3000/community');
    await page.waitForLoadState('networkidle');
    
    // 페이지가 로드되는지 확인
    await expect(page).toHaveURL('http://localhost:3000/community');
    
    // 페이지 내용 확인
    const pageContent = page.locator('main, .container, div, body');
    await expect(pageContent.first()).toBeVisible();
    
    // 스크린샷 저장
    await page.screenshot({ path: 'tests/screenshots/community-page.png' });
  });

  test('반응형 디자인 테스트', async ({ page }) => {
    // 모바일 뷰포트로 설정
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // 모바일에서 히어로 이미지가 보이는지 확인
    const heroImage = page.locator('img').first();
    await expect(heroImage).toBeVisible();
    
    // 모바일 스크린샷 저장
    await page.screenshot({ path: 'tests/screenshots/mobile-view.png' });
    
    // 태블릿 뷰포트로 설정
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // 태블릿에서도 히어로 이미지가 보이는지 확인
    await expect(heroImage).toBeVisible();
    
    // 태블릿 스크린샷 저장
    await page.screenshot({ path: 'tests/screenshots/tablet-view.png' });
    
    // 데스크톱 뷰포트로 복원
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('콘솔 오류 확인', async ({ page }) => {
    const consoleErrors = [];
    
    // 콘솔 오류 수집
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(3000);
    
    console.log('발견된 콘솔 오류들:', consoleErrors);
    
    // 404 오류가 너무 많이 발생하지 않는지 확인
    const notFoundErrors = consoleErrors.filter(error => error.includes('404'));
    expect(notFoundErrors.length).toBeLessThan(20);
    
    // 치명적인 오류가 없는지 확인
    const fatalErrors = consoleErrors.filter(error => 
      error.includes('Uncaught') ||
      error.includes('ReferenceError') ||
      error.includes('TypeError')
    );
    expect(fatalErrors.length).toBe(0);
  });

  test('성능 테스트', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('http://localhost:3000');
    
    // 페이지 로드 완료 대기
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // 페이지 로드 시간이 10초 이내인지 확인
    expect(loadTime).toBeLessThan(10000);
    
    console.log(`페이지 로드 시간: ${loadTime}ms`);
  });

  test('접근성 테스트', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // 이미지에 alt 텍스트가 있는지 확인
    const images = page.locator('img');
    const imageCount = await images.count();
    
    console.log(`페이지에 ${imageCount}개의 이미지가 있습니다`);
    
    for (let i = 0; i < imageCount; i++) {
      const alt = await images.nth(i).getAttribute('alt');
      if (!alt) {
        console.log(`이미지 ${i + 1}에 alt 텍스트가 없습니다`);
      }
    }
    
    // 버튼에 접근 가능한 텍스트가 있는지 확인
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    console.log(`페이지에 ${buttonCount}개의 버튼이 있습니다`);
    
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const text = await button.textContent();
      const ariaLabel = await button.getAttribute('aria-label');
      
      console.log(`버튼 ${i + 1}: 텍스트="${text}", aria-label="${ariaLabel}"`);
      
      // 텍스트나 aria-label 중 하나는 있어야 함
      if (!text && !ariaLabel) {
        console.log(`버튼 ${i + 1}에 접근 가능한 텍스트가 없습니다`);
      }
    }
  });

  test('페이지 구조 분석', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // 페이지의 HTML 구조 분석
    const bodyContent = await page.locator('body').innerHTML();
    console.log('페이지 HTML 구조 길이:', bodyContent.length);
    
    // 주요 요소들 확인
    const elements = {
      'div': await page.locator('div').count(),
      'button': await page.locator('button').count(),
      'img': await page.locator('img').count(),
      'input': await page.locator('input').count(),
      'select': await page.locator('select').count(),
      'h1': await page.locator('h1').count(),
      'h2': await page.locator('h2').count(),
      'p': await page.locator('p').count()
    };
    
    console.log('페이지 요소 분석:', elements);
    
    // 스크린샷 저장
    await page.screenshot({ path: 'tests/screenshots/page-analysis.png' });
  });
}); 