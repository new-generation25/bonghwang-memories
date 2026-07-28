/**
 * 걸으면서 듣는 사람에게 (F-6).
 *
 * 이 투어는 90분 동안 골목을 걸으며 귀로 듣는 것이라, 화면을 보고 걷는
 * 시간이 길어진다. 봉황동은 차와 사람이 같은 폭을 나눠 쓰는 골목이 많다.
 *
 * 출발 직전에 한 번 보여주고 끝낸다 — 거점마다 되풀이하면 안내가 아니라
 * 잔소리가 되고, 그때부터는 읽지 않는다. 대신 문장을 짧게 잘라 한눈에
 * 들어오게 두었다.
 *
 * 소영의 말투로 쓰지 않는다. 이야기 속 인물이 안전을 당부하면 그 순간
 * 통화가 안내방송이 된다 — 이것은 만든 사람이 참여자에게 하는 말이다.
 */

const NOTES = [
  '화면보다 골목을 봐 주세요. 소리만 따라가도 됩니다.',
  '이어폰은 한쪽만. 골목의 소리도 이야기의 일부예요.',
  '차가 다니는 길 앞에서는 멈춰서 들어주세요.',
] as const

export default function SafetyNote({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-xl border border-line bg-paper/70 px-4 py-3 ${className}`}
    >
      <p className="font-mono-retro text-[10px] tracking-[0.2em] text-teal">
        걷기 전에
      </p>
      <ul className="mt-2 space-y-1">
        {NOTES.map((note) => (
          <li
            key={note}
            className="flex gap-2 text-[12px] leading-relaxed text-ink-60"
          >
            {/* 점은 장식이라 스크린리더가 읽지 않는다 */}
            <span aria-hidden>·</span>
            <span className="min-w-0 flex-1">{note}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
