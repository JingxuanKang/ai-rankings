/* Signal Rank — client. All scoring is live: weights, attribution, decay,
   industry and venue filters recompute from raw events on every change. */
(function () {
'use strict';

const DATA = window.SIGNAL_DATA;
if (!DATA || !DATA.events || !DATA.events.length) {
  document.body.innerHTML = '<p style="padding:80px;text-align:center;color:#b5b2a3">' +
    'data.js is missing or empty — run the pipeline (see README).</p>';
  return;
}

/* ── constants ─────────────────────────────────────────────────────────── */
const TIERS = [
  { id: 'test_of_time',      label: 'Test of Time',      color: '#ffd76a', w: 10, max: 15, step: 0.5 },
  { id: 'best_paper',        label: 'Best Paper',        color: '#e6ae3d', w: 8,  max: 12, step: 0.5 },
  { id: 'honorable_mention', label: 'Honorable Mention', color: '#b98a2e', w: 3,  max: 8,  step: 0.5 },
  { id: 'oral',              label: 'Oral',              color: '#8f6b26', w: 1,  max: 5,  step: 0.25 },
];
const TIER_BY_ID = Object.fromEntries(TIERS.map(t => [t.id, t]));
const VENUES = ['NeurIPS', 'ICML', 'ICLR', 'CVPR', 'ICCV', 'ECCV', 'ACL', 'EMNLP'];
const INSTS = DATA.institutions;
const EVENTS = DATA.events;
const REF_YEAR = Math.max(...EVENTS.map(e => e.ya));
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TYPE_TAG = { company: 'industry', government: 'gov lab', nonprofit: 'nonprofit',
  facility: 'facility', healthcare: 'health', archive: 'archive', other: 'org', unknown: '' };

const state = {
  attr: 'both',          // both | first | corr
  lens: 'alltime',       // alltime | now
  halflife: 5,
  industry: true,
  venues: new Set(VENUES),
  weights: Object.fromEntries(TIERS.map(t => [t.id, t.w])),
  view: 'chart',
  axis: 'yw',            // canon x axis: yw | ya
  boardLimit: 25,
  selected: null,        // inst id in dossier
};

const $ = id => document.getElementById(id);
const fmt = n => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  : n >= 100 ? String(Math.round(n)) : (Math.round(n * 10) / 10).toString();
const flagOf = cc => cc && cc.length === 2
  ? String.fromCodePoint(...[...cc.toUpperCase()].map(c => 0x1F1A5 + c.charCodeAt(0))) : '';

/* ── scoring engine ────────────────────────────────────────────────────── */
function eventWeight(ev) {
  let w = state.weights[ev.award];
  if (state.lens === 'now') w *= Math.pow(0.5, Math.max(0, REF_YEAR - ev.yw) / state.halflife);
  return w;
}

/* share of one event per institution, honoring attribution mode.
   Sides sum to 1; an unresolved side folds into the other. */
function contribs(ev) {
  const m = new Map();
  const add = (ids, total) => {
    if (!ids.length || total <= 0) return;
    const s = total / ids.length;
    for (const id of ids) m.set(id, (m.get(id) || 0) + s);
  };
  const { fi, ci } = ev;
  if (state.attr === 'first')      add(fi.length ? fi : ci, 1);
  else if (state.attr === 'corr')  add(ci.length ? ci : fi, 1);
  else {
    if (fi.length && ci.length) { add(fi, 0.5); add(ci, 0.5); }
    else add(fi.length ? fi : ci, 1);
  }
  if (!state.industry) for (const id of m.keys())
    if ((INSTS[id] || {}).type === 'company') m.delete(id);
  return m;
}

function roleOf(ev, instId) {
  const f = ev.fi.includes(instId), c = ev.ci.includes(instId);
  return f && c ? '1st + corr' : f ? '1st author' : c ? 'corresponding' : '';
}

/* full aggregation for current state (optionally overriding parts) */
function computeScores(opts = {}) {
  const maxYa = opts.maxYa ?? Infinity;
  const noDecay = opts.noDecay ?? false;
  const byInst = new Map();
  let papersInView = 0;
  for (const ev of EVENTS) {
    if (!state.venues.has(ev.venue) || ev.ya > maxYa) continue;
    papersInView++;
    let w = noDecay ? state.weights[ev.award] : eventWeight(ev);
    if (w <= 0) continue;
    for (const [id, share] of contribs(ev)) {
      let rec = byInst.get(id);
      if (!rec) byInst.set(id, rec = {
        id, total: 0, byTier: {}, counts: {}, byYear: new Map(), events: [],
      });
      const v = w * share;
      rec.total += v;
      rec.byTier[ev.award] = (rec.byTier[ev.award] || 0) + v;
      rec.counts[ev.award] = (rec.counts[ev.award] || 0) + 1;
      const y = state.axis === 'yw' ? ev.yw : ev.ya;
      rec.byYear.set(y, (rec.byYear.get(y) || 0) + v);
      rec.events.push({ ev, v, share });
    }
  }
  const ranking = [...byInst.values()].filter(r => r.total > 1e-6)
    .sort((a, b) => b.total - a.total);
  ranking.forEach((r, i) => r.rank = i + 1);
  return { ranking, byInst, papersInView };
}

/* ── tooltip ───────────────────────────────────────────────────────────── */
const tip = $('tooltip');
function showTip(x, y, build) {
  tip.replaceChildren();
  build(tip);
  tip.hidden = false;
  const r = tip.getBoundingClientRect();
  tip.style.left = Math.min(x + 14, innerWidth - r.width - 10) + 'px';
  tip.style.top = Math.min(y + 14, innerHeight - r.height - 10) + 'px';
}
function hideTip() { tip.hidden = true; }
function ttEl(cls, text, tag = 'div') {
  const el = document.createElement(tag); el.className = cls; el.textContent = text; return el;
}

/* ── KPIs ──────────────────────────────────────────────────────────────── */
function countUp(el, target) {
  if (REDUCED) { el.textContent = target.toLocaleString(); return; }
  const t0 = performance.now(), dur = 1100;
  (function tick(t) {
    const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * e).toLocaleString();
    if (p < 1) requestAnimationFrame(tick);
  })(t0);
}
function initKPIs() {
  countUp($('kpi-papers'), DATA.stats.papers);
  countUp($('kpi-insts'), DATA.stats.institutions);
  $('kpi-venues').textContent = VENUES.length;
  $('kpi-window').textContent = '2021 – ' + REF_YEAR;
}

/* ── podium ────────────────────────────────────────────────────────────── */
function renderPodium(ranking) {
  const box = $('podium');
  box.replaceChildren();
  const order = [1, 0, 2]; // silver, gold, bronze card order
  const medals = ['first', 'second', 'third'];
  for (const idx of order) {
    const r = ranking[idx];
    if (!r) continue;
    const inst = INSTS[r.id] || { name: r.id };
    const card = document.createElement('button');
    card.className = 'podium-card p' + (idx + 1);
    card.append(
      ttEl('laurel', idx === 0 ? '🏆' : idx === 1 ? '🥈' : '🥉'),
      ttEl('podium-medal', medals[idx]),
      ttEl('podium-name', inst.name),
      ttEl('podium-score', fmt(r.total)),
      ttEl('podium-breakdown',
        TIERS.map(t => r.counts[t.id] ? `${r.counts[t.id]} ${t.label.toLowerCase()}${r.counts[t.id] > 1 && t.id !== 'test_of_time' ? 's' : ''}` : '')
          .filter(Boolean).join(' · ')),
    );
    card.addEventListener('click', () => openDossier(r.id));
    box.append(card);
  }
}

/* ── the board (FLIP-animated bars) ────────────────────────────────────── */
const ROW_H = 38;
function renderBoard(res) {
  const { ranking } = res;
  const board = $('board');
  const shown = ranking.slice(0, state.boardLimit);
  const maxScore = shown.length ? shown[0].total : 1;
  const seen = new Set();

  for (const r of shown) {
    seen.add(r.id);
    let row = board.querySelector(`[data-inst="${CSS.escape(r.id)}"]`);
    if (!row) {
      row = document.createElement('div');
      row.className = 'board-row';
      row.dataset.inst = r.id;
      row.style.transform = `translateY(${(r.rank - 1) * ROW_H}px)`;
      const rank = ttEl('board-rank', '');
      const name = ttEl('board-name', '');
      const bar = ttEl('board-bar', '');
      const stack = ttEl('board-stack', '');
      bar.append(stack, ttEl('board-score', '', 'span'));
      row.append(rank, name, bar);
      row.addEventListener('click', () => openDossier(row.dataset.inst));
      row.addEventListener('pointermove', e => boardTip(e, row.dataset.inst));
      row.addEventListener('pointerleave', hideTip);
      board.append(row);
    }
    const inst = INSTS[r.id] || { name: r.id, type: 'unknown', country: '' };
    const rankEl = row.children[0];
    rankEl.textContent = r.rank;
    rankEl.className = 'board-rank' + (r.rank <= 3 ? ' medal' : '');
    const nameEl = row.children[1];
    nameEl.replaceChildren(ttEl('nm', `${flagOf(inst.country)} ${inst.name}`.trim(), 'span'));
    const tag = TYPE_TAG[inst.type];
    if (tag) nameEl.append(ttEl('type-tag', tag, 'span'));
    const stack = row.children[2].firstChild;
    // leave room for the value label at the data end
    stack.style.width = `calc((100% - 64px) * ${(r.total / maxScore).toFixed(4)})`;
    stack.replaceChildren(...TIERS.filter(t => r.byTier[t.id] > 0).map(t => {
      const seg = ttEl('board-seg', '', 'span');
      seg.style.width = (r.byTier[t.id] / r.total * 100) + '%';
      seg.style.background = t.color;
      return seg;
    }));
    row.children[2].lastChild.textContent = fmt(r.total);
    row.__data = r;
    requestAnimationFrame(() => { row.style.transform = `translateY(${(r.rank - 1) * ROW_H}px)`; });
  }
  for (const row of [...board.children]) if (!seen.has(row.dataset.inst)) row.remove();
  board.style.height = shown.length * ROW_H + 'px';

  $('board-more').textContent = state.boardLimit <= 25 ? 'show top 50' : 'show top 25';
  renderBoardTable(ranking);
}

function boardTip(e, instId) {
  const row = $('board').querySelector(`[data-inst="${CSS.escape(instId)}"]`);
  const r = row && row.__data;
  if (!r) return;
  const inst = INSTS[instId] || { name: instId };
  showTip(e.clientX, e.clientY, box => {
    box.append(ttEl('tt-value', fmt(r.total) + ' pts'), ttEl('tt-label', inst.name));
    for (const t of TIERS) {
      if (!r.counts[t.id]) continue;
      const rowEl = ttEl('tt-row', '');
      const key = ttEl('tt-key', '', 'span'); key.style.background = t.color;
      rowEl.append(key, ttEl('', `${t.label} × ${r.counts[t.id]} → ${fmt(r.byTier[t.id])}`, 'span'));
      box.append(rowEl);
    }
    box.append(ttEl('tt-label', 'click for the record'));
  });
}

function renderBoardTable(ranking) {
  const wrap = $('board-table-wrap');
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  for (const h of ['#', 'Institution', 'Type', 'Score', ...TIERS.map(t => t.label)])
    hr.append(ttEl('', h, 'th'));
  thead.append(hr); table.append(thead);
  const tbody = document.createElement('tbody');
  for (const r of ranking.slice(0, 100)) {
    const inst = INSTS[r.id] || { name: r.id, type: '', country: '' };
    const tr = document.createElement('tr');
    for (const cell of [r.rank, `${inst.name}${inst.country ? ' (' + inst.country + ')' : ''}`,
      TYPE_TAG[inst.type] || 'academia', fmt(r.total),
      ...TIERS.map(t => r.counts[t.id] || 0)])
      tr.append(ttEl('', String(cell), 'td'));
    tr.addEventListener('click', () => openDossier(r.id));
    tbody.append(tr);
  }
  table.append(tbody);
  wrap.replaceChildren(table);
}

/* ── the canon (canvas beeswarm of every honored paper) ────────────────── */
const canon = $('canon');
const canonCtx = canon.getContext('2d');
let canonPts = [], canonQt = null;
const hash01 = s => { let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000) / 1000; };

