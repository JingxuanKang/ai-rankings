"""Resolve publication-time affiliations via OpenReview author profiles.

Primary enrichment for OpenReview-hosted venues (ICLR, NeurIPS 2021+,
ICML 2023+). Profiles carry a dated position history, so we can answer
"which Google was that?" precisely: the institution row whose [start, end]
covers the paper's year_work.

api2.openreview.net sits behind a Turnstile challenge for plain HTTP clients,
so bulk note/profile dumps are fetched by a browser-equipped agent into
data/or_cache/; this script only consumes those files (api1 venues it can
fetch itself). Two phases:

  python3 enrich_openreview.py ids      # match titles, emit profile_ids.txt
  python3 enrich_openreview.py resolve  # profiles.jsonl -> cache.jsonl entries

Corresponding author: OpenReview does not flag one; the last author stands in
(AI senior-author convention), same fallback as the OpenAlex path.
"""
import json
import sys
import time
import urllib.parse
import urllib.request

from common import ENRICH_DIR, DATA_DIR, load_json, norm_title, paper_key

CACHE = ENRICH_DIR / "cache.jsonl"
OR_CACHE = DATA_DIR / "or_cache"
API1 = "https://api.openreview.net"

# venue-years resolvable through OpenReview; True = api1 (fetchable here)
# "inv:" prefix = old api1 years queried by invitation (no content.venueid there);
# ICLR 2015/2016 used CMT, not OpenReview — absent on purpose.
VENUEIDS = {
    ("ICLR", 2013): ("inv:ICLR.cc/2013/conference/-/submission", True),
    ("ICLR", 2014): ("inv:ICLR.cc/2014/conference/-/submission", True),
    ("ICLR", 2017): ("inv:ICLR.cc/2017/conference/-/submission", True),
    ("ICLR", 2018): ("inv:ICLR.cc/2018/Conference/-/Blind_Submission", True),
    ("ICLR", 2019): ("inv:ICLR.cc/2019/Conference/-/Blind_Submission", True),
    ("ICLR", 2020): ("ICLR.cc/2020/Conference", True),
    ("ICLR", 2021): ("ICLR.cc/2021/Conference", True),
    ("ICLR", 2022): ("ICLR.cc/2022/Conference", True),
    ("ICLR", 2023): ("ICLR.cc/2023/Conference", False),
    ("ICLR", 2024): ("ICLR.cc/2024/Conference", False),
    ("ICLR", 2025): ("ICLR.cc/2025/Conference", False),
    ("ICLR", 2026): ("ICLR.cc/2026/Conference", False),
    ("NeurIPS", 2021): ("NeurIPS.cc/2021/Conference", True),
    ("NeurIPS", 2022): ("NeurIPS.cc/2022/Conference", False),
    ("NeurIPS", 2023): ("NeurIPS.cc/2023/Conference", False),
    ("NeurIPS", 2024): ("NeurIPS.cc/2024/Conference", False),
    ("NeurIPS", 2025): ("NeurIPS.cc/2025/Conference", False),
    ("ICML", 2023): ("ICML.cc/2023/Conference", False),
    ("ICML", 2024): ("ICML.cc/2024/Conference", False),
    ("ICML", 2025): ("ICML.cc/2025/Conference", False),
}

COMPANY_DOMAINS = {
    "google.com": ("Google", "US"), "deepmind.com": ("Google DeepMind", "GB"),
    "meta.com": ("Meta", "US"), "fb.com": ("Meta", "US"), "facebook.com": ("Meta", "US"),
    "microsoft.com": ("Microsoft", "US"), "openai.com": ("OpenAI", "US"),
    "anthropic.com": ("Anthropic", "US"), "nvidia.com": ("NVIDIA", "US"),
    "apple.com": ("Apple", "US"), "amazon.com": ("Amazon", "US"), "amazon.de": ("Amazon", "US"),
    "bytedance.com": ("ByteDance", "CN"), "tencent.com": ("Tencent", "CN"),
    "alibaba-inc.com": ("Alibaba", "CN"), "baidu.com": ("Baidu", "CN"),
    "huawei.com": ("Huawei", "CN"), "ibm.com": ("IBM", "US"),
    "salesforce.com": ("Salesforce", "US"), "adobe.com": ("Adobe", "US"),
    "samsung.com": ("Samsung", "KR"), "naver.com": ("NAVER", "KR"), "kakao.com": ("Kakao", "KR"),
    "xai.ai": ("xAI", "US"), "x.ai": ("xAI", "US"), "mistral.ai": ("Mistral AI", "FR"),
    "cohere.com": ("Cohere", "CA"), "sony.com": ("Sony", "JP"), "netflix.com": ("Netflix", "US"),
    "qualcomm.com": ("Qualcomm", "US"), "intel.com": ("Intel", "US"), "amd.com": ("AMD", "US"),
    "bosch.com": ("Bosch", "DE"), "sap.com": ("SAP", "DE"), "spotify.com": ("Spotify", "SE"),
    "uber.com": ("Uber", "US"), "waymo.com": ("Waymo", "US"), "cruise.com": ("Cruise", "US"),
    "stability.ai": ("Stability AI", "GB"), "runwayml.com": ("Runway", "US"),
    "character.ai": ("Character.AI", "US"), "01.ai": ("01.AI", "CN"),
    "moonshot.cn": ("Moonshot AI", "CN"), "zhipuai.cn": ("Zhipu AI", "CN"),
    "deepseek.com": ("DeepSeek", "CN"), "sensetime.com": ("SenseTime", "CN"),
    "megvii.com": ("Megvii", "CN"), "horizon.ai": ("Horizon Robotics", "CN"),
}
CC_TLD = {"uk": "GB", "cn": "CN", "de": "DE", "fr": "FR", "jp": "JP", "kr": "KR",
    "ca": "CA", "ch": "CH", "sg": "SG", "au": "AU", "il": "IL", "in": "IN", "it": "IT",
    "nl": "NL", "se": "SE", "dk": "DK", "fi": "FI", "no": "NO", "at": "AT", "be": "BE",
    "es": "ES", "pt": "PT", "hk": "HK", "tw": "TW", "sa": "SA", "ae": "AE", "cz": "CZ",
    "pl": "PL", "ru": "RU", "br": "BR", "mx": "MX", "us": "US", "ie": "IE", "gr": "GR"}


