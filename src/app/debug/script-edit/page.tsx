'use client'

/**
 * 대본 고치기 — 개발용.
 *
 * `/debug/script`가 **굽는** 자리라면 여기는 **쓰는** 자리다. 큐마다 줄이
 * 나뉘어 있고 줄 하나가 칸 하나라, 어느 대사를 고치는지 세지 않아도 된다.
 *
 * 왜 마크다운을 직접 안 고치나:
 * `docs/SCRIPT.md`는 산문과 대본이 한 파일에 있다. 대사를 고치려면 스물여덟
 * 개 큐 사이에서 번호를 세며 내려가야 하고, 번호를 흘리면 되쓰기가 멈춘다.
 * 여기서는 줄 번호를 사람이 만지지 않는다 — 저장할 때 다시 매긴다.
 *
 * 굽기와의 관계:
 * 이 화면은 **글만** 고친다. 음성은 안 건드린다. 글을 고친 뒤에는
 *   npm run script:check   무엇이 바뀌는지 본다
 *   npm run script:bake    되쓰기 → 금지어 → 바뀐 줄만 굽기
 * 를 돌리거나, 한 줄씩 목소리를 골라 듣고 싶으면 `/debug/script`로 간다.
 *
 * 줄 수를 바꾸면 그 큐는 통째로 다시 굽는다 — 줄 하나가 TTS 한 조각이라
 * 글자가 같아도 나뉜 자리가 다르면 다른 음성이다. 그래서 줄을 더하거나
 * 지우면 화면이 그 큐에 표시를 남긴다.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { isAdminUser } from '@/lib/admin'
import { loadDraft, saveDraft } from '@/lib/scriptDraft'

/** 고칠 수 있는 파일 — 서버의 목록과 같아야 한다 */
const FILES = ['SCRIPT.md', 'SCRIPT_v2.md'] as const
type FileName = (typeof FILES)[number]

/** 서버 초안 — 어느 기기에서 열어도 같은 판이고 서버를 껐다 켜도 남는다 */
const SERVER = '서버 초안' as const
type Source = FileName | typeof SERVER

/** 대본 표식 — 이 뒤만 기계가 읽고 쓴다 */
const BODY_MARK = /^# 대본[ \t]*$/m

/** `B0_TAPE` · 아버지 · `b0_tape.mp3` */
const META = /^`([A-Z0-9_]+)`\s*·\s*(.+?)\s*·\s*`(.+?)`\s*$/
/** 1. 대사 */
const NUMBERED = /^(\d+)\.\s?(.*)$/
/** 개정안에서 바뀐 줄에 붙는 표시 */
const MARK = /^✎\s*/

interface Cue {
  title: string
  /** 큐 앞에 붙은 산문 설명 (B1_NO에 하나 있다) */
  prose: string
  id: string
  speaker: string
  file: string
  lines: string[]
  marked: boolean[]
  /**
   * 마지막 줄 뒤에 붙은 산문 — 주의 문구나 구분선이 여기 온다.
   *
   * 번호 줄만 챙기고 나머지를 버렸더니 저장 한 번에 주석이 사라졌다.
   * 고치지 않는 부분은 받은 그대로 돌려준다.
   */
  tail: string
}

interface Doc {
  /** `# 대본`까지의 앞부분 — 손대지 않고 그대로 돌려준다 */
  head: string
  /** 큐가 아닌 절(개정안의 「검토해주실 것」 같은 것)은 통째로 보관한다 */
  parts: Array<{ kind: 'cue'; cue: Cue } | { kind: 'raw'; text: string }>
}

