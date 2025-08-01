// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('사용자 설정 팝업 테스트', () => {
  test.beforeEach(async ({ page }) => {
    // 로컬스토리지 초기화 (첫 방문 상태로 만들기)
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
  });

  test('시작하기 버튼 클릭 시 사용자 설정 팝업이 나타나는지 확인', async ({ page }) => {
    await page.goto('/');
    
    // 시작하기 버튼이 나타날 때까지 대기 (2초 후)
    await page.waitForSelector('button:has-text("시작하기")', { timeout: 5000 });
    
    // 시작하기 버튼 클릭
    await page.click('button:has-text("시작하기")');
    
    // 사용자 설정 모달이 나타나는지 확인
    await expect(page.locator('text=봉황동에 오신 것을 환영합니다')).toBeVisible();
    await expect(page.locator('text=닉네임을 입력해주세요')).toBeVisible();
    await expect(page.locator('text=성별을 선택해주세요')).toBeVisible();
    
    console.log('✅ 사용자 설정 팝업이 정상적으로 표시됨');
  });

  test('사용자 설정 팝업에서 닉네임과 성별 입력 후 완료', async ({ page }) => {
    await page.goto('/');
    
    // 시작하기 버튼 클릭
    await page.waitForSelector('button:has-text("시작하기")', { timeout: 5000 });
    await page.click('button:has-text("시작하기")');
    
    // 모달이 나타날 때까지 대기
    await page.waitForSelector('text=봉황동에 오신 것을 환영합니다');
    
    // 닉네임 입력
    const nicknameInput = page.locator('input[placeholder*="예: 철수, 영희, 봉황이 등"]');
    await nicknameInput.fill('테스터');
    
    // 성별 선택 (남자아이)
    await page.click('button:has-text("👦 남자아이")');
    
    // 선택된 성별 버튼이 활성화되었는지 확인
    const maleButton = page.locator('button:has-text("👦 남자아이")');
    await expect(maleButton).toHaveClass(/border-vintage-gold/);
    
    // 추억 여행 시작하기 버튼 클릭
    await page.click('button:has-text("추억 여행 시작하기")');
    
    // 스토리 페이지로 이동했는지 확인
    await page.waitForURL(/\/story/, { timeout: 5000 });
    
    console.log('✅ 사용자 설정 완료 후 스토리 페이지로 이동');
  });

  test('이미 설정된 사용자는 바로 스토리 페이지로 이동', async ({ page }) => {
    // 먼저 사용자 정보를 로컬스토리지에 설정
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('userId', '기존사용자');
      localStorage.setItem('userGender', 'female');
    });
    await page.reload();
    
    // 시작하기 버튼 클릭
    await page.waitForSelector('button:has-text("시작하기")', { timeout: 5000 });
    await page.click('button:has-text("시작하기")');
    
    // 사용자 설정 모달이 나타나지 않고 바로 스토리 페이지로 이동해야 함
    await page.waitForURL(/\/story/, { timeout: 5000 });
    
    // 모달이 표시되지 않았는지 확인
    await expect(page.locator('text=봉황동에 오신 것을 환영합니다')).not.toBeVisible();
    
    console.log('✅ 기존 사용자는 바로 스토리 페이지로 이동');
  });

  test('닉네임이나 성별이 비어있으면 완료 버튼이 비활성화', async ({ page }) => {
    await page.goto('/');
    
    // 시작하기 버튼 클릭
    await page.waitForSelector('button:has-text("시작하기")', { timeout: 5000 });
    await page.click('button:has-text("시작하기")');
    
    // 모달이 나타날 때까지 대기
    await page.waitForSelector('text=봉황동에 오신 것을 환영합니다');
    
    // 초기 상태에서 완료 버튼이 비활성화되어 있는지 확인
    const submitButton = page.locator('button:has-text("추억 여행 시작하기")');
    await expect(submitButton).toBeDisabled();
    
    // 닉네임만 입력
    await page.fill('input[placeholder*="예: 철수, 영희, 봉황이 등"]', '테스터');
    await expect(submitButton).toBeDisabled();
    
    // 성별만 선택 (닉네임 비우기)
    await page.fill('input[placeholder*="예: 철수, 영희, 봉황이 등"]', '');
    await page.click('button:has-text("👧 여자아이")');
    await expect(submitButton).toBeDisabled();
    
    // 둘 다 입력하면 활성화
    await page.fill('input[placeholder*="예: 철수, 영희, 봉황이 등"]', '테스터');
    await expect(submitButton).toBeEnabled();
    
    console.log('✅ 입력 검증이 정상적으로 작동함');
  });

  test('모달 스크린샷 촬영', async ({ page }) => {
    await page.goto('/');
    
    // 시작하기 버튼 클릭
    await page.waitForSelector('button:has-text("시작하기")', { timeout: 5000 });
    await page.click('button:has-text("시작하기")');
    
    // 모달이 나타날 때까지 대기
    await page.waitForSelector('text=봉황동에 오신 것을 환영합니다');
    
    // 모달 스크린샷 촬영
    await page.screenshot({ 
      path: 'screenshots/user-setup-modal.png', 
      fullPage: true 
    });
    
    // 닉네임과 성별 입력 후 스크린샷
    await page.fill('input[placeholder*="예: 철수, 영희, 봉황이 등"]', '봉황이');
    await page.click('button:has-text("👦 남자아이")');
    
    await page.screenshot({ 
      path: 'screenshots/user-setup-modal-filled.png', 
      fullPage: true 
    });
    
    console.log('✅ 사용자 설정 모달 스크린샷 촬영 완료');
  });
});