def fetch(url, retries=5):
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "signal-rank/1.0"})
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.load(r)
        except Exception:
            if i == retries - 1:
                raise
            time.sleep(3 * (i + 1))


def notes_path(venue, year):
    return OR_CACHE / f"notes_{venue}_{year}.json"


def fetch_api1_notes(venue, year, venueid):
    """api1 needs no challenge; dump in the same format the agent uses."""
    out, offset = [], 0
    while True:
        if venueid.startswith("inv:"):
            q = f"invitation={urllib.parse.quote(venueid[4:])}"
        else:
            q = f"content.venueid={urllib.parse.quote(venueid)}"
        u = f"{API1}/notes?{q}&limit=1000&offset={offset}"
        notes = fetch(u).get("notes", [])
        if not notes:
            break
        for n in notes:
            c = n.get("content", {})
            out.append({"title": c.get("title") or "", "authors": c.get("authors") or [],
                        "authorids": c.get("authorids") or []})
        offset += 1000
        time.sleep(0.4)
    OR_CACHE.mkdir(parents=True, exist_ok=True)
    with open(notes_path(venue, year), "w") as f:
        json.dump({"notes": out}, f, ensure_ascii=False)
    print(f"  api1 {venue} {year}: {len(out)} notes", flush=True)


def load_notes(venue, year):
    p = notes_path(venue, year)
    if not p.exists():
        return None
    idx = {}
    for n in load_json(p)["notes"]:
        idx[norm_title(n["title"])] = n
    return idx


def load_cache():
    cache = {}
    if CACHE.exists():
        with open(CACHE) as f:
            for line in f:
                rec = json.loads(line)
                cache[rec["key"]] = rec["result"]
    return cache


def matchable(merged, cache):
    return [e for e in merged
            if paper_key(e) not in cache and (e["venue"], e["year_awarded"]) in VENUEIDS]


def phase_ids():
    merged = load_json(DATA_DIR / "merged.json")["entries"]
    todo = matchable(merged, load_cache())
    print(f"{len(todo)} papers to resolve via OpenReview", flush=True)

    for (venue, year) in sorted({(e["venue"], e["year_awarded"]) for e in todo}):
        vid, is_api1 = VENUEIDS[(venue, year)]
        if is_api1 and not notes_path(venue, year).exists():
            fetch_api1_notes(venue, year, vid)

    ids, missing_files, matched = set(), set(), 0
    for e in todo:
        venue, year = e["venue"], e["year_awarded"]
        idx = load_notes(venue, year)
        if idx is None:
            missing_files.add(f"{venue} {year}")
            continue
        rec = idx.get(norm_title(e["title"]))
        if rec and rec["authorids"]:
            matched += 1
            ids.add(rec["authorids"][0])
            ids.add(rec["authorids"][-1])
    with open(OR_CACHE / "profile_ids.txt", "w") as f:
        f.write("\n".join(sorted(ids)) + "\n")
    print(f"matched {matched}/{len(todo)}; {len(ids)} profile ids -> profile_ids.txt", flush=True)
    if missing_files:
        print("waiting on note dumps:", ", ".join(sorted(missing_files)), flush=True)


def _year(v, default):
    try:
        return int(v)
    except (TypeError, ValueError):
        return default