function renderCanon() {
  const wrap = canon.parentElement;
  const W = wrap.clientWidth, laneH = 46, padL = 74, padR = 26, padT = 18;
  const H = padT + VENUES.length * laneH + 10;
  const dpr = devicePixelRatio || 1;
  canon.width = W * dpr; canon.height = H * dpr;
  canon.style.height = H + 'px';
  canonCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  canonCtx.clearRect(0, 0, W, H);

  const evs = EVENTS.filter(e => state.venues.has(e.venue));
  const xs = evs.map(e => state.axis === 'yw' ? e.yw : e.ya);
  const x0 = Math.min(...xs), x1 = Math.max(...xs, REF_YEAR);
  const x = d3.scaleLinear().domain([x0 - 0.5, x1 + 0.5]).range([padL, W - padR]);
  const laneY = v => padT + VENUES.indexOf(v) * laneH + laneH / 2;
  const rOf = e => ({ test_of_time: 5, best_paper: 4, honorable_mention: 2.6, oral: 1.7 })[e.award];

  // lane separators + labels
  canonCtx.strokeStyle = '#232329'; canonCtx.lineWidth = 1;
  canonCtx.font = '11px system-ui'; canonCtx.textAlign = 'left'; canonCtx.textBaseline = 'middle';
  VENUES.forEach((v, i) => {
    const yTop = padT + i * laneH;
    if (i) { canonCtx.beginPath(); canonCtx.moveTo(padL - 60, yTop); canonCtx.lineTo(W - padR, yTop); canonCtx.stroke(); }
    canonCtx.fillStyle = '#807d72';
    canonCtx.fillText(v, 12, yTop + laneH / 2);
  });
  // year gridlines
  const step = (x1 - x0) > 14 ? 5 : 1;
  for (let yy = Math.ceil(x0 / step) * step; yy <= x1; yy += step) {
    canonCtx.strokeStyle = '#1c1c22';
    canonCtx.beginPath(); canonCtx.moveTo(x(yy), padT - 6); canonCtx.lineTo(x(yy), H - 6); canonCtx.stroke();
  }
  // axis labels (html strip below canvas)
  const axisBox = $('canon-axis');
  axisBox.replaceChildren();
  for (let yy = Math.ceil(x0 / step) * step; yy <= x1; yy += step) {
    const s = document.createElement('span');
    s.textContent = yy; s.style.left = (x(yy) / W * 100) + '%';
    axisBox.append(s);
  }

  // latency arcs: year-of-work axis → tie ToT dots to the year they were awarded
  if (state.axis === 'yw') {
    canonCtx.strokeStyle = 'rgba(255,215,106,0.16)'; canonCtx.lineWidth = 1;
    for (const e of evs) {
      if (e.award !== 'test_of_time' || e.yw === e.ya) continue;
      const y = laneY(e.venue), xa = x(e.yw), xb = x(e.ya);
      canonCtx.beginPath();
      canonCtx.moveTo(xa, y);
      canonCtx.quadraticCurveTo((xa + xb) / 2, y - laneH * 0.7, xb, y);
      canonCtx.stroke();
    }
  }

  // dots (orals first so prizes render on top)
  canonPts = [];
  const sorted = [...evs].sort((a, b) => rOf(a) - rOf(b));
  for (const e of sorted) {
    const t = TIER_BY_ID[e.award];
    const px = x(state.axis === 'yw' ? e.yw : e.ya) + (hash01(e.title) - 0.5) * 9;
    const py = laneY(e.venue) + (hash01(e.title + '|y') - 0.5) * (laneH - 14);
    const r = rOf(e);
    canonCtx.beginPath();
    canonCtx.globalAlpha = e.award === 'oral' ? 0.55 : 0.95;
    if (e.award === 'test_of_time' || e.award === 'best_paper') {
      canonCtx.shadowColor = t.color; canonCtx.shadowBlur = 9;
    } else canonCtx.shadowBlur = 0;
    canonCtx.fillStyle = t.color;
    canonCtx.arc(px, py, r, 0, Math.PI * 2);
    canonCtx.fill();
    canonPts.push({ x: px, y: py, e });
  }
  canonCtx.globalAlpha = 1; canonCtx.shadowBlur = 0;
  canonQt = d3.quadtree(canonPts, p => p.x, p => p.y);
}

