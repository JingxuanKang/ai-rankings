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
const MIN_YEAR = Math.min(...EVENTS.map(e => e.ya));
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TYPE_TAG = { company: 'industry', government: 'gov lab', nonprofit: 'nonprofit',
  facility: 'facility', healthcare: 'health', archive: 'archive', other: 'org', unknown: '' };

const state = {
  attr: 'both',          // both | first | corr
  lens: 'alltime',       // alltime | now
  halflife: 5,
  scope: 'academia',     // academia | industry | all — 默认只排学界（对齐 Directory 页）
  country: 'all',        // ISO country code or 'all'
  venues: new Set(VENUES),
  tiers: new Set(TIERS.map(t => t.id)),
  weights: Object.fromEntries(TIERS.map(t => [t.id, t.w])),
  view: 'chart',
  axis: 'yw',            // canon x axis: yw | ya
  boardLimit: 25,
  selected: null,        // inst id in dossier
};

const $ = id => document.getElementById(id);

/* ── theming: tier + chrome colors live in CSS custom properties ───────── */
const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const hexToRgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('sr-theme', theme); } catch (e) { /* file:// private mode */ }
  for (const t of TIERS) t.color = cssVar('--tier-' +
    ({ test_of_time: 'tot', best_paper: 'best', honorable_mention: 'hm', oral: 'oral' })[t.id]);
  const btn = $('theme-btn');
  if (btn) btn.textContent = theme === 'light' ? '☾ Dark' : '☀ Light';
}
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
  if (state.scope !== 'all') for (const id of m.keys()) {
    const isCompany = (INSTS[id] || {}).type === 'company';
    if (state.scope === 'academia' ? isCompany : !isCompany) m.delete(id);
  }
  if (state.country !== 'all') for (const id of m.keys())
    if ((INSTS[id] || {}).country !== state.country) m.delete(id);
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
    if (!state.venues.has(ev.venue) || !state.tiers.has(ev.award) || ev.ya > maxYa) continue;
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
  $('kpi-window').textContent = MIN_YEAR + ' – ' + REF_YEAR;
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

  const evs = EVENTS.filter(e => state.venues.has(e.venue) && state.tiers.has(e.award));
  const xs = evs.map(e => state.axis === 'yw' ? e.yw : e.ya);
  const x0 = Math.min(...xs), x1 = Math.max(...xs, REF_YEAR);
  const x = d3.scaleLinear().domain([x0 - 0.5, x1 + 0.5]).range([padL, W - padR]);
  const laneY = v => padT + VENUES.indexOf(v) * laneH + laneH / 2;
  const rOf = e => ({ test_of_time: 5, best_paper: 4, honorable_mention: 2.6, oral: 1.7 })[e.award];

  // lane separators + labels
  const gridC = cssVar('--grid'), mutedC = cssVar('--ink-muted');
  canonCtx.strokeStyle = gridC; canonCtx.lineWidth = 1;
  canonCtx.font = '11px system-ui'; canonCtx.textAlign = 'left'; canonCtx.textBaseline = 'middle';
  VENUES.forEach((v, i) => {
    const yTop = padT + i * laneH;
    if (i) { canonCtx.beginPath(); canonCtx.moveTo(padL - 60, yTop); canonCtx.lineTo(W - padR, yTop); canonCtx.stroke(); }
    canonCtx.fillStyle = mutedC;
    canonCtx.fillText(v, 12, yTop + laneH / 2);
  });
  // year gridlines
  const step = (x1 - x0) > 14 ? 5 : 1;
  for (let yy = Math.ceil(x0 / step) * step; yy <= x1; yy += step) {
    canonCtx.strokeStyle = gridC; canonCtx.globalAlpha = 0.55;
    canonCtx.beginPath(); canonCtx.moveTo(x(yy), padT - 6); canonCtx.lineTo(x(yy), H - 6); canonCtx.stroke();
    canonCtx.globalAlpha = 1;
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
    canonCtx.strokeStyle = hexToRgba(cssVar('--tier-tot'), 0.18); canonCtx.lineWidth = 1;
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
  const years = d3.range(Math.max(MIN_YEAR, REF_YEAR - 9), REF_YEAR + 1);
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
let dossierTier = null;   // tier-chip filter for the record list
function openDossier(instId) {
  if (state.selected !== instId) dossierTier = null;
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
    const chip = ttEl('tier-chip' + (dossierTier === t.id ? ' active' : ''), '', 'button');
    chip.setAttribute('aria-pressed', String(dossierTier === t.id));
    const dot = ttEl('tier-dot', '', 'span'); dot.style.background = t.color;
    const b = document.createElement('b'); b.textContent = r.counts[t.id];
    chip.append(dot, b, document.createTextNode(' ' + t.label));
    chip.addEventListener('click', () => {
      dossierTier = dossierTier === t.id ? null : t.id;
      openDossier(instId);
    });
    return chip;
  }));

  // the people — CSRankings-style: credited 1st/corresponding authors here,
  // ranked by weighted score; the tier chips above filter this list too
  const people = new Map();
  for (const { ev } of r.events) {
    if (dossierTier && ev.award !== dossierTier) continue;
    const names = new Set();
    if (ev.fi.includes(instId) && ev.fa) names.add(ev.fa);
    if (ev.ci.includes(instId)) for (const n of ev.ca || []) if (n) names.add(n);
    for (const n of names) {
      let p = people.get(n);
      if (!p) people.set(n, p = { name: n, score: 0, counts: {}, evs: [] });
      p.score += state.weights[ev.award];
      p.counts[ev.award] = (p.counts[ev.award] || 0) + 1;
      p.evs.push(ev);
    }
  }
  const plist = [...people.values()].sort((a, b) => b.score - a.score);
  const peopleEl = $('dossier-people');
  const renderPeople = limit => {
    peopleEl.replaceChildren(...plist.slice(0, limit).map(p => {
      const row = ttEl('person-row', '');
      const counts = ttEl('p-counts', '', 'span');
      for (const t of TIERS) {
        if (!p.counts[t.id]) continue;
        const pc = ttEl('pc', '', 'span');
        const dot = ttEl('tier-dot', '', 'span'); dot.style.background = t.color;
        pc.append(dot, document.createTextNode(p.counts[t.id] + '×'));
        pc.title = t.label;
        counts.append(pc);
      }
      const nameEl = ttEl('p-name', '', 'span');
      const hp = (DATA.homepages || {})[p.name];
      const tri = ttEl('p-tri', '►', 'span');
      nameEl.append(tri, document.createTextNode(' '));
      if (hp) {
        const a = document.createElement('a');
        a.href = hp; a.target = '_blank'; a.rel = 'noopener'; a.textContent = p.name;
        a.addEventListener('click', e => e.stopPropagation());
        nameEl.append(a);
      } else nameEl.append(document.createTextNode(p.name));
      row.append(nameEl, counts, ttEl('p-score', fmt(p.score), 'span'));
      // 点行（除人名链接外）展开该人的获奖论文
      row.addEventListener('click', () => {
        const next = row.nextElementSibling;
        if (next && next.classList.contains('person-papers')) {
          next.remove(); tri.textContent = '►'; return;
        }
        const box = ttEl('person-papers', '');
        const evs = [...p.evs].sort((a, b) =>
          (TIER_BY_ID[a.award] === TIER_BY_ID[b.award] ? b.ya - a.ya
           : state.weights[b.award] - state.weights[a.award]));
        for (const ev of evs) {
          const it = ttEl('pp-item', '');
          const dot = ttEl('tier-dot', '', 'span');
          dot.style.background = TIER_BY_ID[ev.award].color;
          const t = ttEl('pp-title', '', 'span');
          if (ev.url) {
            const a2 = document.createElement('a');
            a2.href = ev.url; a2.target = '_blank'; a2.rel = 'noopener'; a2.textContent = ev.title;
            t.append(a2);
          } else t.textContent = ev.title;
          it.append(dot, t, ttEl('pp-meta', `${ev.venue} ${ev.ya}`, 'span'));
          box.append(it);
        }
        row.after(box);
        tri.textContent = '▼';
      });
      return row;
    }));
    if (plist.length > limit) {
      const more = ttEl('people-more', `show all ${plist.length} people`, 'button');
      more.addEventListener('click', () => renderPeople(Infinity));
      peopleEl.append(more);
    }
  };
  renderPeople(12);

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
        .attr('rx', 2).attr('fill', cssVar('--tier-best'))
        .append('title').text(`${yy}: ${fmt(v)} pts`);
    }
    spark.append('text').attr('x', 0).attr('y', sh - 2)
      .attr('fill', cssVar('--ink-muted')).attr('font-size', 10).text(yMin);
    spark.append('text').attr('x', sw).attr('y', sh - 2).attr('text-anchor', 'end')
      .attr('fill', cssVar('--ink-muted')).attr('font-size', 10).text(yMax);
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

  const items = [...r.events]
    .filter(({ ev }) => !dossierTier || ev.award === dossierTier)
    .sort((a, b) => b.v - a.v || b.ev.ya - a.ev.ya).slice(0, 200);
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

