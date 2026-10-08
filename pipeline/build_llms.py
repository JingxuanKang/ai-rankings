"""Write site/llms.txt and site/sitemap.xml from site/data.json.

The site renders rankings client-side, and AI crawlers do not run JavaScript, so
llms.txt carries plain-text leaderboards computed with the site's default scoring
(see site/app.js computeScores: both attribution, default weights).
"""
import json
import sys
from collections import defaultdict

from common import SITE_DIR, VENUES

BASE = "https://airankings.jingxuan.uk"
WEIGHTS = {"test_of_time": 10, "best_paper": 8, "honorable_mention": 3, "oral": 1}
HALFLIFE = 5
TOP = 50


def contribs(ev):
    """Institution shares of one event; mirrors app.js contribs() with attr='both'."""
    m = defaultdict(float)
    fi, ci = ev["fi"], ev["ci"]
    sides = [(fi, 0.5), (ci, 0.5)] if fi and ci else [(fi or ci, 1.0)]
    for ids, total in sides:
        for i in ids:
            m[i] += total / len(ids)
    return m


def scores(events, insts, scope, decay_ref=None):
    tot = defaultdict(float)
    counts = defaultdict(lambda: defaultdict(int))
    for ev in events:
        w = WEIGHTS[ev["award"]]
        if decay_ref is not None:
            w *= 0.5 ** (max(0, decay_ref - ev["yw"]) / HALFLIFE)
        for i, share in contribs(ev).items():
            is_company = insts.get(i, {}).get("type") == "company"
            if (scope == "academia" and is_company) or (scope == "industry" and not is_company):
                continue
            tot[i] += w * share
            counts[i][ev["award"]] += 1
    return sorted(((i, s, counts[i]) for i, s in tot.items() if s > 1e-6), key=lambda r: -r[1])


def table(rows, insts, n):
    out = ["| Rank | Institution | Country | Score | ToT | Best | HM | Oral |",
           "|---:|---|---|---:|---:|---:|---:|---:|"]
    for rank, (i, s, c) in enumerate(rows[:n], 1):
        inst = insts.get(i, {})
        out.append(f"| {rank} | {inst.get('name', i)} | {inst.get('country') or '?'} | {s:.1f} | "
                   f"{c['test_of_time']} | {c['best_paper']} | {c['honorable_mention']} | {c['oral']} |")
    return "\n".join(out)


def main():
    data = json.loads((SITE_DIR / "data.json").read_text())
    insts, events, st = data["institutions"], data["events"], data["stats"]
    ref = max(ev["ya"] for ev in events)
    first_work = min(ev["yw"] for ev in events)

    sections = [
        "# AI Rankings",
        "",
        "> An awards-only ranking of AI research institutions. It counts only orals, best "
        "papers (incl. outstanding papers), honorable mentions and test-of-time awards at "
        f"{', '.join(VENUES)}. Regular acceptances score zero. Credit goes to the first and "
        "corresponding authors' institutions as printed on the paper at publication time.",
        "",
        f"Data snapshot: {data['generated']}. {st['papers']:,} honored papers, "
        f"{data['window']} (test-of-time awards cover work from {first_work}), "
        f"{st['resolved'] / st['papers']:.1%} affiliation-resolved, {st['institutions']:,} institutions. "
        "Built by Jingxuan Kang. Code MIT, dataset CC BY 4.0.",
        "",
        "Scoring used in the tables below (the site defaults): Test of Time = 10, Best / "
        "Outstanding Paper = 8, Honorable Mention / Award Candidate = 3, Oral = 1. Each paper "
        "splits credit 50/50 between the first author's and the corresponding author's "
        "institutions (last author when no corresponding author is flagged); multiple "
        "affiliations split equally. The all-time lens credits the year the work was done. "
        f"The present-day lens halves an award's weight every {HALFLIFE} years of the work's age "
        f"(reference year {ref}). Columns ToT/Best/HM/Oral count honored papers with any credit "
        "to that institution. On the live site every weight, filter and lens is adjustable.",
        "",
        "## Pages",
        "",
        f"- [Interactive ranking]({BASE}/): leaderboard, treemap, institution dossiers with people and award records",
        f"- [Directory view]({BASE}/classic.html): CSRankings-style expandable table",
        f"- [Dataset JSON]({BASE}/data.json): every honored paper with venue, years, award tier, authors and institution ids",
        "- [Methodology and caveats](https://raw.githubusercontent.com/JingxuanKang/ai-rankings/master/README.md)",
        "- [Source code](https://github.com/JingxuanKang/ai-rankings)",
        "",
        f"## Top {TOP} academic institutions, all-time",
        "",
        table(scores(events, insts, "academia"), insts, TOP),
        "",
        f"## Top {TOP} academic institutions, present-day lens ({HALFLIFE}-year half-life)",
        "",
        table(scores(events, insts, "academia", decay_ref=ref), insts, TOP),
        "",
        "## Top 25 industry labs, all-time",
        "",
        table(scores(events, insts, "industry"), insts, 25),
        "",
        "## Top 25 industry labs, present-day lens",
        "",
        table(scores(events, insts, "industry", decay_ref=ref), insts, 25),
        "",
    ]
    for v in VENUES:
        evs = [ev for ev in events if ev["venue"] == v]
        sections += [f"## Top 10 institutions at {v} (academia and industry, all-time)", "",
                     table(scores(evs, insts, "all"), insts, 10), ""]
    (SITE_DIR / "llms.txt").write_text("\n".join(sections))

    urls = ["/", "/classic.html", "/llms.txt"]
    (SITE_DIR / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f"  <url><loc>{BASE}{u}</loc><lastmod>{data['generated']}</lastmod></url>\n" for u in urls)
        + "</urlset>\n")
    print(f"wrote {SITE_DIR / 'llms.txt'} and sitemap.xml")


if __name__ == "__main__":
    sys.exit(main())
