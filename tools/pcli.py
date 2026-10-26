"""5라운드 16: 구역 안 필지 지번 검색 색인(public/pcli/h<NN>.json).
data/pcl/<구역>.json(구역마다 필지 목록)을 '동 이름 → 지번 → 구역 id들'로 뒤집어, 동 이름 해시(32칸)별 파일로 나눈다.
검색창에 동+번지(면목동 86-15 · 면목동 86 · 산 번지)를 쳤을 때만 그 동의 파일 하나를 받는다(app.js renderSugg · pcliLoad).
해시 = 동 이름 글자 코드 합 % 32 (app.js pcliH와 같은 식)."""
import json, os, glob
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(R, 'public', 'data', 'pcl'); OUT = os.path.join(R, 'public', 'pcli'); N = 32
def h(s): return sum(ord(c) for c in s) % N
def main():
    fs = sorted(glob.glob(os.path.join(SRC, '*.json')))
    if not fs: print('pcli: data/pcl 없음 — 건너뜀'); return
    idx = {}
    for f in fs:
        zid = os.path.basename(f)[:-5]
        try: j = json.load(open(f, encoding='utf-8'))
        except Exception: continue
        dm = j.get('d') or {}
        for p in j.get('p') or []:
            dong = dm.get(p[0]); jb = str(p[1]).replace(' ', '')
            if not dong or not jb: continue
            idx.setdefault(dong, {}).setdefault(jb, [])
            if zid not in idx[dong][jb]: idx[dong][jb].append(zid)
    os.makedirs(OUT, exist_ok=True)
    parts = {}
    for dong, m in idx.items():
        parts.setdefault(h(dong), {})[dong] = {k: (v[0] if len(v) == 1 else v) for k, v in sorted(m.items())}
    keep = set()
    for k in range(N):
        fn = os.path.join(OUT, f'h{k:02d}.json'); keep.add(fn)
        s = json.dumps(parts.get(k, {}), ensure_ascii=False, separators=(',', ':'), sort_keys=True)
        if not os.path.exists(fn) or open(fn, encoding='utf-8').read() != s: open(fn, 'w', encoding='utf-8').write(s)
    for fn in glob.glob(os.path.join(OUT, '*.json')):
        if fn not in keep: os.remove(fn)
    print('pcli', len(idx), '동', sum(len(m) for m in idx.values()), '지번')
if __name__ == '__main__': main()