canon.addEventListener('pointermove', e => {
  if (!canonQt) return;
  const rect = canon.getBoundingClientRect();
  const p = canonQt.find(e.clientX - rect.left, e.clientY - rect.top, 24);
  canon.style.cursor = p ? 'pointer' : 'default';
  if (!p) { hideTip(); return; }
  const ev = p.e, t = TIER_BY_ID[ev.award];
  showTip(e.clientX, e.clientY, box => {
    box.append(ttEl('tt-value', ev.title));
    const rowEl = ttEl('tt-row', '');
    const key = ttEl('tt-key', '', 'span'); key.style.background = t.color;
    rowEl.append(key, ttEl('', `${t.label} · ${ev.venue} ${ev.ya}` +
      (ev.yw !== ev.ya ? ` — for work of ${ev.yw}` : ''), 'span'));
    box.append(rowEl);
    const who = [ev.fa, ...(ev.ca || [])].filter(Boolean);
    const insts = [...new Set([...ev.fi, ...ev.ci].map(i => (INSTS[i] || {}).name).filter(Boolean))];
    if (who.length) box.append(ttEl('tt-label', who.join(' · ')));
    if (insts.length) box.append(ttEl('tt-label', insts.join(' · ')));
  });
});
canon.addEventListener('pointerleave', hideTip);
canon.addEventListener('click', e => {
  if (!canonQt) return;
  const rect = canon.getBoundingClientRect();
  const p = canonQt.find(e.clientX - rect.left, e.clientY - rect.top, 24);
  if (p && p.e.url) open(p.e.url, '_blank', 'noopener');
});

