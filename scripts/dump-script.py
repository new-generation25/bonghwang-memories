#!/usr/bin/env python3
"""
녹음된 대본을 한 파일로 모은다 — docs/SCRIPT.md.

대사가 cues.ts 안에 흩어져 있어, 줄 하나를 고치려 해도 어디에 적혀
있는지부터 찾아야 했다. 여기 모아두면 읽고 표시한 뒤 그 자리만 고치면 된다.

cues.ts를 실행하지 않고 글자만 읽는다 — TypeScript라 그냥 불러올 수 없고,
대본 뽑자고 빌드 도구를 하나 더 얹을 이유가 없다.

    python3 scripts/dump-script.py
"""
import io
import re
import sys

NAMES = {
    'father': '아버지',
    'soyoung': '소영',
    'shopkeeper1': '봉황1935 사장님',
    'shopkeeper2': '방하림 사장님',
    'dj_father': '라디오',
    'father_soyoung': '아버지·소영',
}

# 큐 ID만으로는 어디서 나오는 대사인지 알 수 없어 사람이 읽을 이름을 붙인다
WHERE = {
    'B0_TAPE': '인트로 · 테이프',
    'B0_CALL': '인트로 · 첫 통화',
    'B1_A': 'A1 봉황1935 · 도착',
    'B1_S': 'A1 · 사장님 증언',
    'B1_B': 'A1 · 완료',
    'B2_A': 'A2 미야상회 · 도착',
    'B2_B': 'A2 · 완료',
    'B3_A': 'A3 능소화 고택 · 도착',
    'B3_B': 'A3 · 완료',
    'B4_A': 'A4 카페 탱자 · 도착',
    'B4_RADIO': 'A4 · 1988년 라디오',
    'B4_B': 'A4 · 완료',
    'B4_C': 'A4 · 다음 안내',
    'B5_A': 'A5 방하림 · 도착',
    'B5_T1': 'A5 · 여쭤보기 전',
    'B5_T2': 'A5 · 사장님 증언',
    'B5_T3': 'A5 · B면 안내',
    'B5_LETTER': 'B면 · 아버지의 편지',
    'B5_F': 'A5 · 1막 마무리',
    'B6_0': '2막 · 빙고 시작',
    'B6_X_BUNSIK': '빙고 · 분식점',
    'B6_X_BYEOKHWA': '빙고 · 벽화골목',
    'B6_X_BONGHWANGDAE': '빙고 · 봉황대',
    'B7_0': '피날레',
    'B7_1': '에필로그(선택)',
}

# 대사에 따옴표가 섞여 있어(작은·큰 양쪽) 두 형태를 모두 본다
SQ = re.compile(r"text:\s*'((?:[^'\\]|\\.)*)'")
DQ = re.compile(r'text:\s*"((?:[^"\\]|\\.)*)"')

src = io.open('src/lib/cues.ts', encoding='utf-8').read()
body = src[src.index('export const CUES'):]
blocks = re.findall(r"\n  ([A-Z0-9_]+): \{\n(.*?)\n  \},\n", body, re.S)

cues = []
for cid, blk in blocks:
    sp = re.search(r"speaker: '([^']+)'", blk)
    af = re.search(r"audioFile: '([^']+)'", blk)
    sl = re.search(r"subtitleLines: \[(.*?)\n    \]", blk, re.S)
    lines = []
    if sl:
        for seg in re.finditer(r"\{[^{}]*?\}", sl.group(1), re.S):
            t = SQ.search(seg.group(0)) or DQ.search(seg.group(0))
            if t:
                lines.append(t.group(1).replace("\\'", "'").replace('\\"', '"'))
    cues.append({
        'id': cid,
        'speaker': sp.group(1) if sp else '',
        'audioFile': af.group(1) if af else '',
        'lines': lines,
    })

total = sum(len(c['lines']) for c in cues)

L = ['# 녹음된 대본 전부', '']
L.append(
    '큐 %d개 · %d줄. 화면에 나오는 그대로다 — `<br>`은 자막에서 줄이 나뉘는 자리다.'
    % (len(cues), total)
)
L += [
    '',
    '## 고치는 법',
    '',
    '1. 이 파일에서 글을 고치거나 `<br>`을 옮긴다',
    '2. `src/lib/cues.ts`의 같은 줄에 옮겨 적는다',
    '3. 글자가 바뀌었으면 음성도 다시 굽는다 — '
    '`node scripts/generate-audio.mjs --only <파일명>`',
    '   (`<br>`만 옮겼으면 굽지 않아도 된다. 음성에는 들어가지 않는다)',
    '',
    '이 파일은 `python3 scripts/dump-script.py`로 다시 뽑는다.',
    '',
    '---',
    '',
]
for c in cues:
    L.append('## %s' % WHERE.get(c['id'], c['id']))
    L.append('')
    L.append('`%s` · %s · `%s.mp3`' % (
        c['id'], NAMES.get(c['speaker'], c['speaker']), c['audioFile']
    ))
    L.append('')
    for i, t in enumerate(c['lines'], 1):
        L.append('%d. %s' % (i, t))
    L.append('')

io.open('docs/SCRIPT.md', 'w', encoding='utf-8').write('\n'.join(L))
sys.stdout.write('cues=%d lines=%d -> docs/SCRIPT.md\n' % (len(cues), total))