/** 마크다운 → 구조. 큐가 아닌 것은 원문 그대로 담는다 */
function parseDoc(text: string): Doc | null {
  const m = BODY_MARK.exec(text)
  if (!m) return null

  const head = text.slice(0, m.index + m[0].length)
  const body = text.slice(m.index + m[0].length)

  const parts: Doc['parts'] = []
  const chunks = body.split(/^## /m)

  // 첫 조각은 `# 대본`과 첫 `##` 사이의 빈 줄이다
  chunks.forEach((chunk, i) => {
    if (i === 0) return
    const rows: string[] = chunk.replace(/\s+$/, '').split('\n')
    const title = rows[0].trim()

    const metaAt = rows.findIndex((r: string) => META.test(r.trim()))
    if (metaAt < 0) {
      parts.push({ kind: 'raw', text: `## ${chunk.replace(/\s+$/, '')}` })
      return
    }

    const meta = META.exec(rows[metaAt].trim())!
    const prose = rows
      .slice(1, metaAt)
      .join('\n')
      .trim()

    // 번호 줄은 여기서 끝난다 — 그 뒤는 손대지 않고 담아둔다
    let lastNum = metaAt
    rows.forEach((r: string, at: number) => {
      if (at > metaAt && NUMBERED.test(r)) lastNum = at
    })

    const lines: string[] = []
    const marked: boolean[] = []
    for (const row of rows.slice(metaAt + 1, lastNum + 1)) {
      const n = NUMBERED.exec(row)
      if (!n) continue
      const raw = n[2]
      marked.push(MARK.test(raw))
      lines.push(raw.replace(MARK, ''))
    }
    const tail = rows.slice(lastNum + 1).join('\n').trim()

    parts.push({
      kind: 'cue',
      cue: { title, prose, id: meta[1], speaker: meta[2], file: meta[3], lines, marked, tail },
    })
  })

  return { head, parts }
}

/** 구조 → 마크다운. 번호는 여기서 다시 매긴다 */
function serialize(doc: Doc): string {
  const out: string[] = [doc.head, '']
  for (const part of doc.parts) {
    if (part.kind === 'raw') {
      out.push(part.text, '')
      continue
    }
    const c = part.cue
    out.push(`## ${c.title}`, '')
    if (c.prose) out.push(c.prose, '')
    out.push(`\`${c.id}\` · ${c.speaker} · \`${c.file}\``, '')
    c.lines.forEach((t, i) => out.push(`${i + 1}. ${c.marked[i] ? '✎ ' : ''}${t}`))
    out.push('')
    if (c.tail) out.push(c.tail, '')
  }
  return out.join('\n').replace(/\n+$/, '\n')
}

/**
 * 저장을 누르기 전의 수정을 이 기기에 담아둔다.
 *
 * 개발 서버가 다시 컴파일되면 화면이 새로 그려지고, 그때까지 고치던 것이
 * 통째로 날아갔다. 고칠 때마다 여기에 적어두면 되돌아와서 이어갈 수 있다.
 */
const STASH_KEY = 'bh_script_edit_stash'

/**
 * D6·D6b — 빌드를 못 돌리는 자리라 눈으로 볼 수 있게 화면에서 짚는다.
 *
 * 목록을 글자 그대로 들고 있어야 하는데, 그러면 check-forbidden이 이 파일을
 * 잡아 빌드가 멈춘다(실제로 배포가 다섯 번 죽었다). 검사기는 여기가
 * **검사하는 자리**인지 모르므로 그 줄만 넘기라고 표식을 남긴다.
 */
const FORBIDDEN = ['치매', '미워', '미움'] // forbidden-check:allow
const hitsIn = (s: string) => FORBIDDEN.filter((w) => s.includes(w))

export default function ScriptEditPage() {
  const { profile } = useAuth()
  const [file, setFile] = useState<Source>(SERVER)
  const [doc, setDoc] = useState<Doc | null>(null)
  const [origin, setOrigin] = useState<Doc | null>(null)
  const [status, setStatus] = useState<string>('불러오는 중…')
  const [saving, setSaving] = useState(false)
  /**
   * 펼쳐둔 큐들.
   *
   * 하나만 열리던 때는 앞뒤 대사를 견주려면 이쪽을 닫고 저쪽을 열어야 했다.
   * 대사는 앞줄과의 흐름으로 고치는 것이라 그 왕복이 곧 작업이었다.
   * 여러 개를 동시에 열어두고, 「모두 펼치기」로 통째로 볼 수도 있게 한다.
   */
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [admin, setAdmin] = useState(true)
  /** 저장 안 한 수정이 이 기기에 남아 있을 때 */
  const [stash, setStash] = useState<string | null>(null)

  useEffect(() => setAdmin(isAdminUser()), [profile])

  const load = useCallback(async (name: Source) => {
    setStatus('불러오는 중…')
    setDoc(null)
    try {
      /*
        서버 초안이 기본이다 — 파일은 저장소가 있는 자리에서만 열린다.
        (`/api/debug/*`는 운영에서 404다)
      */
      let text: string
      if (name === SERVER) {
        const d = await loadDraft()
        if (!d) throw new Error('서버에 초안이 아직 없습니다. 파일에서 불러와 한 번 저장해주세요.')
        text = d.text
      } else {
        const res = await fetch(`/api/debug/script-file?file=${encodeURIComponent(name)}`)
        const j = await res.json()
        if (!res.ok) throw new Error(j.error ?? '불러오지 못했습니다')
        text = j.text as string
      }
      const parsed = parseDoc(text)
      if (!parsed) throw new Error('`# 대본` 표식을 찾지 못했습니다')
      setDoc(parsed)
      setOrigin(JSON.parse(JSON.stringify(parsed)))
      setStatus('')
      // 저장 못 하고 끊긴 수정이 있으면 되살릴지 묻는다
      try {
        const kept = localStorage.getItem(STASH_KEY + ':' + name)
        setStash(kept && kept !== serialize(parsed) ? kept : null)
      } catch {
        setStash(null)
      }
    } catch (e) {
      setStatus(`❌ ${e instanceof Error ? e.message : '불러오기 실패'}`)
    }
  }, [])

  useEffect(() => {
    load(file)
  }, [file, load])

  const cues = useMemo(
    () => (doc ? doc.parts.filter((p) => p.kind === 'cue').map((p) => (p as { cue: Cue }).cue) : []),
    [doc]
  )
  const originCues = useMemo(
    () =>
      origin
        ? origin.parts.filter((p) => p.kind === 'cue').map((p) => (p as { cue: Cue }).cue)
        : [],
    [origin]
  )

  /** 원본과 견준다 — 무엇을 다시 구워야 하는지가 여기서 나온다 */
  const diff = useMemo(() => {
    const changed: Array<{ id: string; lines: number[]; countChanged: boolean }> = []
    cues.forEach((c, i) => {
      const o = originCues[i]
      if (!o) return
      const lines: number[] = []
      c.lines.forEach((t, j) => {
        if (o.lines[j] !== t) lines.push(j + 1)
      })
      const countChanged = o.lines.length !== c.lines.length
      if (lines.length || countChanged) changed.push({ id: c.id, lines, countChanged })
    })
    return changed
  }, [cues, originCues])

  /* 고칠 때마다 이 기기에 적어둔다 — 서버가 다시 컴파일돼도 되돌아올 수 있게 */
  useEffect(() => {
    if (!doc) return
    try {
      localStorage.setItem(STASH_KEY + ':' + file, serialize(doc))
    } catch {
      // 저장이 막힌 브라우저 — 담아두지 못해도 편집은 굴러간다
    }
  }, [doc, file])

  const totalLines = cues.reduce((n, c) => n + c.lines.length, 0)
  const forbidden = cues.flatMap((c) =>
    c.lines.flatMap((t, i) => hitsIn(t).map((w) => `${c.id} ${i + 1}번 — ${w}`))
  )

  const edit = (cueId: string, at: number, value: string) => {
    setDoc((d) => {
      if (!d) return d
      const next = { ...d, parts: [...d.parts] }
      next.parts = next.parts.map((p) => {
        if (p.kind !== 'cue' || p.cue.id !== cueId) return p
        const lines = [...p.cue.lines]
        lines[at] = value
        return { kind: 'cue', cue: { ...p.cue, lines } }
      })
      return next
    })
  }

  const toggleMark = (cueId: string, at: number) => {
    setDoc((d) => {
      if (!d) return d
      return {
        ...d,
        parts: d.parts.map((p) => {
          if (p.kind !== 'cue' || p.cue.id !== cueId) return p
          const marked = [...p.cue.marked]
          marked[at] = !marked[at]
          return { kind: 'cue', cue: { ...p.cue, marked } }
        }),
      }
    })
  }

  const addLine = (cueId: string, at: number) => {
    setDoc((d) => {
      if (!d) return d
      return {
        ...d,
        parts: d.parts.map((p) => {
          if (p.kind !== 'cue' || p.cue.id !== cueId) return p
          const lines = [...p.cue.lines]
          const marked = [...p.cue.marked]
          lines.splice(at + 1, 0, '')
          marked.splice(at + 1, 0, true)
          return { kind: 'cue', cue: { ...p.cue, lines, marked } }
        }),
      }
    })
  }

  const removeLine = (cueId: string, at: number) => {
    setDoc((d) => {
      if (!d) return d
      return {
        ...d,
        parts: d.parts.map((p) => {
          if (p.kind !== 'cue' || p.cue.id !== cueId) return p
          const lines = [...p.cue.lines]
          const marked = [...p.cue.marked]
          lines.splice(at, 1)
          marked.splice(at, 1)
          return { kind: 'cue', cue: { ...p.cue, lines, marked } }
        }),
      }
    })
  }

  const save = async () => {
    if (!doc) return
    setSaving(true)
    setStatus('저장 중…')
    try {
      const text = serialize(doc)
      if (file === SERVER) {
        await saveDraft(text, profile?.nickname ?? '관리자')
        setStatus('✅ 서버 초안에 저장했습니다 — 다른 기기에서도 이어집니다')
      } else {
        const res = await fetch('/api/debug/script-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file, text }),
        })
        const j = await res.json()
        if (!res.ok) throw new Error(j.error ?? '저장 실패')
        setStatus(`✅ ${j.saved} 저장됨 (${j.bytes.toLocaleString()}바이트) · 직전 판은 ${j.saved}.bak`)
      }
      setOrigin(JSON.parse(JSON.stringify(doc)))
      // 저장됐으니 이 기기의 임시 보관은 지운다
      setStash(null)
      try {
        localStorage.removeItem(`${STASH_KEY}:${file}`)
      } catch {
        // 지우지 못해도 다음 저장 때 덮인다
      }
    } catch (e) {
      setStatus(`❌ ${e instanceof Error ? e.message : '저장 실패'}`)
    } finally {
      setSaving(false)
    }
  }

  /*
    관리자만 연다.

    막는 것은 규칙이 이미 한다(config/scriptDraft는 관리자만 읽고 쓴다).
    여기서 한 번 더 세우는 것은 **왜 안 되는지 말해주기 위해서**다 —
    안 그러면 빈 화면에 오류 문구만 남는다.
  */
  if (!admin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-base px-6">
        <p className="text-center text-[13px] leading-relaxed text-ink-60">
          대본 고치기는 관리자만 열 수 있어요.
          <br />
          관리자 계정으로 로그인한 뒤 다시 들어와주세요.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream-base px-5 py-8">
      <div className="mx-auto w-full max-w-[720px]">
        <p className="font-mono-retro text-[11px] tracking-[0.25em] text-teal">
          SCRIPT EDIT · 관리자
        </p>
        <h1 className="mt-1 font-display text-[22px] text-ink">대본 고치기</h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-60">
          줄 하나가 칸 하나입니다. 번호는 저장할 때 다시 매기니 신경 쓰지 않으셔도
          됩니다. 여기는 <b className="text-ink">글만</b> 고칩니다 — 음성은
          <code className="mx-1 rounded bg-cream-dp px-1">/debug/script</code>에서 굽습니다.
        </p>

        {/* ── 파일 · 저장 ─────────────────── */}
        <div className="card-paper mt-5 flex flex-wrap items-center gap-2 p-4">
          <select
            value={file}
            onChange={(e) => setFile(e.target.value as Source)}
            className="rounded-lg border border-line bg-cream-base px-2 py-1.5 text-[12px] text-ink"
          >
            <option value={SERVER}>{SERVER} — 어디서나 이어집니다</option>
            {FILES.map((f) => (
              <option key={f} value={f}>
                {f}
                {f === 'SCRIPT.md' ? ' — 확정본(이 기기)' : ' — 개정 초안(이 기기)'}
              </option>
            ))}
          </select>
          <span className="text-[11.5px] text-ink-60">
            큐 {cues.length}개 · {totalLines}줄
          </span>
          <span className="grow" />
          {/* 통째로 훑을 때와 한 큐만 손볼 때가 다르다 — 둘 다 한 번에 */}
          <button
            onClick={() =>
              setOpen((prev) =>
                prev.size === cues.length ? new Set() : new Set(cues.map((c) => c.id))
              )
            }
            className="rounded-lg border border-line px-3 py-1.5 text-[12px] text-ink-60"
          >
            {open.size === cues.length && cues.length > 0 ? '모두 접기' : '모두 펼치기'}
          </button>
          {/*
            파일 → 서버로 올리는 다리.

            서버 초안은 처음에 비어 있고, 채우는 길이 없으면 영영 못 쓴다.
            저장소가 있는 자리에서 한 번 올려두면 그다음부터는 어느 기기에서나
            이어 고칠 수 있다.
          */}
          {file !== SERVER && doc && (
            <button
              onClick={async () => {
                setSaving(true)
                setStatus('서버로 올리는 중…')
                try {
                  await saveDraft(serialize(doc), profile?.nickname ?? '관리자')
                  setStatus(`✅ ${file}의 지금 판을 서버 초안으로 올렸습니다`)
                } catch (e) {
                  setStatus(`❌ ${e instanceof Error ? e.message : '올리지 못했습니다'}`)
                } finally {
                  setSaving(false)
                }
              }}
              disabled={saving}
              className="rounded-lg border border-teal px-3 py-1.5 text-[12px] text-teal disabled:opacity-40"
            >
              ↑ 서버 초안으로 올리기
            </button>
          )}
          <button
            onClick={() => load(file)}
            className="rounded-lg border border-line px-3 py-1.5 text-[12px] text-ink-60"
          >
            되돌리기
          </button>
          <button
            onClick={save}
            disabled={saving || !doc || diff.length === 0}
            className="btn-teal px-4 py-1.5 text-[12.5px] disabled:opacity-40"
          >
            {saving ? '저장 중…' : `저장 (${diff.length}개 큐)`}
          </button>
        </div>

        {status && (
          <p className="mt-2 text-[12px] leading-relaxed text-ink-60">{status}</p>
        )}

        {/* 저장 전에 끊긴 수정 — 서버가 다시 컴파일돼도 여기서 되살린다 */}
        {stash && (
          <div className="mt-3 rounded-lg border border-sunset bg-sunset/10 px-3 py-2.5">
            <p className="text-[12px] leading-relaxed text-ink">
              <b>저장하지 않은 수정이 이 기기에 남아 있어요.</b>
              <br />
              되살릴까요? 버리면 지금 불러온 판으로 갑니다.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => {
                  const parsed = parseDoc(stash)
                  if (parsed) setDoc(parsed)
                  setStash(null)
                }}
                className="btn-teal px-3 py-1.5 text-[12px]"
              >
                되살리기
              </button>
              <button
                onClick={() => {
                  try {
                    localStorage.removeItem(`${STASH_KEY}:${file}`)
                  } catch {
                    // 못 지워도 되살리기를 안 누르면 그만이다
                  }
                  setStash(null)
                }}
                className="rounded-lg border border-line px-3 py-1.5 text-[12px] text-ink-60"
              >
                버리기
              </button>
            </div>
          </div>
        )}

        {forbidden.length > 0 && (
          <div className="mt-3 rounded-lg border border-rec bg-rec/10 px-3 py-2.5 text-[11.5px] leading-relaxed text-rec">
            <b>금지어가 있습니다 (D6·D6b)</b>
            <br />
            {forbidden.join(' · ')}
          </div>
        )}

        {diff.length > 0 && (
          <div className="mt-3 rounded-lg border border-line bg-cream-dp px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-60">
            <b className="text-ink">바뀐 큐</b> —{' '}
            {diff.map((d) => (
              <span key={d.id} className="mr-2">
                {d.id}
                {d.countChanged ? ' (줄 수 바뀜 · 통째로 다시 굽습니다)' : ` ${d.lines.join('·')}번`}
              </span>
            ))}
          </div>
        )}

        {/* ── 큐 ──────────────────────────── */}
        {cues.map((c, ci) => {
          const o = originCues[ci]
          const isOpen = open.has(c.id)
          const cueChanged = diff.find((d) => d.id === c.id)
          return (
            <div key={c.id} className="card-paper mt-3 p-4">
              <button
                onClick={() =>
                  setOpen((prev) => {
                    const next = new Set(prev)
                    if (next.has(c.id)) next.delete(c.id)
                    else next.add(c.id)
                    return next
                  })
                }
                className="flex w-full items-center gap-2 text-left"
              >
                <span className="font-mono-retro text-[11px] text-teal">{c.id}</span>
                <span className="text-[12.5px] font-bold text-ink">{c.title}</span>
                <span className="text-[11px] text-ink-60">
                  {c.speaker} · {c.lines.length}줄
                </span>
                {cueChanged && (
                  <span className="rounded bg-teal/15 px-1.5 py-0.5 text-[10px] text-teal">
                    고침
                  </span>
                )}
                <span className="grow" />
                <span className="text-[11px] text-ink-60">{isOpen ? '▲' : '▼'}</span>
              </button>

              {isOpen && (
                <div className="mt-3 space-y-2">
                  {c.prose && (
                    <p className="rounded-lg bg-cream-dp px-3 py-2 text-[11.5px] leading-relaxed text-ink-60">
                      {c.prose}
                    </p>
                  )}
                  {c.lines.map((t, i) => {
                    const changed = o && o.lines[i] !== t
                    const bad = hitsIn(t)
                    return (
                      <div key={i} className="flex items-start gap-2">
                        <button
                          onClick={() => toggleMark(c.id, i)}
                          title="개정 표시(✎) 켜고 끄기"
                          className={`mt-2 w-6 shrink-0 text-center font-mono-retro text-[11px] ${
                            c.marked[i] ? 'text-teal' : 'text-ink-60'
                          }`}
                        >
                          {c.marked[i] ? '✎' : i + 1}
                        </button>
                        <textarea
                          value={t}
                          onChange={(e) => edit(c.id, i, e.target.value)}
                          rows={Math.max(1, Math.ceil(t.length / 42))}
                          className={`w-full resize-y rounded-lg border bg-cream-base px-3 py-2 text-[12.5px] leading-relaxed text-ink ${
                            bad.length
                              ? 'border-rec'
                              : changed
                                ? 'border-teal'
                                : 'border-line'
                          }`}
                        />
                        <div className="mt-1 flex shrink-0 flex-col gap-1">
                          <button
                            onClick={() => addLine(c.id, i)}
                            title="아래에 줄 추가"
                            className="rounded border border-line px-1.5 text-[11px] text-ink-60"
                          >
                            +
                          </button>
                          <button
                            onClick={() => removeLine(c.id, i)}
                            title="이 줄 지우기"
                            className="rounded border border-line px-1.5 text-[11px] text-ink-60"
                          >
                            −
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  {c.tail && (
                    <p className="whitespace-pre-wrap rounded-lg bg-cream-dp px-3 py-2 text-[11.5px] leading-relaxed text-ink-60">
                      {c.tail}
                    </p>
                  )}
                  <p className="pt-1 text-[10.5px] leading-snug text-ink-60">
                    <b className="text-ink">&lt;br&gt;</b>은 자막이 나뉘는 자리입니다 —
                    음성에는 안 들어갑니다. 줄을 더하거나 지우면 이 큐는 통째로 다시 굽습니다.
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