/* ── nations (medal-table by country) ──────────────────────────────────── */
const REGION = (() => { try { return new Intl.DisplayNames(['en'], { type: 'region' }); } catch (e) { return null; } })();
function renderNations(res) {
  const byC = new Map();
  for (const r of res.ranking) {
    const cc = (INSTS[r.id] || {}).country;
    if (!cc) continue;
    let rec = byC.get(cc);
    if (!rec) byC.set(cc, rec = { cc, total: 0, byTier: {}, counts: {}, insts: 0 });
    rec.total += r.total;
    rec.insts++;
    for (const t of TIERS) {
      rec.byTier[t.id] = (rec.byTier[t.id] || 0) + (r.byTier[t.id] || 0);
      rec.counts[t.id] = (rec.counts[t.id] || 0) + (r.counts[t.id] || 0);
    }
  }
  const rows = [...byC.values()].sort((a, b) => b.total - a.total).slice(0, 12);
  const max = rows.length ? rows[0].total : 1;
  $('nations').replaceChildren(...rows.map((r, i) => {
    const row = ttEl('nation-row', '');
    const name = REGION ? (REGION.of(r.cc) || r.cc) : r.cc;
    const bar = ttEl('nation-bar', '');
    const stack = ttEl('nation-stack', '');
    stack.style.width = `calc((100% - 64px) * ${(r.total / max).toFixed(4)})`;
    for (const t of TIERS) {
      if (!(r.byTier[t.id] > 0)) continue;
      const seg = ttEl('nation-seg', '', 'span');
      seg.style.width = (r.byTier[t.id] / r.total * 100) + '%';
      seg.style.background = t.color;
      stack.append(seg);
    }
    bar.append(stack, ttEl('nation-score', fmt(r.total), 'span'));
    row.append(ttEl('nation-rank', String(i + 1)), ttEl('nation-name', `${flagOf(r.cc)} ${name}`), bar);
    row.addEventListener('pointermove', e => showTip(e.clientX, e.clientY, box => {
      box.append(ttEl('tt-value', fmt(r.total) + ' pts'), ttEl('tt-label', `${name} · ${r.insts} institutions`));
      for (const t of TIERS) {
        if (!r.counts[t.id]) continue;
        const rowEl = ttEl('tt-row', '');
        const key = ttEl('tt-key', '', 'span'); key.style.background = t.color;
        rowEl.append(key, ttEl('', `${t.label} × ${r.counts[t.id]} → ${fmt(r.byTier[t.id])}`, 'span'));
        box.append(rowEl);
      }
    }));
    row.addEventListener('pointerleave', hideTip);
    return row;
  }));
}

