"""Derive promo numbers from ../site/data.json (same scoring as site/app.js defaults) into html/data.js."""
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


# Chinese display names for every institution that can enter the race top 14
ZH = {
    'c:stanford-university': '斯坦福大学', 'c:carnegie-mellon-university': '卡内基梅隆大学',
    'c:uc-berkeley': '加州大学伯克利分校', 'c:mit': '麻省理工学院', 'c:university-of-washington': '华盛顿大学',
    'c:eth-zurich': '苏黎世联邦理工学院', 'c:university-of-oxford': '牛津大学', 'c:princeton-university': '普林斯顿大学',
    'c:tsinghua-university': '清华大学', 'c:cornell-university': '康奈尔大学', 'c:peking-university': '北京大学',
    'c:university-of-toronto': '多伦多大学', 'c:georgia-tech': '佐治亚理工学院', 'c:inria': '法国国家信息与自动化研究所',
    'c:columbia-university': '哥伦比亚大学', 'c:heidelberg-university': '海德堡大学',
    'c:goethe-university-frankfurt': '法兰克福大学', 'c:university-of-cambridge': '剑桥大学',
    'c:harvard-university': '哈佛大学', 'c:uiuc': '伊利诺伊大学厄巴纳-香槟分校',
    'c:hebrew-university-of-jerusalem': '耶路撒冷希伯来大学', 'c:university-college-london': '伦敦大学学院',
    'c:university-of-rochester': '罗切斯特大学', 'c:university-of-pennsylvania': '宾夕法尼亚大学',
    'c:friedrich-schiller-university-jena': '耶拿大学', 'c:university-of-california-irvine': '加州大学尔湾分校',
    'c:technische-universitat-darmstadt': '达姆施塔特工业大学', 'c:epfl': '洛桑联邦理工学院',
    'c:rochester-institute-of-technology': '罗切斯特理工学院',
    'c:max-planck-institute-for-intelligent-systems': '马普智能系统研究所', 'c:uc-san-diego': '加州大学圣迭戈分校',
    'c:universite-pierre-et-marie-curie': '巴黎第六大学', 'c:polytechnic-university-of-catalonia': '加泰罗尼亚理工大学',
}
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
    'names': {k: ZH.get(k, I[k]['name']) for k in ids},
    'countries': {k: I[k]['country'] for k in ids},
}
(ROOT / 'html' / 'data.js').write_text('window.PROMO = ' + json.dumps(out, ensure_ascii=False) + ';\n')
print(frames[-1]['scores'])
