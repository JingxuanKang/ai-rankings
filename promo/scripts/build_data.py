"""Derive promo numbers from ../site/data.json (same scoring as site/app.js defaults)."""
import collections, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
d = json.loads((ROOT.parent / 'site' / 'data.json').read_text())
I, E = d['institutions'], d['events']
W = {'test_of_time': 10, 'best_paper': 8, 'honorable_mention': 3, 'oral': 1}


def contribs(ev):
    m = collections.Counter()
    def add(ids, t):
        for i in ids:
            m[i] += t / len(ids)
    fi, ci = ev['fi'], ev['ci']
    if fi and ci:
        add(fi, .5); add(ci, .5)
    else:
        add(fi or ci, 1)
    return {k: v for k, v in m.items() if I.get(k, {}).get('type') != 'company'}


TIERS = list(W)  # tot, best, hm, oral
years = sorted({e['ya'] for e in E})
cum, by_tier, frames = collections.Counter(), collections.defaultdict(collections.Counter), []
for y in years:
    for e in E:
        if e['ya'] == y:
            for k, v in contribs(e).items():
                cum[k] += W[e['award']] * v
                by_tier[k][e['award']] += W[e['award']] * v
    top = cum.most_common(14)
    frames.append({'year': y, 'scores': {k: round(v, 1) for k, v in top},
                   'tiers': {k: [round(by_tier[k][t], 1) for t in TIERS] for k, _ in top}})
ids = {k for f in frames for k in f['scores']}
out = {
    'stats': {'papers': d['stats']['papers'], 'institutions': d['stats']['institutions'],
              'venues': 8, 'window': d['window'].replace('award events ', '')},
    'tierCounts': collections.Counter(e['award'] for e in E),
    'race': frames,
    'names': {k: I[k]['name'] for k in ids},
    'countries': {k: I[k]['country'] for k in ids},
}
(ROOT / 'src' / 'data.json').write_text(json.dumps(out, ensure_ascii=False, indent=1))
(ROOT / 'html' / 'data.js').write_text('window.PROMO = ' + json.dumps(out, ensure_ascii=False) + ';\n')
print(frames[-1]['scores'])