/* ── trajectories (bump chart, cumulative by award year) ───────────────── */
function renderBump() {
  const svg = d3.select('#bump');
  const wrapW = svg.node().parentElement.clientWidth;
  const years = d3.range(2021, REF_YEAR + 1);
  const perYear = years.map(y => computeScores({ maxYa: y, noDecay: true }).ranking);
  const finalRank = new Map(perYear[perYear.length - 1].map(r => [r.id, r.rank]));
  const shown = perYear[perYear.length - 1].slice(0, 12).map(r => r.id);

  const series = shown.map(id => ({
    id, name: (INSTS[id] || { name: id }).name,
    pts: years.map((y, i) => {
      const rec = perYear[i].find(r => r.id === id);
      return { year: y, rank: rec ? rec.rank : null };
    }).filter(p => p.rank),
    final: finalRank.get(id),
  }));

  const maxRank = Math.min(20, d3.max(series.flatMap(s => s.pts.map(p => p.rank))) || 12);
  const M = { t: 16, r: 230, b: 28, l: 40 };
  const W = Math.max(wrapW, 640), H = 380;
  svg.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  svg.selectAll('*').remove();
  const x = d3.scalePoint().domain(years).range([M.l, W - M.r]);
  const y = d3.scaleLinear().domain([1, maxRank]).range([M.t + 8, H - M.b - 8]);
  const line = d3.line().x(p => x(p.year)).y(p => Math.min(y(p.rank), H - M.b))
    .curve(d3.curveMonotoneX);

  svg.selectAll('.bump-year').data(years).join('text')
    .attr('class', 'bump-year').attr('x', d => x(d)).attr('y', H - 8)
    .attr('text-anchor', 'middle').text(d => d);
  svg.selectAll('.bump-rank').data([1, 5, 10, Math.min(15, maxRank)].filter((v, i, a) => v <= maxRank && a.indexOf(v) === i))
    .join('text').attr('class', 'bump-rank')
    .attr('x', M.l - 14).attr('y', d => y(d) + 3).attr('text-anchor', 'end').text(d => '#' + d);

  const g = svg.append('g');
  const hover = (id, on) => {
    g.selectAll('.bump-line').classed('hot', d => on && d.id === id);
    g.selectAll('.bump-dot').classed('hot', d => on && d.id === id);
    svg.selectAll('.bump-label').classed('hot', d => on && d.id === id);
    if (on) { // lift the hot line
      g.selectAll('.bump-line').filter(d => d.id === id).raise();
      g.selectAll('.bump-dot').filter(d => d.id === id).raise();
    }
  };

  g.selectAll('.bump-line').data(series).join('path')
    .attr('class', 'bump-line').attr('d', d => line(d.pts));
  // fat invisible hit strokes
  g.selectAll('.bump-hit').data(series).join('path')
    .attr('d', d => line(d.pts))
    .attr('fill', 'none').attr('stroke', 'transparent').attr('stroke-width', 16)
    .style('cursor', 'pointer')
    .on('pointerenter', (e, d) => hover(d.id, true))
    .on('pointerleave', (e, d) => { hover(d.id, false); hideTip(); })
    .on('pointermove', (e, d) => {
      const px = d3.pointer(e, svg.node())[0];
      const yr = years[d3.leastIndex(years, a => Math.abs(x(a) - px))];
      const pt = d.pts.find(p => p.year === yr);
      showTip(e.clientX, e.clientY, box => {
        box.append(ttEl('tt-value', d.name),
          ttEl('tt-label', pt ? `#${pt.rank} after ${yr} awards season` : `finished #${d.final}`));
      });
    })
    .on('click', (e, d) => openDossier(d.id));

  const dots = series.flatMap(s => s.pts.map(p => ({ id: s.id, ...p })));
  g.selectAll('.bump-dot').data(dots).join('circle')
    .attr('class', 'bump-dot').attr('r', 4)
    .attr('cx', d => x(d.year)).attr('cy', d => Math.min(y(d.rank), H - M.b));

  svg.selectAll('.bump-label').data(series).join('text')
    .attr('class', 'bump-label')
    .attr('x', W - M.r + 14)
    .attr('y', d => Math.min(y(d.pts[d.pts.length - 1].rank), H - M.b) + 4)
    .text(d => `#${d.final}  ${d.name}`)
    .style('cursor', 'pointer')
    .on('pointerenter', (e, d) => hover(d.id, true))
    .on('pointerleave', (e, d) => hover(d.id, false))
    .on('click', (e, d) => openDossier(d.id));
}

