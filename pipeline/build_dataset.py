"""Assemble site/data.json from merged awards + OpenAlex enrichment + manual overrides.

Scoring happens client-side (weights / decay / attribution mode are live
controls), so the dataset ships raw events, one per honored paper:

  { "title", "venue", "ya" (year_awarded), "yw" (year_work), "award",
    "note", "url", "fa" (first-author name), "ca" [corresponding names],
    "fi" [inst ids of first author], "ci" [inst ids of corresponding] }

plus an institution dictionary keyed by OpenAlex id:
  { id: {"name", "type", "country"} }   type: education|company|facility|...

data/overrides.json (optional) patches enrichment per paper_key — used to
hand-fix high-weight papers (test-of-time / best paper) OpenAlex gets wrong.
"""
import datetime
import json
import sys
from collections import Counter

from common import DATA_DIR, ENRICH_DIR, SITE_DIR, load_json, dump_json, paper_key


def main():
    merged = load_json(DATA_DIR / "merged.json")["entries"]

    cache = {}
    cache_path = ENRICH_DIR / "cache.jsonl"
    if cache_path.exists():
        with open(cache_path) as f:
            for line in f:
                rec = json.loads(line)
                cache[rec["key"]] = rec["result"]

    overrides = {}
    ov_path = DATA_DIR / "overrides.json"
    if ov_path.exists():
        overrides = load_json(ov_path)

    institutions = {}
    events = []
    unresolved = Counter()

    def reg(insts):
        ids = []
        for i in insts:
            institutions.setdefault(i["id"], {
                "name": i["name"], "type": i["type"] or "unknown", "country": i["country"] or "",
            })
            ids.append(i["id"])
        return ids

    for e in merged:
        key = paper_key(e)
        enr = overrides.get(key) or cache.get(key)
        ev = {
            "title": e["title"],
            "venue": e["venue"],
            "ya": e["year_awarded"],
            "yw": e.get("year_work") or e["year_awarded"],
            "award": e["award"],
            "note": e.get("note", ""),
            "url": e.get("source_url", ""),
        }
        if enr:
            ev["fa"] = enr["first_author"]["name"]
            ev["ca"] = [c["name"] for c in enr["corresponding"]]
            ev["fi"] = reg(enr["first_author"]["institutions"])
            ci = []
            for c in enr["corresponding"]:
                ci.extend(reg(c["institutions"]))
            ev["ci"] = sorted(set(ci))
        else:
            ev["fa"], ev["ca"], ev["fi"], ev["ci"] = "", [], [], []
            unresolved[e["award"]] += 1
        events.append(ev)

    resolved = sum(1 for ev in events if ev["fi"] or ev["ci"])
    dataset = {
        "generated": datetime.date.today().isoformat(),
        "window": "award events 2021 – mid-2026",
        "stats": {
            "papers": len(events),
            "resolved": resolved,
            "institutions": len(institutions),
            "unresolved_by_award": dict(unresolved),
        },
        "institutions": institutions,
        "events": events,
    }
    dump_json(dataset, SITE_DIR / "data.json")
    # data.js twin lets index.html work over file:// (no fetch/CORS needed)
    with open(SITE_DIR / "data.js", "w") as f:
        f.write("window.SIGNAL_DATA = ")
        json.dump(dataset, f, ensure_ascii=False)
        f.write(";\n")
    print(f"events: {len(events)}, affiliation-resolved: {resolved} "
          f"({resolved/max(len(events),1):.1%}), institutions: {len(institutions)}")
    print(f"unresolved by award tier: {dict(unresolved)}")
    print(f"wrote {SITE_DIR / 'data.json'} and data.js")


if __name__ == "__main__":
    sys.exit(main())
