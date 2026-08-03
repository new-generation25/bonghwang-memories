'use client'

/**
 * BEP 반영 확인 — 시뮬레이터가 띄우는 작은 창.
 *
 * 시뮬레이터(`/bep/index.html`)는 로그인이 없는 정적 파일이라 제 손으로
 * Firestore에 쓰지 못한다. 예전에는 앱이 iframe으로 품고 토큰을 넣어
 * 줬는데 그 자리가 없어졌다(8/3, 시뮬레이터를 앱 밖으로).
 *
 * **서버 키를 쓰지 않는 길을 골랐다.** `/api/bep/*`는 `FIREBASE_SERVICE_ACCOUNT`
 * 가 있어야 도는데 그 키는 저장소에 없고 Vercel에도 아직 안 들어갔다.
 * 여기는 앱 안의 페이지라 **관리자 본인의 로그인으로 직접 쓴다** —
 * 규칙(`isAdmin()`)이 그대로 방어선이고, 키가 없는 자리에서도 돈다.
 *
 * 값은 주소의 **fragment**로 받는다(`#<base64 JSON>`). 물음표 뒤가 아닌
 * 이유는 fragment가 서버로 안 가서다 — 접속 기록에 수치가 남지 않는다.
 *
 * 저장 전에 무엇이 무엇으로 바뀌는지 반드시 보여준다. 돈을 바꾸는
 * 화면이라, 쿠폰 액면이 조용히 내려가면 그 뒤 청구서가 전부 달라지는데
 * 아무도 눈치채지 못한다.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { isAdminUser } from '@/lib/admin'
import { applyBepPatch, DEFAULT_SETTLEMENT } from '@/lib/coverage'
import type { BepPatchChange, SettlementConfig } from '@/lib/coverage'
import { fetchSettlementConfig, saveSettlementConfig } from '@/lib/settlement'

type Phase = 'loading' | 'denied' | 'bad' | 'ready' | 'saving' | 'done' | 'error'

export default function BepApplyPage() {
  const { profile, loading } = useAuth()
  const [phase, setPhase] = useState<Phase>('loading')
  const [msg, setMsg] = useState('')
  const [next, setNext] = useState<SettlementConfig>(DEFAULT_SETTLEMENT)
  const [changes, setChanges] = useState<BepPatchChange[]>([])
  const [ignored, setIgnored] = useState<string[]>([])

  /*
    판정은 /admin과 같은 자리를 쓴다 — 토큰의 이메일이다. Profile에는
    이메일이 없다(공개 문서에서 로그인 아이디를 걷어낸 뒤로).
  */
  useEffect(() => {
    if (loading) return
    if (!isAdminUser()) {
      setPhase('denied')
      return
    }

    /*
      hash를 먼저 읽고 서버 값을 부른다. 순서가 반대면 창을 열자마자
      주소를 지우는 확장이 있는 브라우저에서 값이 사라진다.
    */
    let patch: unknown
    try {
      const raw = window.location.hash.replace(/^#/, '')
      if (!raw) throw new Error('empty')
      patch = JSON.parse(decodeURIComponent(escape(atob(raw))))
    } catch {
      setPhase('bad')
      return
    }

    let alive = true
    fetchSettlementConfig()
      .then((cfg) => {
        if (!alive) return
        const r = applyBepPatch(cfg, patch)
        setNext(r.next)
        setChanges(r.changes)
        setIgnored(r.ignored)
        setPhase('ready')
      })
      .catch(() => {
        if (!alive) return
        setMsg('지금 설정을 읽지 못했습니다.')
        setPhase('error')
      })
    return () => {
      alive = false
    }
  }, [loading, profile])

  const save = useCallback(async () => {
    setPhase('saving')
    setMsg('')
    try {
      await saveSettlementConfig(next)
      setPhase('done')
      // 부모 창이 "반영됨"을 그릴 수 있게 알린다. 없으면 조용히 넘어간다
      window.opener?.postMessage({ type: 'bep-applied' }, window.location.origin)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '저장하지 못했습니다.')
      setPhase('error')
    }
  }, [next])

  return (
    <main className="mx-auto min-h-screen max-w-[460px] bg-shell px-4 py-6">
      <p className="font-mono-retro text-[10px] tracking-[0.2em] text-ink-60">
        BEP → 앱 반영
      </p>

      {(phase === 'loading' || loading) && (
        <p className="mt-4 text-[13px] text-ink-60">불러오는 중…</p>
      )}

      {phase === 'denied' && (
        <div className="card-paper mt-4 p-5 text-center">
          <div className="text-4xl">🔒</div>
          <h1 className="mt-2 font-display text-[16px] text-ink">관리자 전용</h1>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-60">
            {profile
              ? '이 계정에는 권한이 없습니다. 관리자 구글 계정으로 로그인해주세요.'
              : '구글 계정으로 로그인한 뒤 시뮬레이터에서 다시 눌러주세요.'}
          </p>
          <Link href="/me" className="btn-teal mt-4 inline-block px-5 text-[13px]">
            로그인하러 가기
          </Link>
        </div>
      )}

      {phase === 'bad' && (
        <p className="mt-4 text-[13px] leading-relaxed text-ink">
          반영할 값이 없습니다. 시뮬레이터에서 <b>「앱에 반영」</b>을 눌러
          이 창을 열어주세요.
        </p>
      )}

      {(phase === 'ready' || phase === 'saving' || phase === 'error') && (
        <>
          <h1 className="mt-3 font-display text-[17px] text-ink">
            {changes.length ? `${changes.length}개 값이 바뀝니다` : '바뀌는 값이 없습니다'}
          </h1>

          {changes.length > 0 ? (
            <ul className="card-paper mt-3 space-y-2 p-4">
              {changes.map((c) => (
                <li key={c.label} className="text-[13px] text-ink">
                  <span className="text-ink-60">{c.label}</span>
                  <br />
                  <span className="text-ink-60">{c.from.toLocaleString()}</span>
                  {' → '}
                  <b>{c.to.toLocaleString()}</b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[13px] text-ink-60">
              지금 앱에 들어 있는 값과 같습니다. 저장하지 않아도 됩니다.
            </p>
          )}

          {ignored.length > 0 && (
            <p className="mt-3 text-[11.5px] leading-relaxed text-ink-60">
              <b className="text-ink">{ignored.join('·')}은 받지 않았습니다.</b>{' '}
              BEP는 연차별로 잡고 앱은 등급별로 잡아 옮길 대응이 없습니다.
              시범운영 중인 지금 잘못 넘어가면 가게에 청구가 갑니다 —
              관리자 화면에서 직접 넣으세요.
            </p>
          )}

          {changes.length > 0 && (
            <button
              onClick={save}
              disabled={phase === 'saving'}
              className="btn-teal mt-4 w-full py-3 text-[14px] disabled:opacity-50"
            >
              {phase === 'saving' ? '반영하는 중…' : '앱에 반영한다'}
            </button>
          )}

          {msg && <p className="mt-3 text-[12.5px] text-rec">{msg}</p>}

          <p className="mt-4 text-[10.5px] leading-relaxed text-ink-60">
            반영해도 <b className="text-ink">이미 굳은 사용 기록은 움직이지
            않습니다.</b> 지난 달 청구서가 오늘의 설정으로 다시 계산되면
            안 되기 때문입니다.
          </p>
        </>
      )}

      {phase === 'done' && (
        <div className="card-paper mt-4 p-5 text-center">
          <div className="text-4xl">✅</div>
          <h1 className="mt-2 font-display text-[16px] text-ink">반영했습니다</h1>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-60">
            참여자 화면의 배점은 바로 따라갑니다. 가게에 걸린 율은 그대로라
            관리자 화면에서 등급을 다시 눌러야 움직입니다.
          </p>
          <button
            onClick={() => window.close()}
            className="btn-teal mt-4 px-5 text-[13px]"
          >
            창 닫기
          </button>
        </div>
      )}
    </main>
  )
}