/* ── dossier ───────────────────────────────────────────────────────────── */
let lastRes = null;
function openDossier(instId) {
  state.selected = instId;
  const r = lastRes && lastRes.byInst.get(instId);
  const inst = INSTS[instId] || { name: instId, type: '', country: '' };
  if (!r) return;
  $('dossier-rank').textContent = 'Nº ' + r.rank;
  $('dossier-name').textContent = inst.name;
  $('dossier-meta').textContent = [
    TYPE_TAG[inst.type] || 'academia', inst.country,
    r.events.length + ' honored papers',
  ].filter(Boolean).join(' · ');
  $('dossier-score').textContent = fmt(r.total);

  $('dossier-tiers').replaceChildren(...TIERS.filter(t => r.counts[t.id]).map(t => {
    const chip = ttEl('tier-chip', '', 'span');
    const dot = ttEl('tier-dot', '', 'span'); dot.style.background = t.color;
    const b = document.createElement('b'); b.textContent = r.counts[t.id];
    chip.append(dot, b, document.createTextNode(' ' + t.label));
    return chip;
  }));

  // sparkline: score by year (current axis), gold columns
  const spark = d3.select('#dossier-spark');
  spark.selectAll('*').remove();
  const entries = [...r.byYear.entries()].sort((a, b) => a[0] - b[0]);
  if (entries.length) {
    const sw = spark.node().clientWidth || 420, sh = 84, pb = 16;
    spark.attr('viewBox', `0 0 ${sw} ${sh}`);
    const ys = entries.map(e => e[0]);
    const yMin = Math.min(...ys), yMax = Math.max(...ys);
    const xs = d3.scaleBand().domain(d3.range(yMin, yMax + 1)).range([0, sw]).padding(0.25);
    const vmax = d3.max(entries, e => e[1]);
    const vs = d3.scaleLinear().domain([0, vmax]).range([0, sh - pb - 8]);
    for (const [yy, v] of entries) {
      spark.append('rect')
        .attr('x', xs(yy)).attr('width', Math.min(xs.bandwidth(), 24))
        .attr('y', sh - pb - vs(v)).attr('height', Math.max(1, vs(v)))
        .attr('rx', 2).attr('fill', '#b98a2e')
        .append('title').text(`${yy}: ${fmt(v)} pts`);
    }
    spark.append('text').attr('x', 0).attr('y', sh - 2)
      .attr('fill', '#807d72').attr('font-size', 10).text(yMin);
    spark.append('text').attr('x', sw).attr('y', sh - 2).attr('text-anchor', 'end')
      .attr('fill', '#807d72').attr('font-size', 10).text(yMax);
  }

  // venue breakdown — nominal categories, one hue, labels carry identity
  const byVenue = {};
  for (const { ev, v } of r.events) byVenue[ev.venue] = (byVenue[ev.venue] || 0) + v;
  const vmax2 = Math.max(...Object.values(byVenue));
  $('dossier-venues').replaceChildren(...VENUES.filter(v => byVenue[v]).map(v => {
    const rowEl = ttEl('venue-bar-row', '');
    const track = ttEl('vb-track', '');
    const fill = ttEl('vb-fill', '');
    fill.style.width = (byVenue[v] / vmax2 * 100) + '%';
    track.append(fill);
    rowEl.append(ttEl('vb-name', v, 'span'), track, ttEl('vb-val', fmt(byVenue[v]), 'span'));
    return rowEl;
  }));

  const items = [...r.events].sort((a, b) => b.v - a.v || b.ev.ya - a.ev.ya).slice(0, 120);
  $('dossier-list').replaceChildren(...items.map(({ ev }) => {
    const li = document.createElement('li');
    const dot = ttEl('tier-dot', '', 'span');
    dot.style.background = TIER_BY_ID[ev.award].color;
    const body = document.createElement('div');
    const title = ttEl('aw-title', '');
    if (ev.url) {
      const a = document.createElement('a');
      a.href = ev.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = ev.title;
      title.append(a);
    } else title.textContent = ev.title;
    const meta = ttEl('aw-meta',
      `${ev.venue} ${ev.ya} · ${TIER_BY_ID[ev.award].label}` +
      (ev.yw !== ev.ya ? ` (work of ${ev.yw})` : '') +
      (ev.note ? ` · ${ev.note}` : ''));
    const role = roleOf(ev, instId);
    if (role) meta.append(ttEl('role-tag', role, 'span'));
    body.append(title, meta);
    li.append(dot, body);
    return li;
  }));

  $('dossier').hidden = false;
  $('scrim').hidden = false;
}
function closeDossier() {
  state.selected = null;
  $('dossier').hidden = true;
  $('scrim').hidden = true;
}
$('dossier-close').addEventListener('click', closeDossier);
$('scrim').addEventListener('click', closeDossier);
addEventListener('keydown', e => { if (e.key === 'Escape') closeDossier(); });