/* ── the map (treemap: country → institution, area = share of credit) ──── */
const REGIONS = [
  { id: 'us', label: 'United States', cc: new Set(['US']) },
  { id: 'cn', label: 'China', cc: new Set(['CN']) },
  { id: 'uk', label: 'United Kingdom', cc: new Set(['GB']) },
  { id: 'eu', label: 'Europe', cc: new Set(['DE', 'FR', 'CH', 'NL', 'SE', 'DK', 'FI', 'NO',
    'AT', 'BE', 'ES', 'PT', 'IT', 'IE', 'GR', 'CZ', 'PL', 'RU', 'HU', 'RO']) },
  { id: 'ca', label: 'Canada', cc: new Set(['CA']) },
  { id: 'as', label: 'Asia', cc: new Set(['JP', 'KR', 'SG', 'HK', 'TW', 'IN', 'SA', 'AE', 'IL']) },
  { id: 'row', label: 'Rest of world', cc: null }, // catch-all
];
const regionOf = cc => (REGIONS.find(r => r.cc && r.cc.has(cc)) || REGIONS[REGIONS.length - 1]).id;
const lumOf = hex => {
  const n = parseInt(hex.slice(1), 16);
  return (0.2126 * (n >> 16 & 255) + 0.7152 * (n >> 8 & 255) + 0.0722 * (n & 255)) / 255;
};

