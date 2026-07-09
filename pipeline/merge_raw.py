"""Merge data/raw/*.json into one deduplicated award-event list.

Dedup rule: the same paper at the same venue+year keeps only its highest
honor (a best paper is almost always also an oral; counting both would
double-credit). Test-of-time entries never collide with orals inside the
window because they honor work ~10+ years old.
"""
import sys
from collections import Counter

from common import AWARD_RANK, RAW_DIR, DATA_DIR, VENUES, load_json, dump_json, paper_key


def main():
    entries = {}
    notes = {}
    for path in sorted(RAW_DIR.glob("*.json")):
        blob = load_json(path)
        notes[path.name] = blob.get("coverage_notes", "")
        kept = skipped = 0
        for e in blob.get("entries", []):
            if not e.get("title") or e.get("venue") not in VENUES:
                skipped += 1
                continue
            if e.get("award") not in AWARD_RANK:
                skipped += 1
                continue
            e.setdefault("year_work", e["year_awarded"])
            key = paper_key(e)
            prev = entries.get(key)
            if prev is None or AWARD_RANK[e["award"]] > AWARD_RANK[prev["award"]]:
                entries[key] = e
            kept += 1
        print(f"{path.name}: kept {kept}, skipped {skipped}")

    merged = sorted(entries.values(), key=lambda e: (e["venue"], e["year_awarded"], e["title"]))
    by_type = Counter(e["award"] for e in merged)
    by_venue = Counter(e["venue"] for e in merged)
    print(f"\ntotal unique papers: {len(merged)}")
    print("by award:", dict(by_type))
    print("by venue:", dict(by_venue))

    dump_json({"coverage_notes": notes, "entries": merged}, DATA_DIR / "merged.json")
    print(f"wrote {DATA_DIR / 'merged.json'}")


if __name__ == "__main__":
    sys.exit(main())
