/**
 * 환불 규정 안내 — 랜딩의 결제 안내에서 링크된다(브랜드 v2.1 §5 필수 항목).
 *
 * 가격·환불 문구는 세계관 용어(기록자·믹스테이프 등)를 쓰지 않고
 * 일반 용어로만 적는다. 참여자가 돈 문제를 이해하는 데 은유가 끼면 안 된다.
 *
 * ⚠️ 아래 '환불 기준'의 구체 조항(기간·수수료·연락처)은 사업자가 확정해야 하는
 *    내용이라 비워두었다. 실판매 전 반드시 채울 것.
 */

export const metadata = {
  title: '환불 규정 — 봉황 메모리즈',
}

export default function RefundPage() {
  return (
    <div className="min-h-screen bg-cream-base px-5 py-8">
      <div className="mx-auto w-full max-w-[420px]">
        <h1 className="font-display text-[22px] text-ink">환불 규정</h1>
        <p className="mt-1 text-[12px] text-ink-60">봉황 메모리즈 · 완주 리워드</p>

        <section className="card-paper mt-5 p-4">
          <h2 className="text-[14px] font-bold text-teal-dk">무엇이 유료인가요?</h2>
          <ul className="mt-2 space-y-1.5 text-[12.5px] leading-relaxed text-ink">
            <li>
              · 이야기와 미션은 <b>전부 무료</b>입니다. 결제하지 않아도 끝까지
              참여하고 디지털 완주 인증을 받을 수 있습니다.
            </li>
            <li>
              · <b>완주 리워드(5,000원)</b>를 구매하시면 골목 가게에서 쓰는{' '}
              <b>4,000원 쿠폰</b>과 <b>완주 기념품</b>을 드립니다.
            </li>
          </ul>
        </section>

        <section className="card-paper mt-4 p-4">
          <h2 className="text-[14px] font-bold text-teal-dk">언제 받나요?</h2>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink">
            쿠폰과 기념품은 <b>투어를 완주하신 뒤</b> 드립니다. 결제 시점에
            바로 지급되지 않습니다.
          </p>
        </section>

        <section className="card-paper mt-4 p-4">
          <h2 className="text-[14px] font-bold text-teal-dk">환불 기준</h2>
          <div className="mt-2 rounded-lg border border-dashed border-rec px-3 py-2">
            <p className="text-[11.5px] leading-relaxed text-rec">
              이 항목은 사업자가 확정해 채워야 합니다 — 환불 가능 기간, 쿠폰·기념품
              수령 후 환불 가능 여부, 부분 환불 기준, 처리 기간, 문의 연락처.
            </p>
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-ink-60">
            전자상거래 등에서의 소비자보호에 관한 법률에 따른 청약철회 규정이
            적용됩니다.
          </p>
        </section>

        <section className="card-paper mt-4 p-4">
          <h2 className="text-[14px] font-bold text-teal-dk">문의</h2>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-60">
            상호 · 사업자등록번호 · 대표자 · 주소 · 연락처를 여기에 표기하세요.
          </p>
        </section>

        <a
          href="/"
          className="mt-6 block w-full rounded-xl border border-line bg-paper px-4 py-3 text-center text-[13px] font-bold text-teal-dk"
        >
          ← 돌아가기
        </a>
      </div>
    </div>
  )
}