function renderMap(res) {
  const mapEl = $('map');
  const W = mapEl.clientWidth || 1012;
  const H = Math.round(Math.min(760, Math.max(520, W * 0.66)));
  mapEl.style.height = H + 'px';
  const total = d3.sum(res.ranking, r => r.total);
  if (!total) { mapEl.replaceChildren(); return; }

  // one flat pool — every institution above 0.12% share tiles directly
  const MIN_SHARE = 0.0012;
  const kids = [];
  let hiddenV = 0, hiddenN = 0;
  for (const r of res.ranking) {
    if (r.total / total >= MIN_SHARE) {
      kids.push({ name: (INSTS[r.id] || { name: r.id }).name, id: r.id, value: r.total, r,
                  cc: (INSTS[r.id] || {}).country || '' });
    } else { hiddenV += r.total; hiddenN++; }
  }

  const root = d3.hierarchy({ children: kids })
    .sum(d => d.value || 0)
    .sort((a, b) => b.value - a.value);
  d3.treemap().size([W, H]).paddingInner(2)(root);

  const frag = document.createDocumentFragment();
  for (const leaf of root.leaves()) {
    if (!leaf.data.id || leaf.value <= 0) continue;
    const w = leaf.x1 - leaf.x0, h = leaf.y1 - leaf.y0;
    if (w < 3 || h < 3) continue;
    const cc = leaf.data.cc;
    const base = cssVar('--map-' + regionOf(cc));
    const col = d3.color(base).brighter((hash01(leaf.data.name) - 0.35) * 0.8);
    const cell = ttEl('map-cell', '');
    cell.style.left = leaf.x0 + 'px'; cell.style.top = leaf.y0 + 'px';
    cell.style.width = w + 'px'; cell.style.height = h + 'px';
    cell.style.background = col.formatHex();
    const share = leaf.value / total * 100;
    if (w >= 24 && h >= 12) {   // every readable cell carries its name
      const ink = lumOf(col.formatHex()) > 0.55 ? 'rgba(10,10,12,.88)' : '#fff';
      const fs = Math.max(7, Math.min(20, Math.sqrt(w * h) / 8));
      const nm = ttEl('mc-name', leaf.data.name);
      nm.style.fontSize = fs + 'px'; nm.style.color = ink;
      cell.append(nm);
      if (h >= 46 && w >= 46) {
        const sh = ttEl('mc-share', share.toFixed(share >= 1 ? 1 : 2) + '%');
        sh.style.fontSize = Math.max(8, fs - 3) + 'px'; sh.style.color = ink;
        cell.append(sh);
      }
    }
    cell.__leaf = leaf;
    frag.append(cell);
  }
  mapEl.replaceChildren(frag);

  // region legend with live shares (over the whole ranking, not just shown cells)
  const regTotals = {};
  for (const r of res.ranking)
    regTotals[regionOf((INSTS[r.id] || {}).country || '')] =
      (regTotals[regionOf((INSTS[r.id] || {}).country || '')] || 0) + r.total;
  $('map-legend').replaceChildren(...REGIONS.filter(r => regTotals[r.id]).map(r => {
    const item = ttEl('legend-item', '', 'span');
    const sw = ttEl('legend-swatch', '', 'span'); sw.style.background = cssVar('--map-' + r.id);
    item.append(sw, document.createTextNode(`${r.label} ${(regTotals[r.id] / total * 100).toFixed(0)}%`));
    return item;
  }));
  $('map-sub').textContent =
    `One map, everyone competes: area = share of all weighted credit in the current view, color = region. ` +
    `Hover for the breakdown; click to open the dossier.` +
    (hiddenN ? ` ${hiddenN} institutions below 0.12% share (together ${(hiddenV / total * 100).toFixed(1)}%) are not drawn.` : '');
}
$('map').addEventListener('pointermove', e => {
  const leaf = e.target.closest('.map-cell') && e.target.closest('.map-cell').__leaf;
  if (!leaf) { hideTip(); return; }
  const total = d3.sum(lastRes.ranking, r => r.total);
  showTip(e.clientX, e.clientY, box => {
    const cname = leaf.data.cc ? (REGION ? (REGION.of(leaf.data.cc) || leaf.data.cc) : leaf.data.cc) : '—';
    box.append(ttEl('tt-value', leaf.data.name),
      ttEl('tt-label', `${flagOf(leaf.data.cc)} ${cname} · ${fmt(leaf.value)} pts · ${(leaf.value / total * 100).toFixed(2)}% of the field`));
    const r = leaf.data.r;
    if (r) for (const t of TIERS) {
      if (!r.counts[t.id]) continue;
      const rowEl = ttEl('tt-row', '');
      const key = ttEl('tt-key', '', 'span'); key.style.background = t.color;
      rowEl.append(key, ttEl('', `${t.label} × ${r.counts[t.id]}`, 'span'));
      box.append(rowEl);
    }
  });
});
$('map').addEventListener('pointerleave', hideTip);
$('map').addEventListener('click', e => {
  const cell = e.target.closest('.map-cell');
  if (cell && cell.__leaf && cell.__leaf.data.id) openDossier(cell.__leaf.data.id);
});

