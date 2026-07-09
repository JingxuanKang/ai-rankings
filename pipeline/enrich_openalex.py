"""Resolve publication-time affiliations for every merged paper via OpenAlex.

Key modelling decision (the "which Google" problem): OpenAlex authorships
carry the institutions *as stated on the paper itself*, i.e. the affiliation
at publication time. A test-of-time award for a 2014 paper therefore credits
the 2014 institution, not whatever the authors' employer is today.

Attribution targets:
  - first author  = authorship with author_position == "first" (else index 0)
  - corresponding = all authorships flagged is_corresponding; if none are
    flagged, fall back to the last author (senior-author convention in AI).

Resumable: results cached line-by-line in data/enriched/cache.jsonl.
"""
import difflib
import json
import sys
import threading
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from common import ENRICH_DIR, DATA_DIR, load_json, dump_json, norm_title, paper_key

MAILTO = "jxkang01@gmail.com"
API = "https://api.openalex.org/works"
CACHE = ENRICH_DIR / "cache.jsonl"
WORKERS = 3  # OpenAlex 429s above ~5 rps in practice; stay conservative


class FetchError(RuntimeError):
    """Transport/rate-limit failure — distinct from 'no match', never cached."""


def fetch(url, retries=6):
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": f"signal-rank (mailto:{MAILTO})"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                retry_after = e.headers.get("Retry-After")
                time.sleep(float(retry_after) if retry_after else 3 * (2 ** i))
            elif i == retries - 1:
                raise FetchError(str(e))
            else:
                time.sleep(2 ** i)
        except Exception as e:
            if i == retries - 1:
                raise FetchError(str(e))
            time.sleep(2 ** i)
    raise FetchError("rate-limited after all retries")


def candidates_for(title):
    """Query OpenAlex twice (strict title filter, then loose search)."""
    out = []
    safe = title.replace(",", " ").replace(":", " ").replace("|", " ")
    q1 = f"{API}?filter=title.search:{urllib.parse.quote(safe)}&per-page=10&mailto={MAILTO}"
    out.extend(fetch(q1).get("results", []))
    if not out:
        q2 = f"{API}?search={urllib.parse.quote(title)}&per-page=10&mailto={MAILTO}"
        out.extend(fetch(q2).get("results", []))
    return out


def pick_match(entry, cands):
    """Best candidate by title similarity + year plausibility + has affiliations."""
    want = norm_title(entry["title"])
    yw = entry.get("year_work") or entry["year_awarded"]
    best, best_score = None, 0.0
    for c in cands:
        got = norm_title(c.get("display_name") or "")
        sim = difflib.SequenceMatcher(None, want, got).ratio()
        if sim < 0.90:
            continue
        score = sim
        py = c.get("publication_year") or 0
        # preprints often predate the venue year by 1-2; anything further is suspect
        if not (yw - 3 <= py <= yw + 1):
            score -= 0.15
        if any(a.get("institutions") for a in c.get("authorships", [])):
            score += 0.05
        if score > best_score:
            best, best_score = c, score
    return best


def extract(work):
    auths = work.get("authorships", [])
    if not auths:
        return None

    def insts(a):
        out = []
        for i in a.get("institutions", []):
            if i.get("id"):
                out.append({
                    "id": i["id"].rsplit("/", 1)[-1],
                    "name": i.get("display_name", ""),
                    "type": i.get("type", ""),
                    "country": i.get("country_code", ""),
                })
        return out

    first = next((a for a in auths if a.get("author_position") == "first"), auths[0])
    corr = [a for a in auths if a.get("is_corresponding")]
    if not corr:
        corr = [auths[-1]]

    def name(a):
        return (a.get("author", {}) or {}).get("display_name", "")

    return {
        "openalex_id": work["id"].rsplit("/", 1)[-1],
        "publication_year": work.get("publication_year"),
        "first_author": {"name": name(first), "institutions": insts(first)},
        "corresponding": [{"name": name(a), "institutions": insts(a)} for a in corr],
    }


def main():
    merged = load_json(DATA_DIR / "merged.json")["entries"]
    ENRICH_DIR.mkdir(parents=True, exist_ok=True)

    cache = {}
    if CACHE.exists():
        with open(CACHE) as f:
            for line in f:
                rec = json.loads(line)
                cache[rec["key"]] = rec["result"]

    todo = [e for e in merged if paper_key(e) not in cache]
    print(f"{len(merged)} papers, {len(cache)} cached, {len(todo)} to fetch", flush=True)

    lock = threading.Lock()
    done = [0]
    errors = [0]

    def work(e):
        try:
            cands = candidates_for(e["title"])
        except FetchError as ex:
            with lock:
                errors[0] += 1
                if errors[0] % 20 == 1:
                    print(f"  !! fetch error (not cached): {ex}", flush=True)
            time.sleep(2)
            return
        m = pick_match(e, cands)
        result = extract(m) if m else None
        with lock:
            out.write(json.dumps({"key": paper_key(e), "result": result}, ensure_ascii=False) + "\n")
            out.flush()
            cache[paper_key(e)] = result
            done[0] += 1
            if done[0] % 50 == 0:
                ok = sum(1 for v in cache.values() if v)
                print(f"  {done[0]}/{len(todo)} fetched, {errors[0]} errors "
                      f"(running match rate {ok}/{len(cache)})", flush=True)
        time.sleep(0.25)

    with open(CACHE, "a") as out:
        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            list(pool.map(work, todo))

    matched = sum(1 for e in merged if cache.get(paper_key(e)))
    print(f"\nmatch rate: {matched}/{len(merged)} = {matched/len(merged):.1%}")

    unmatched = [
        {"key": paper_key(e), "title": e["title"], "venue": e["venue"],
         "year_awarded": e["year_awarded"], "award": e["award"]}
        for e in merged if not cache.get(paper_key(e))
    ]
    unmatched.sort(key=lambda u: u["award"] != "test_of_time")
    dump_json(unmatched, ENRICH_DIR / "unmatched.json")
    print(f"unmatched list -> {ENRICH_DIR / 'unmatched.json'}")


if __name__ == "__main__":
    sys.exit(main())
