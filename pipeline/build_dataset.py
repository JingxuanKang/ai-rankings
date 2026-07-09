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
import re
import sys
from collections import Counter

from common import DATA_DIR, ENRICH_DIR, SITE_DIR, load_json, dump_json, paper_key

# Cross-source canonicalization: enrichment sources key institutions three ways
# (OpenAlex ids, OpenReview "or:<domain>", manual "man:<slug>"), so merge by
# normalized display name, with aliases for the big labs' many spellings.
ALIASES = {
    "google (united states)": "Google", "google research": "Google",
    "google brain": "Google", "google inc": "Google", "google llc": "Google",
    "deepmind": "Google DeepMind", "google deepmind": "Google DeepMind",
    "meta (united states)": "Meta", "meta ai": "Meta", "meta ai research": "Meta",
    "facebook ai research": "Meta", "facebook": "Meta", "fair": "Meta",
    "meta platforms": "Meta", "meta fair": "Meta",
    "microsoft (united states)": "Microsoft", "microsoft research": "Microsoft",
    "microsoft research asia": "Microsoft", "microsoft corporation": "Microsoft",
    "amazon (united states)": "Amazon", "amazon web services": "Amazon", "aws ai": "Amazon",
    "nvidia (united states)": "NVIDIA", "nvidia corporation": "NVIDIA", "nvidia research": "NVIDIA",
    "apple (united states)": "Apple", "apple inc": "Apple",
    "ibm research": "IBM", "ibm (united states)": "IBM",
    "alibaba group": "Alibaba", "alibaba group (china)": "Alibaba", "alibaba damo academy": "Alibaba",
    "tencent (china)": "Tencent", "tencent ai lab": "Tencent",
    "bytedance (china)": "ByteDance", "bytedance inc": "ByteDance",
    "massachusetts institute of technology": "MIT", "mit csail": "MIT",
    "university of california berkeley": "UC Berkeley", "uc berkeley": "UC Berkeley",
    "berkeley ai research": "UC Berkeley",
    "carnegie mellon university": "Carnegie Mellon University",
    "eth zurich": "ETH Zürich", "eth zurich (swiss federal institute of technology)": "ETH Zürich",
    "swiss federal institute of technology lausanne": "EPFL", "epfl": "EPFL",
    "ecole polytechnique federale de lausanne": "EPFL",
    "universite de montreal": "Université de Montréal",
    "mila quebec ai institute": "Mila", "mila": "Mila", "mila quebec artificial intelligence institute": "Mila",
    "allen institute for ai": "Allen Institute for AI", "allen institute for artificial intelligence": "Allen Institute for AI", "ai2": "Allen Institute for AI",
    "korea advanced institute of science and technology": "KAIST", "kaist": "KAIST",
    "university of chinese academy of sciences": "Chinese Academy of Sciences",
    "chinese academy of sciences": "Chinese Academy of Sciences",
    "institute of automation chinese academy of sciences": "Chinese Academy of Sciences",
    "shanghai ai laboratory": "Shanghai AI Laboratory", "shanghai artificial intelligence laboratory": "Shanghai AI Laboratory",
    "openai (united states)": "OpenAI", "anthropic (united states)": "Anthropic",
    "hong kong university of science and technology": "HKUST",
    "the hong kong university of science and technology": "HKUST",
    "university of oxford": "University of Oxford", "oxford university": "University of Oxford",
    "university of cambridge": "University of Cambridge", "cambridge university": "University of Cambridge",
    "the university of tokyo": "University of Tokyo", "university of tokyo": "University of Tokyo",
    "national university of singapore": "National University of Singapore",
    "the chinese university of hong kong": "Chinese University of Hong Kong",
    "chinese university of hong kong": "Chinese University of Hong Kong",
    "the university of hong kong": "University of Hong Kong",
    "georgia institute of technology": "Georgia Tech",
    "university of illinois urbana champaign": "UIUC",
    "university of illinois at urbana champaign": "UIUC",
    "university of california los angeles": "UCLA",
    "university of california san diego": "UC San Diego",
    "university of texas at austin": "UT Austin", "the university of texas at austin": "UT Austin",
    "university of washington (seattle)": "University of Washington",
    "new york university (nyu)": "New York University",
    "johns hopkins university (jhu)": "Johns Hopkins University",
}


def norm_inst(name: str) -> str:
    n = name.lower()
    n = re.sub(r"[^a-z0-9 ]+", " ", n)
    n = re.sub(r"\s+", " ", n).strip()
    return n


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
    for ov_path in sorted(DATA_DIR.glob("overrides*.json")):
        blob = load_json(ov_path)
        print(f"overrides from {ov_path.name}: {len(blob)}")
        overrides.update(blob)

    institutions = {}
    canon_by_name = {}
    events = []
    unresolved = Counter()

    def reg(insts):
        ids = []
        for i in insts:
            display = ALIASES.get(norm_inst(i["name"]), i["name"])
            key = norm_inst(display)
            cid = canon_by_name.get(key)
            if cid is None:
                cid = "c:" + key.replace(" ", "-")[:48]
                canon_by_name[key] = cid
                institutions[cid] = {
                    "name": display, "type": i["type"] or "unknown", "country": i["country"] or "",
                }
            else:
                rec = institutions[cid]
                if rec["type"] == "unknown" and i["type"] not in ("", "unknown"):
                    rec["type"] = i["type"]
                if not rec["country"] and i["country"]:
                    rec["country"] = i["country"]
            if cid not in ids:
                ids.append(cid)
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