/* ── legend / controls ─────────────────────────────────────────────────── */
function initLegend() {
  $('tier-legend').replaceChildren(...TIERS.map(t => {
    const item = ttEl('legend-item', '', 'span');
    const sw = ttEl('legend-swatch', '', 'span'); sw.style.background = t.color;
    item.append(sw, document.createTextNode(`${t.label} × ${state.weights[t.id]}`));
    return item;
  }));
}

function initControls() {
  const bindSeg = (id, key, after) => {
    $(id).addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      for (const x of $(id).children) x.classList.toggle('on', x === b);
      state[key] = b.dataset.v;
      (after || rerender)();
    });
  };
  bindSeg('seg-attr', 'attr');
  bindSeg('seg-lens', 'lens', () => {
    $('halflife-wrap').hidden = state.lens !== 'now';
    rerender();
  });
  bindSeg('seg-axis', 'axis', () => { rerender(); });
  bindSeg('seg-view', 'view', () => {
    $('board').hidden = state.view !== 'chart';
    $('board-more').hidden = state.view !== 'chart';
    $('board-table-wrap').hidden = state.view !== 'table';
  });

  $('halflife').addEventListener('input', e => {
    state.halflife = +e.target.value;
    $('halflife-out').textContent = state.halflife;
    rerender();
  });
  $('toggle-industry').addEventListener('change', e => {
    state.industry = e.target.checked;
    $('industry-text').textContent = state.industry ? 'included' : 'excluded';
    rerender();
  });

  const chips = $('venue-chips');
  for (const v of VENUES) {
    const b = document.createElement('button');
    b.textContent = v; b.className = 'on'; b.dataset.v = v;
    b.setAttribute('aria-pressed', 'true');
    b.addEventListener('click', () => {
      if (state.venues.has(v) && state.venues.size === 1) return;
      state.venues.has(v) ? state.venues.delete(v) : state.venues.add(v);
      b.classList.toggle('on', state.venues.has(v));
      b.setAttribute('aria-pressed', String(state.venues.has(v)));
      rerender();
    });
    chips.append(b);
  }

  const pop = $('weights-pop');
  for (const t of TIERS) {
    const row = ttEl('weight-row', '');
    const nm = ttEl('wname', '', 'span');
    const dot = ttEl('tier-dot', '', 'span'); dot.style.background = t.color;
    nm.append(dot, document.createTextNode(t.label));
    const input = document.createElement('input');
    input.type = 'range'; input.min = 0; input.max = t.max; input.step = t.step; input.value = t.w;
    input.setAttribute('aria-label', t.label + ' weight');
    const out = document.createElement('output'); out.textContent = t.w;
    input.addEventListener('input', () => {
      state.weights[t.id] = +input.value;
      out.textContent = input.value;
      initLegend(); rerender();
    });
    row.append(nm, input, out);
    pop.append(row);
    t._input = input; t._out = out;
  }
  const reset = document.createElement('button');
  reset.className = 'weights-reset'; reset.textContent = 'reset to defaults';
  reset.addEventListener('click', () => {
    for (const t of TIERS) { state.weights[t.id] = t.w; t._input.value = t.w; t._out.textContent = t.w; }
    initLegend(); rerender();
  });
  pop.append(reset);

  $('board-more').addEventListener('click', () => {
    state.boardLimit = state.boardLimit <= 25 ? 50 : 25;
    rerender();
  });
}