def inst_at_year(profile, year):
    hist = (profile or {}).get("history") or []
    rows = []
    for h in hist:
        inst = h.get("institution") or {}
        if not inst.get("name") and not inst.get("domain"):
            continue
        rows.append((_year(h.get("start"), 0), _year(h.get("end"), 9999), inst))
    live = [r for r in rows if r[0] <= year <= r[1]]
    if not live:
        past = sorted((r for r in rows if r[0] <= year), key=lambda r: -r[0])
        live = past[:1] if past else sorted(rows, key=lambda r: r[0])[:1]
    out, seen = [], set()
    for _, _, inst in live:
        domain = (inst.get("domain") or "").lower().strip()
        name = clean_inst_name(inst.get("name") or domain)
        typ, country = classify(domain, name)
        rec = {"id": "or:" + (domain or norm_title(name).replace(" ", "-")),
               "name": canon_name(domain, name), "type": typ, "country": country}
        if rec["id"] not in seen:
            seen.add(rec["id"])
            out.append(rec)
    return out


ORG_KW = ("university", "universit", "institute", "college", "school", "eth", "epfl",
          "academy", "laborator", "research", "corporation", "inc", "google", "microsoft")


def clean_inst_name(name):
    """'Computer Science Department, Stanford University' -> 'Stanford University'."""
    if "," not in name:
        return name
    segs = [s.strip() for s in name.split(",") if s.strip()]
    cands = [s for s in segs if any(k in s.lower() for k in ORG_KW)
             and not s.lower().startswith(("department", "dept", "school of", "faculty",
                                           "college of engineering", "division"))]
    return max(cands, key=len) if cands else name


def canon_name(domain, name):
    if domain in COMPANY_DOMAINS:
        return COMPANY_DOMAINS[domain][0]
    return name


def classify(domain, name):
    if domain in COMPANY_DOMAINS:
        return "company", COMPANY_DOMAINS[domain][1]
    nl = (name or "").lower()
    parts = domain.split(".") if domain else []
    country = ""
    if parts:
        if parts[-1] in CC_TLD:
            country = CC_TLD[parts[-1]]
        elif parts[-1] in ("edu", "gov"):
            country = "US"
    if (parts and parts[-1] == "edu") or ".edu." in ("." + domain) or ".ac." in ("." + domain):
        return "education", country
    if parts and parts[-1] in ("ai", "io"):
        return "company", country
    for kw in ("university", "universit", "institute of technology", "college",
               "école", "ecole", "eth zurich", "epfl", "school of", "academy of sciences"):
        if kw in nl:
            return "education", country
    if parts and parts[-1] == "gov":
        return "government", country
    for kw in (" inc", " ltd", " llc", " corp", "technologies", " labs"):
        if nl.endswith(kw):
            return "company", country
    return "unknown", country


def phase_resolve(final=False):
    """final=False (incremental): only write papers with BOTH sides resolved,
    so entries aren't frozen half-done while the profile crawl is running.
    final=True: accept one-sided results for authors whose profile is gone."""
    merged = load_json(DATA_DIR / "merged.json")["entries"]
    cache = load_cache()
    todo = matchable(merged, cache)

    profiles = {}
    pj = OR_CACHE / "profiles.jsonl"
    if not pj.exists():
        print("profiles.jsonl not there yet", flush=True)
        return 1
    with open(pj) as f:
        for line in f:
            p = json.loads(line)
            content = p.get("content", {})
            keys = {p.get("id", "")}
            for em in (content.get("emailsConfirmed") or []) + (content.get("emails") or []):
                keys.add(em)
            for nm in content.get("names") or []:
                if nm.get("username"):
                    keys.add(nm["username"])
            for k in keys:
                if k:
                    profiles[k] = content
    print(f"profiles loaded: {len(profiles)} keys", flush=True)

    n_ok = 0
    with open(CACHE, "a") as out:
        for e in todo:
            idx = load_notes(e["venue"], e["year_awarded"])
            rec = idx.get(norm_title(e["title"])) if idx else None
            if not rec or not rec["authorids"]:
                continue
            first, last = rec["authorids"][0], rec["authorids"][-1]
            fi = inst_at_year(profiles.get(first), e["year_work"])
            ci = inst_at_year(profiles.get(last), e["year_work"])
            if final:
                if not fi and not ci:
                    continue
            elif not fi or not ci:
                continue
            result = {
                "openalex_id": None,
                "publication_year": e["year_work"],
                "first_author": {"name": (rec["authors"] or [""])[0], "institutions": fi},
                "corresponding": [{"name": (rec["authors"] or [""])[-1], "institutions": ci}],
                "source": "openreview-profiles",
            }
            out.write(json.dumps({"key": paper_key(e), "result": result}, ensure_ascii=False) + "\n")
            cache[paper_key(e)] = result
            n_ok += 1
    total = sum(1 for e in merged if cache.get(paper_key(e)))
    print(f"wrote {n_ok} enrichments; total resolved now {total}/{len(merged)}", flush=True)


if __name__ == "__main__":
    phase = sys.argv[1] if len(sys.argv) > 1 else "ids"
    if phase == "ids":
        sys.exit(phase_ids())
    sys.exit(phase_resolve(final="--final" in sys.argv))