/* ── vs CSRankings (slopegraph; CSRankings AI-areas world top-20, 2012-2026,
      snapshot 2026-07-10 — publication counting vs our awards-only ranks) ── */
const CSRANKINGS = [
  'Peking University', 'Tsinghua University', 'Carnegie Mellon University',
  'Nanyang Technological University', 'Shanghai Jiao Tong University', 'Zhejiang University',
  'Nanjing University', 'Chinese Academy of Sciences', 'KAIST', 'UIUC',
  'National University of Singapore', 'Stanford University', 'University of Maryland',
  'Mohamed bin Zayed University of Artificial Intelligence', 'Harbin Institute of Technology',
  'University of Science and Technology of China', 'MIT', 'Fudan University', 'HKUST',
  'Chinese University of Hong Kong',
];
const VS_SHORT = {
  'Mohamed bin Zayed University of Artificial Intelligence': 'MBZUAI',
  'University of Science and Technology of China': 'USTC',
  'Chinese University of Hong Kong': 'CUHK',
  'Nanyang Technological University': 'NTU Singapore',
  'National University of Singapore': 'NUS',
  'Shanghai Jiao Tong University': 'Shanghai Jiao Tong',
};

function renderVs() {
  // our side: academia-only ranking under the user's current weights/filters
  const saved = { scope: state.scope, country: state.country };
  state.scope = 'academia'; state.country = 'all';
  const res = computeScores();
  state.scope = saved.scope; state.country = saved.country;
  const rankByName = new Map();
  for (const r of res.ranking) rankByName.set((INSTS[r.id] || {}).name, r.rank);

  const rows = CSRANKINGS.map((name, i) => ({
    name, short: VS_SHORT[name] || name, csr: i + 1, ours: rankByName.get(name) ?? null,
  }));
  const byOurs = [...rows].sort((a, b) => (a.ours ?? 1e9) - (b.ours ?? 1e9));

  const svg = d3.select('#vs');
  const wrapW = svg.node().parentElement.clientWidth;
  const W = Math.max(wrapW, 700), rowH = 30, padT = 40, H = padT + rows.length * rowH + 12;
  const xL = 300, xR = W - 330;
  svg.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  svg.selectAll('*').remove();
  const yAt = i => padT + i * rowH + rowH / 2;

  // country lookup for flags
  const ccByName = new Map();
  for (const k in INSTS) ccByName.set(INSTS[k].name, INSTS[k].country);

  svg.append('text').attr('class', 'vs-head').attr('x', xL).attr('y', 18)
    .attr('text-anchor', 'end').text('CSRankings — papers');
  svg.append('text').attr('class', 'vs-head').attr('x', xR).attr('y', 18)
    .text('AI Rankings — awards');

  const riseC = cssVar('--tier-best'), dropC = cssVar('--map-cn'), surfC = cssVar('--plane');
  for (const r of rows) {
    const i = rows.indexOf(r), j = byOurs.indexOf(r);
    const delta = r.ours === null ? -999 : r.csr - r.ours;   // 正 = 升
    const up = delta >= 0;
    const col = up ? riseC : dropC;
    const flag = flagOf(ccByName.get(r.name) || '');

    // 左侧：名次. 国旗 名字
    svg.append('text').attr('x', xL).attr('y', yAt(i) + 4).attr('text-anchor', 'end')
      .text(`${r.csr}. ${flag} ${r.short}`);

    // 连线：线宽随落差，端点带表面环圆点
    const wpx = Math.max(1.6, Math.min(4.2, 1.4 + Math.abs(delta) / 28));
    svg.append('line').attr('class', 'vs-line')
      .attr('x1', xL + 14).attr('y1', yAt(i)).attr('x2', xR - 46).attr('y2', yAt(j))
      .attr('stroke', col).attr('stroke-width', wpx);
    for (const [cx, cy] of [[xL + 14, yAt(i)], [xR - 46, yAt(j)]]) {
      svg.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 4.4)
        .attr('fill', col).attr('stroke', surfC).attr('stroke-width', 2);
    }

    // 右侧：涨跌徽章 + #名次 国旗 名字
    const bx = xR - 36;
    const btxt = r.ours === null ? '·' : (up ? `▲${delta === 0 ? '=' : delta}` : `▼${-delta}`);
    const bw = 12 + btxt.length * 7.5;
    svg.append('rect').attr('x', bx - 2).attr('y', yAt(j) - 10).attr('rx', 9)
      .attr('width', bw).attr('height', 20)
      .attr('fill', col).attr('opacity', up ? 0.16 : 0.14);
    svg.append('text').attr('x', bx + bw / 2 - 2).attr('y', yAt(j) + 4)
      .attr('text-anchor', 'middle')
      .attr('style', `fill:${col};font-weight:700;font-size:11.5px`).text(btxt);
    const lbl = svg.append('text').attr('x', bx + bw + 8).attr('y', yAt(j) + 4);
    lbl.append('tspan').attr('class', 'vs-rank').attr('style', 'font-weight:700')
      .text(r.ours ? `#${r.ours} ` : '— ');
    lbl.append('tspan').text(` ${flag} ${r.short}`);
  }
}

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

  bindSeg('seg-scope', 'scope');

  // country filter — options sorted by total weighted credit at default weights
  const cTotals = new Map();
  for (const ev of EVENTS) {
    const w = TIER_BY_ID[ev.award].w;
    for (const id of new Set([...ev.fi, ...ev.ci])) {
      const cc = (INSTS[id] || {}).country;
      if (cc) cTotals.set(cc, (cTotals.get(cc) || 0) + w);
    }
  }
  const sel = $('country-select');
  const optAll = document.createElement('option');
  optAll.value = 'all'; optAll.textContent = 'All countries/regions';
  sel.append(optAll);
  for (const [cc] of [...cTotals.entries()].sort((a, b) => b[1] - a[1])) {
    const o = document.createElement('option');
    o.value = cc;
    o.textContent = `${flagOf(cc)} ${REGION ? (REGION.of(cc) || cc) : cc}`;
    sel.append(o);
  }
  sel.addEventListener('change', () => { state.country = sel.value; rerender(); });

  $('halflife').addEventListener('input', e => {
    state.halflife = +e.target.value;
    $('halflife-out').textContent = state.halflife;
    rerender();
  });

  // tier filter chips — dossier-chip style: dot + live count + label
  const tf = $('tier-filters');
  for (const t of TIERS) {
    const chip = ttEl('tier-chip on', '', 'button');
    chip.setAttribute('aria-pressed', 'true');
    const dot = ttEl('tier-dot', '', 'span'); dot.style.background = t.color;
    const b = document.createElement('b');
    chip.append(dot, b, document.createTextNode(' ' + t.label));
    chip.addEventListener('click', () => {
      if (state.tiers.has(t.id) && state.tiers.size === 1) return;
      state.tiers.has(t.id) ? state.tiers.delete(t.id) : state.tiers.add(t.id);
      chip.classList.toggle('on', state.tiers.has(t.id));
      chip.setAttribute('aria-pressed', String(state.tiers.has(t.id)));
      rerender();
    });
    t._filterChip = chip;
    t._filterCount = b;
    tf.append(chip);
  }

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
    t._dotEl = dot;
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

  $('theme-btn').addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
    for (const t of TIERS) {
      if (t._dotEl) t._dotEl.style.background = t.color;
      const d = t._filterChip && t._filterChip.querySelector('.tier-dot');
      if (d) d.style.background = t.color;
    }
    initLegend();
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
    // live tier counts under the current venue filter (independent of tier toggles)
    const tierCounts = {};
    for (const ev of EVENTS) if (state.venues.has(ev.venue))
      tierCounts[ev.award] = (tierCounts[ev.award] || 0) + 1;
    for (const t of TIERS) if (t._filterCount)
      t._filterCount.textContent = (tierCounts[t.id] || 0).toLocaleString();
    renderPodium(lastRes.ranking);
    renderBoard(lastRes);
    renderNations(lastRes);
    renderVs();
    renderCanon();
    renderBump();
    renderMap(lastRes);
    $('board-sub').textContent =
      `${lastRes.papersInView.toLocaleString()} honored papers in view · credit: ` +
      ({ both: 'first + corresponding (50/50)', first: 'first author', corr: 'corresponding author' })[state.attr] +
      ` · ${state.lens === 'now' ? `present-day lens, ${state.halflife}y half-life on age of work` : 'all-time lens'}` +
      ` · ${({ all: 'academia + industry', academia: 'academia only (incl. gov / nonprofit labs)', industry: 'industry only' })[state.scope]}` +
      (state.country !== 'all' ? ` · ${REGION ? (REGION.of(state.country) || state.country) : state.country} only` : '');
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
  resizeT = setTimeout(() => { renderCanon(); renderBump(); if (lastRes) renderMap(lastRes); }, 180);
});

let savedTheme = 'light';
try { savedTheme = localStorage.getItem('sr-theme') || 'light'; } catch (e) { /* file:// */ }
applyTheme(savedTheme);
initKPIs();
initLegend();
initControls();
initFootnotes();
rerender();
})();
