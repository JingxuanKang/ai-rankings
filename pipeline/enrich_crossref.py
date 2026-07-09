"""Affiliation enrichment via Crossref — the fallback for non-OpenReview venues.

IEEE deposits author affiliations for CVPR/ICCV proceedings; Springer often does
for ECCV. Coverage is partial (ACL Anthology deposits none) — whatever remains
unresolved is reported and left for the OpenAlex quota / manual overrides.

Affiliations arrive as raw strings ("Dept. of CS, Stanford University"), so we
pick the institution-looking segment and classify with the same heuristics as
the OpenReview path. Appends to the shared data/enriched/cache.jsonl.
"""
import difflib
import json
import re
import sys
import threading
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from common import ENRICH_DIR, DATA_DIR, load_json, norm_title, paper_key
from enrich_openreview import classify, canon_name, COMPANY_DOMAINS

CACHE = ENRICH_DIR / "cache.jsonl"
MAILTO = "jxkang01@gmail.com"
WORKERS = 3

COMPANY_NAMES = {v[0].lower(): v for v in COMPANY_DOMAINS.values()}
INST_KW = ("university", "universit", "institute", "college", "school", "eth", "epfl",
           "academy", "laborator", "research", "inria", "cnrs", "riken", "kaist", "mit")


def fetch(url, retries=4):
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": f"signal-rank (mailto:{MAILTO})"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except Exception:
            if i == retries - 1:
                raise
            time.sleep(2 * (i + 1))


UC_CAMPUSES = ("berkeley", "los angeles", "san diego", "santa barbara", "irvine",
               "davis", "riverside", "santa cruz", "merced", "san francisco")


def pick_org(raw: str) -> str:
    """From 'Dept. of CS, Stanford University, CA' pick the org segment."""
    segs = [s.strip() for s in re.split(r"[;,]", raw) if s.strip()]
    # rejoin campus systems split by the comma: "University of California, Berkeley"
    joined = []
    i = 0
    while i < len(segs):
        s = segs[i]
        if (i + 1 < len(segs) and s.lower() in ("university of california", "california state university", "university of texas", "university of illinois", "university of colorado", "university of maryland", "university of massachusetts", "university of north carolina")
                and (segs[i + 1].lower() in UC_CAMPUSES or segs[i + 1].lower().startswith(("at ", "austin", "urbana", "boulder", "college park", "amherst", "chapel hill")))):
            joined.append(s + ", " + segs[i + 1])
            i += 2
        else:
            joined.append(s)
            i += 1
    segs = joined
    # known company names first
    for s in segs:
        if s.lower() in COMPANY_NAMES:
            return s
    best = ""
    for s in segs:
        sl = s.lower()
        if any(k in sl for k in INST_KW) and not sl.startswith(("dept", "department", "school of", "faculty", "center for", "centre for", "institute of " if "technology" not in sl else "\x00")):
            if len(s) > len(best):
                best = s
    if best:
        return best
    for s in segs:  # any keyword segment at all
        if any(k in s.lower() for k in INST_KW):
            return s
    return segs[0] if segs else raw.strip()


def to_inst(raw: str):
    org = pick_org(raw)
    if not org:
        return None
    low = org.lower()
    if low in COMPANY_NAMES:
        name, country = COMPANY_NAMES[low]
        return {"id": "cr:" + norm_title(name).replace(" ", "-"), "name": name,
                "type": "company", "country": country}
    typ, country = classify("", org)
    return {"id": "cr:" + norm_title(org).replace(" ", "-")[:48], "name": org,
            "type": typ, "country": country}


def extract(item):
    authors = item.get("author") or []
    if not authors:
        return None
    def insts(a):
        out, seen = [], set()
        for aff in a.get("affiliation") or []:
            rec = to_inst(aff.get("name") or "")
            if rec and rec["id"] not in seen:
                seen.add(rec["id"])
                out.append(rec)
        return out
    def name(a):
        return " ".join(x for x in [a.get("given"), a.get("family")] if x)
    first = next((a for a in authors if a.get("sequence") == "first"), authors[0])
    last = authors[-1]
    fi, ci = insts(first), insts(last)
    if not fi and not ci:
        return None
    return {
        "openalex_id": None,
        "publication_year": (item.get("published") or {}).get("date-parts", [[None]])[0][0],
        "first_author": {"name": name(first), "institutions": fi},
        "corresponding": [{"name": name(last), "institutions": ci}],
        "source": "crossref",
    }


def match(entry, items):
    want = norm_title(entry["title"])
    yw = entry.get("year_work") or entry["year_awarded"]
    best, best_score = None, 0.0
    for it in items:
        got = norm_title((it.get("title") or [""])[0])
        sim = difflib.SequenceMatcher(None, want, got).ratio()
        if sim < 0.93:
            continue
        score = sim
        py = (it.get("published") or {}).get("date-parts", [[0]])[0][0] or 0
        if py and not (yw - 1 <= py <= yw + 2):
            score -= 0.2
        if any(a.get("affiliation") for a in it.get("author") or []):
            score += 0.05
        if score > best_score:
            best, best_score = it, score
    return best


def main():
    only_venues = set(sys.argv[1].split(",")) if len(sys.argv) > 1 else None
    merged = load_json(DATA_DIR / "merged.json")["entries"]
    cache = {}
    if CACHE.exists():
        with open(CACHE) as f:
            for line in f:
                rec = json.loads(line)
                cache[rec["key"]] = rec["result"]
    todo = [e for e in merged if paper_key(e) not in cache
            and (only_venues is None or e["venue"] in only_venues)]
    print(f"{len(todo)} papers to try via Crossref", flush=True)

    lock = threading.Lock()
    stats = {"done": 0, "hit": 0, "err": 0}

    def work(e):
        try:
            q = urllib.parse.quote(e["title"][:200])
            r = fetch(f"https://api.crossref.org/works?query.bibliographic={q}&rows=5&mailto={MAILTO}")
            it = match(e, r["message"]["items"])
            result = extract(it) if it else None
        except Exception:
            with lock:
                stats["err"] += 1
            time.sleep(2)
            return
        with lock:
            # only positive results are cached, so later passes (OpenAlex,
            # overrides) still see the misses as unresolved
            if result:
                out.write(json.dumps({"key": paper_key(e), "result": result}, ensure_ascii=False) + "\n")
                out.flush()
                cache[paper_key(e)] = result
                stats["hit"] += 1
            stats["done"] += 1
            if stats["done"] % 100 == 0:
                print(f"  {stats['done']}/{len(todo)} tried, {stats['hit']} hits, {stats['err']} errors", flush=True)
        time.sleep(0.2)

    with open(CACHE, "a") as out:
        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            list(pool.map(work, todo))
    print(f"crossref done: {stats['hit']}/{stats['done']} resolved, {stats['err']} errors", flush=True)


if __name__ == "__main__":
    sys.exit(main())
