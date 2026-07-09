"""Shared helpers for the signal-rank pipeline."""
import json
import re
import unicodedata
from pathlib import Path

PROJ = Path(__file__).resolve().parent.parent
RAW_DIR = PROJ / "data" / "raw"
DATA_DIR = PROJ / "data"
ENRICH_DIR = PROJ / "data" / "enriched"
SITE_DIR = PROJ / "site"

VENUES = ["NeurIPS", "ICML", "ICLR", "CVPR", "ICCV", "ECCV", "ACL", "EMNLP"]

# Higher rank wins when the same paper appears with several honors.
AWARD_RANK = {"oral": 0, "honorable_mention": 1, "best_paper": 2, "test_of_time": 3}


def norm_title(title: str) -> str:
    """Normalize a paper title for matching/dedup."""
    t = unicodedata.normalize("NFKD", title)
    t = t.encode("ascii", "ignore").decode("ascii")
    t = t.lower()
    t = re.sub(r"[^a-z0-9 ]+", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def paper_key(entry: dict) -> str:
    return f"{entry['venue']}|{entry['year_awarded']}|{norm_title(entry['title'])}"


def load_json(path: Path):
    with open(path) as f:
        return json.load(f)


def dump_json(obj, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