/* ── orchestration ─────────────────────────────────────────────────────── */
let raf = null;
function rerender() {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = null;
    lastRes = computeScores();
    renderPodium(lastRes.ranking);
    renderBoard(lastRes);
    renderCanon();
    renderBump();
    $('board-sub').textContent =
      `${lastRes.papersInView.toLocaleString()} honored papers in view · credit: ` +
      ({ both: 'first + corresponding (50/50)', first: 'first author', corr: 'corresponding author' })[state.attr] +
      ` · ${state.lens === 'now' ? `present-day lens, ${state.halflife}y half-life on age of work` : 'all-time lens'}` +
      ` · industry ${state.industry ? 'included' : 'excluded'}`;
    if (state.selected) openDossier(state.selected);
  });
}

function initFootnotes() {
  const s = DATA.stats;
  $('coverage-note').textContent =
    `Coverage: ${s.papers.toLocaleString()} honored papers, affiliations resolved for ` +
    `${s.resolved.toLocaleString()} (${Math.round(s.resolved / s.papers * 100)}%); ` +
    `unresolved papers appear in the Canon but carry no institutional credit yet. ` +
    `All test-of-time and best-paper affiliations are individually verified.`;
  $('generated-note').textContent =
    `Dataset generated ${DATA.generated} · award window ${DATA.window} · ` +
    `honors from OpenReview, official award pages, ACL Anthology and CVF; affiliations via ` +
    `OpenReview author histories, Crossref and manual verification.`;
}

let resizeT = null;
addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => { renderCanon(); renderBump(); }, 180);
});

initKPIs();
initLegend();
initControls();
initFootnotes();
rerender();
})();
