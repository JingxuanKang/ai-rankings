# AI Rankings

**Live: [airankings.jingxuan.uk](https://airankings.jingxuan.uk)** · [Classic (CSRankings-style) view](https://airankings.jingxuan.uk/classic.html)

An awards-only ranking of AI institutions. The premise: paper counts have stopped meaning
anything — what still carries signal is what the community itself singles out. This site
counts **only** orals, best papers (incl. outstanding papers), honorable mentions / official
award candidates, and test-of-time prizes at eight venues:

> NeurIPS · ICML · ICLR · CVPR · ICCV · ECCV · ACL · EMNLP

Regular acceptances score **zero, by design**.

## Methodology

**Who gets credit.** Each honored paper credits the **first author's** and the
**corresponding author's** institutions *as printed on the paper at publication time*
(50 / 50 split; full credit when they coincide; an author's multiple affiliations split
equally). Where no corresponding author is flagged, the last author stands in, per AI
convention. Middle authors do not score.

**Latency, modelled.** Every award event carries two timestamps: the year it was *granted*
(`year_awarded`) and the year the work was *done* (`year_work`). A test-of-time award won in
2024 for a 2014 paper credits the lab of 2014 — "Attention Is All You Need" belongs to the
Google of 2017, not to whoever employs its authors today. The **All-time** lens credits the
year of work at full value; the **Present-day** lens decays each event by the age of the work
with an adjustable half-life, so the ranking can answer "who is strong *now*" separately from
"who built the canon".

**Default weights** (adjustable live in the UI):

| Tier | Weight |
|---|---|
| Test of Time | 10 |
| Best / Outstanding Paper | 8 |
| Honorable Mention / Award Candidate | 3 |
| Oral | 1 |

**Everything is a live control**: attribution mode (first / corresponding / both), lens and
half-life, academia vs industry scope, country, venues, tiers, and weights all recompute the
ranking client-side in real time.

## Data

- **3,564 honored papers** (award window 2021 – mid-2026; test-of-time prizes reach back to
  work from the 1990s), 100 % affiliation-resolved.
- Honors collected from official sources: OpenReview, conference award announcements,
  ACL Anthology, CVF Open Access — every entry carries a source URL.
- Affiliations resolved through three stacked routes, best first:
  1. **OpenReview author profiles** — dated position histories give the institution
     *at the year of the work*;
  2. **Crossref** authorship records (IEEE deposits affiliations for CVPR/ICCV);
  3. **PDF first pages** — batch-extracted and spot-checked; all test-of-time and
     best-paper–tier entries were individually verified by hand.
- Institution names are canonicalized across sources (diacritic folding, alias table,
  campus disambiguation). People link to their homepages where known (OpenReview profiles
  plus targeted web search).

**Known caveats.** The last-author-as-corresponding convention is an approximation; a small
tail of institutions with unresolved countries is grouped as "Unknown"; oral lists for a few
venue-years have no official roster and are documented in the footer coverage note. TPAMI is
deliberately absent (journals have no oral/best-paper mechanism; the PAMI community's
test-of-time prize — the Longuet-Higgins — is awarded at CVPR, which is covered). AAAI/IJCAI
are excluded for low signal density.

## Repository layout

```
site/       the website — pure static, no backend, no build step
            index.html (full experience) · classic.html (CSRankings-style)
            data.js / data.json (dataset) · vendor/d3.v7.min.js
pipeline/   Python data pipeline
            merge_raw.py        merge & dedupe raw award lists (highest honor wins)
            enrich_openreview.py / enrich_crossref.py / enrich_openalex.py
            build_dataset.py    canonicalize institutions -> site/data.js
data/       raw/ (collected award lists, with sources) · overrides*.json (hand-verified
            affiliations — treat as gold data) · enriched/ (resolver cache, gitignored)
```

To run locally: open `site/index.html` in a browser — `file://` works, no server needed.

To rebuild the dataset:

```bash
cd pipeline
python3 merge_raw.py
python3 enrich_openreview.py ids && python3 enrich_openreview.py resolve
python3 enrich_crossref.py CVPR,ICCV,ECCV,ACL,EMNLP
python3 build_dataset.py
```

(The OpenReview bulk endpoints sit behind a browser challenge; see the docstrings in
`enrich_openreview.py` for how note/profile dumps are staged in `data/or_cache/`.)

## Acknowledgements & license

Rankings are compiled from publicly announced conference honors. Underlying award decisions
belong to the respective conferences and program committees; affiliation records draw on
OpenReview, Crossref and the papers themselves. This project is not affiliated with any of
the conferences, with CSRankings (whose classic layout the secondary view pays homage to),
or with any ranked institution.

Code is released under the MIT License. The compiled dataset (`site/data.json`) is released
under CC BY 4.0 — cite this repository if you use it.
