import React from 'react';
import {
  AbsoluteFill, Audio, Easing, Img, Sequence, interpolate, spring, staticFile,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import { C, MONO, SANS, SERIF } from './theme';
import data from './data.json';

/* ── timeline (frames @ 30 fps) ─────────────────────────────────────────── */
const SCENES = [
  ['hook', 150], ['podium', 210], ['credit', 240], ['stats', 165],
  ['race', 390], ['controls', 480], ['explore', 300], ['end', 210],
] as const;
const FADE = 14;
export const TOTAL = SCENES.reduce((s, [, d]) => s + d, 0);

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const ease = Easing.bezier(0.22, 1, 0.36, 1);
const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');
const flag = (cc: string) => cc && cc.length === 2
  ? String.fromCodePoint(...[...cc.toUpperCase()].map(c => 0x1F1A5 + c.charCodeAt(0))) : '';

/* fade a whole scene in and out */
const SceneFade: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, FADE, dur - FADE, dur], [0, 1, 1, 0], clamp);
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

/* element that rises in at frame `at` */
const Rise: React.FC<{ at: number; y?: number; children: React.ReactNode; style?: React.CSSProperties }> =
  ({ at, y = 24, children, style }) => {
    const f = useCurrentFrame();
    const p = interpolate(f, [at, at + 18], [0, 1], { ...clamp, easing: ease });
    return <div style={{ opacity: p, transform: `translateY(${(1 - p) * y}px)`, ...style }}>{children}</div>;
  };

const Kicker: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = C.accent }) => (
  <div style={{ fontFamily: SANS, fontSize: 22, letterSpacing: '0.28em', textTransform: 'uppercase',
    color, fontWeight: 600 }}>{children}</div>
);

const Headline: React.FC<{ children: React.ReactNode; size?: number }> = ({ children, size = 76 }) => (
  <div style={{ fontFamily: SERIF, fontSize: size, color: C.ink, lineHeight: 1.18, letterSpacing: '0.01em' }}>
    {children}</div>
);

const Glow = () => (
  <AbsoluteFill style={{
    background: `radial-gradient(1200px 700px at 50% 35%, rgba(127,179,232,0.10), transparent 70%),
      radial-gradient(900px 500px at 50% 110%, rgba(255,215,106,0.06), transparent 70%)`,
  }} />
);

/* ── 1. hook: the paper flood ───────────────────────────────────────────── */
const Hook = () => {
  const f = useCurrentFrame();
  const cols = 64, rows = 30;
  const shown = interpolate(f, [0, 80], [0, cols * rows], { ...clamp, easing: Easing.in(Easing.quad) });
  const dim = interpolate(f, [70, 100], [1, 0.18], clamp);
  const cells = [];
  for (let i = 0; i < cols * rows; i++) {
    // pseudo-random fill order so the grid "floods" rather than scans
    const order = (i * 7919) % (cols * rows);
    if (order > shown) continue;
    cells.push(<div key={i} style={{ position: 'absolute', left: 60 + (i % cols) * 28.2,
      top: 120 + Math.floor(i / cols) * 28.2, width: 18, height: 22, borderRadius: 2,
      background: C.baseline, opacity: 0.55 }} />);
  }
  const strike = interpolate(f, [104, 124], [0, 1], { ...clamp, easing: ease });
  return (
    <AbsoluteFill style={{ background: C.plane }}>
      <AbsoluteFill style={{ opacity: dim }}>{cells}</AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <Rise at={8}><Kicker color={C.muted}>more submissions · more acceptances · more papers</Kicker></Rise>
        <div style={{ height: 34 }} />
        <Rise at={78}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <Headline size={92}>Paper counts stopped<br />meaning anything.</Headline>
          </div>
        </Rise>
        <div style={{ height: 30 }} />
        <div style={{ width: 760 * strike, height: 3, background: C.tot, borderRadius: 2,
          boxShadow: `0 0 24px ${C.tot}` }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ── 2. the podium: what counts ─────────────────────────────────────────── */
const TIERS = [
  { id: 'test_of_time', label: 'Test of Time', w: 10, color: C.tot },
  { id: 'best_paper', label: 'Best Paper', w: 8, color: C.best },
  { id: 'honorable_mention', label: 'Honorable Mention', w: 3, color: C.hm },
  { id: 'oral', label: 'Oral', w: 1, color: C.oral },
];
const Podium = () => {
  const f = useCurrentFrame();
  const tc = data.tierCounts as Record<string, number>;
  return (
    <AbsoluteFill style={{ background: C.plane, padding: '110px 220px' }}>
      <Glow />
      <Rise at={4}><Kicker color={C.tot}>only the podium counts</Kicker></Rise>
      <div style={{ height: 22 }} />
      <Rise at={10}><Headline>What still means something<br />is the podium.</Headline></Rise>
      <div style={{ height: 60 }} />
      {TIERS.map((t, i) => {
        const at = 40 + i * 14;
        const p = interpolate(f, [at, at + 26], [0, 1], { ...clamp, easing: ease });
        return (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', height: 92, opacity: p,
            borderBottom: `1px solid ${C.grid}` }}>
            <div style={{ width: 22, height: 22, borderRadius: 11, background: t.color, marginRight: 30,
              boxShadow: i < 2 ? `0 0 22px ${t.color}` : 'none' }} />
            <div style={{ fontFamily: SERIF, fontSize: 46, color: C.ink, width: 540, flexShrink: 0 }}>{t.label}</div>
            <div style={{ fontFamily: MONO, fontSize: 40, color: t.color, width: 160, flexShrink: 0 }}>× {t.w}</div>
            <div style={{ height: 14, background: t.color, borderRadius: 7, width: 46 * t.w * p, opacity: 0.9 }} />
            <div style={{ flex: 1 }} />
            <div style={{ fontFamily: MONO, fontSize: 28, color: C.muted, whiteSpace: 'nowrap', width: 240, textAlign: 'right' }}>{fmtInt(tc[t.id] * p)} papers</div>
          </div>
        );
      })}
      <Rise at={120} style={{ display: 'flex', alignItems: 'center', height: 92 }}>
        <div style={{ width: 22, height: 22, borderRadius: 11, border: `2px solid ${C.muted}`, marginRight: 30 }} />
        <div style={{ fontFamily: SERIF, fontSize: 46, color: C.muted, width: 540, flexShrink: 0 }}>Regular acceptance</div>
        <div style={{ fontFamily: MONO, fontSize: 40, color: C.muted }}>× 0 <span style={{ fontSize: 26 }}>— by design</span></div>
      </Rise>
    </AbsoluteFill>
  );
};

/* ── 3. credit goes where the work was done ─────────────────────────────── */
const Credit = () => {
  const f = useCurrentFrame();
  const arc = interpolate(f, [70, 130], [0, 1], { ...clamp, easing: ease });
  const x0 = 360, x1 = 1560, y = 640;
  const len = 1400;
  return (
    <AbsoluteFill style={{ background: C.plane, padding: '100px 220px' }}>
      <Glow />
      <Rise at={4}><Kicker>who gets credit</Kicker></Rise>
      <div style={{ height: 22 }} />
      <Rise at={10}><Headline size={70}>Credit goes where the work was <i>done</i>.</Headline></Rise>
      <Rise at={24}>
        <div style={{ fontFamily: SANS, fontSize: 28, color: C.ink2, marginTop: 22, maxWidth: 1300, lineHeight: 1.5 }}>
          First and corresponding authors&rsquo; institutions, as printed on the paper at publication time.
        </div>
      </Rise>
      <svg width={1920} height={1080} style={{ position: 'absolute', left: 0, top: 0 }}>
        <line x1={x0 - 60} x2={x1 + 60} y1={y} y2={y} stroke={C.baseline} strokeWidth={2} />
        <path d={`M ${x0} ${y} Q ${(x0 + x1) / 2} ${y - 330} ${x1} ${y}`} fill="none" stroke={C.tot}
          strokeWidth={3} strokeDasharray={len} strokeDashoffset={len * (1 - arc)} opacity={0.9} />
        <circle cx={x0} cy={y} r={interpolate(f, [40, 58], [0, 13], clamp)} fill={C.oral} />
        <circle cx={x1} cy={y} r={interpolate(f, [125, 140], [0, 16], clamp)} fill={C.tot} />
      </svg>
      <div style={{ position: 'absolute', left: x0 - 180, top: y + 34, width: 360, textAlign: 'center' }}>
        <Rise at={44}>
          <div style={{ fontFamily: MONO, fontSize: 40, color: C.ink }}>2016</div>
          <div style={{ fontFamily: SANS, fontSize: 22, color: C.muted, marginTop: 6 }}>work published · CVPR</div>
        </Rise>
      </div>
      <div style={{ position: 'absolute', left: x1 - 200, top: y + 34, width: 400, textAlign: 'center' }}>
        <Rise at={128}>
          <div style={{ fontFamily: MONO, fontSize: 40, color: C.tot }}>2026</div>
          <div style={{ fontFamily: SANS, fontSize: 22, color: C.muted, marginTop: 6 }}>Test of Time award</div>
        </Rise>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: y - 210, textAlign: 'center' }}>
        <Rise at={80}>
          <div style={{ fontFamily: SERIF, fontSize: 38, color: C.ink, fontStyle: 'italic' }}>
            Deep Residual Learning for Image Recognition</div>
        </Rise>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 860, display: 'flex', justifyContent: 'center' }}>
        <Rise at={156}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '20px 40px', borderRadius: 14,
            background: C.surface, border: `1px solid ${C.baseline}`, fontFamily: SANS, fontSize: 30, color: C.ink2 }}>
            credited to <b style={{ color: C.ink, fontFamily: SERIF, fontSize: 36, fontWeight: 500 }}>Microsoft, 2016</b>
            <span style={{ color: C.muted }}>— not to wherever its authors work today</span>
          </div>
        </Rise>
      </div>
    </AbsoluteFill>
  );
};

/* ── 4. the dataset in numbers ──────────────────────────────────────────── */
const VENUES = ['NeurIPS', 'ICML', 'ICLR', 'CVPR', 'ICCV', 'ECCV', 'ACL', 'EMNLP'];
const Stats = () => {
  const f = useCurrentFrame();
  const s = data.stats;
  const k = interpolate(f, [10, 60], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const items: [string, string][] = [
    [fmtInt(s.papers * k), 'honored papers'],
    [fmtInt(s.institutions * k), 'institutions credited'],
    [String(Math.round(8 * k)), 'venues'],
    [s.window.replace(' – ', '–'), 'award window'],
  ];
  return (
    <AbsoluteFill style={{ background: C.plane, justifyContent: 'center', alignItems: 'center' }}>
      <Glow />
      <div style={{ display: 'flex', gap: 120 }}>
        {items.map(([v, l], i) => (
          <Rise key={l} at={4 + i * 6} style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: SANS, fontSize: 104, fontWeight: 600, color: C.ink,
              fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{v}</div>
            <div style={{ fontFamily: SANS, fontSize: 22, letterSpacing: '0.2em', textTransform: 'uppercase',
              color: C.muted, marginTop: 10 }}>{l}</div>
          </Rise>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 18, marginTop: 90 }}>
        {VENUES.map((v, i) => (
          <Rise key={v} at={60 + i * 5}>
            <div style={{ fontFamily: SANS, fontSize: 28, color: C.ink2, padding: '10px 26px', borderRadius: 30,
              border: `1.5px solid ${C.baseline}`, background: C.surface }}>{v}</div>
          </Rise>
        ))}
      </div>
      <Rise at={100}>
        <div style={{ fontFamily: SANS, fontSize: 24, color: C.muted, marginTop: 56 }}>
          every entry sourced from OpenReview, official award pages, ACL Anthology and CVF
        </div>
      </Rise>
    </AbsoluteFill>
  );
};

/* ── 5. race: cumulative academic standings 2012 → 2026 ─────────────────── */
type Frame = { year: number; scores: Record<string, number>; tiers: Record<string, number[]> };
const TIER_COLORS = [C.tot, C.best, C.hm, C.oral];
const RACE = data.race as unknown as Frame[];
const NAMES = data.names as Record<string, string>;
const CC = data.countries as Record<string, string>;
const TOPN = 10;
const rankAt = (fr: Frame) => {
  const order = Object.entries(fr.scores).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  return (id: string) => { const r = order.indexOf(id); return r < 0 ? 14 : r; };
};
const Race = () => {
  const f = useCurrentFrame();
  const START = 40, STEP = 20;
  const t = Math.max(0, Math.min(RACE.length - 1, (f - START) / STEP));
  const i0 = Math.floor(t), i1 = Math.min(RACE.length - 1, i0 + 1);
  const a = ease(t - i0);
  const r0 = rankAt(RACE[i0]), r1 = rankAt(RACE[i1]);
  const ids = Object.keys(NAMES);
  const score = (id: string) => (RACE[i0].scores[id] ?? 0) * (1 - a) + (RACE[i1].scores[id] ?? 0) * a;
  const tiers = (id: string) => [0, 1, 2, 3].map(j =>
    (RACE[i0].tiers[id]?.[j] ?? 0) * (1 - a) + (RACE[i1].tiers[id]?.[j] ?? 0) * a);
  const rank = (id: string) => r0(id) * (1 - a) + r1(id) * a;
  const max = Math.max(...ids.map(score), 1);
  const year = Math.round(RACE[i0].year + (RACE[i1].year - RACE[i0].year) * a);
  const ROW = 64, TOP = 300, LABEL = 520, BARW = 1060;
  return (
    <AbsoluteFill style={{ background: C.plane, padding: '90px 160px' }}>
      <Glow />
      <Rise at={4}><Kicker>the board · academia · all-time lens</Kicker></Rise>
      <div style={{ height: 18 }} />
      <Rise at={10}><Headline size={60}>Fifteen years of podiums, accumulated.</Headline></Rise>
      <Rise at={20} style={{ display: 'flex', gap: 34, marginTop: 20 }}>
        {TIERS.map(t => <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
          fontFamily: SANS, fontSize: 22, color: C.ink2 }}>
          <div style={{ width: 16, height: 16, borderRadius: 3, background: t.color }} />{t.label} × {t.w}</div>)}
      </Rise>
      <div style={{ position: 'absolute', right: 150, top: 760, fontFamily: SERIF, fontSize: 210,
        color: C.surface2, fontVariantNumeric: 'tabular-nums' }}>{year}</div>
      {ids.map(id => {
        const r = rank(id);
        if (r > TOPN + 0.5) return null;
        const o = interpolate(r, [TOPN - 1, TOPN], [1, 0], clamp) * interpolate(f, [START - 20, START], [0, 1], clamp);
        const w = (score(id) / max) * BARW;
        return (
          <div key={id} style={{ position: 'absolute', left: 160, top: TOP + r * ROW, height: ROW - 14,
            display: 'flex', alignItems: 'center', opacity: o }}>
            <div style={{ width: 54, fontFamily: MONO, fontSize: 24, color: r < 2.5 ? C.tot : C.muted }}>
              {Math.round(r) + 1}</div>
            <div style={{ width: LABEL - 54, fontFamily: SANS, fontSize: 28, color: C.ink, whiteSpace: 'nowrap' }}>
              {flag(CC[id])}&nbsp; {NAMES[id]}</div>
            <div style={{ width: w, height: 34, borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
              {tiers(id).map((v, j) => <div key={j} style={{ width: (v / max) * BARW, height: '100%',
                background: TIER_COLORS[j], borderRight: `2px solid ${C.plane}` }} />)}
            </div>
            <div style={{ marginLeft: 16, fontFamily: MONO, fontSize: 24, color: C.ink2 }}>{Math.round(score(id))}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/* ── 6. live controls: real site footage in a browser frame ─────────────── */
const Browser: React.FC<{ children: React.ReactNode; w: number; h: number }> = ({ children, w, h }) => (
  <div style={{ width: w, borderRadius: 16, overflow: 'hidden', background: C.surface,
    border: `1px solid ${C.baseline}`, boxShadow: '0 40px 120px rgba(0,0,0,0.55)' }}>
    <div style={{ height: 46, display: 'flex', alignItems: 'center', padding: '0 18px', gap: 9,
      background: C.surface2, borderBottom: `1px solid ${C.grid}` }}>
      {['#ff5f57', '#febc2e', '#28c840'].map(c => <div key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />)}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <div style={{ fontFamily: SANS, fontSize: 18, color: C.ink2, background: C.plane, padding: '6px 60px',
          borderRadius: 8 }}>airankings.jingxuan.uk</div>
      </div>
    </div>
    <div style={{ position: 'relative', height: h, overflow: 'hidden', background: C.plane }}>{children}</div>
  </div>
);

const Shot: React.FC<{ src: string; from: number; dur: number; zoom?: [number, number];
  pan?: [number, number]; origin?: string }> = ({ src, from, dur, zoom = [1, 1.06], pan = [0, 0], origin = '50% 0%' }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [from, from + 12, from + dur, from + dur + 12], [0, 1, 1, 0], clamp);
  const p = interpolate(f, [from, from + dur + 12], [0, 1], clamp);
  const s = zoom[0] + (zoom[1] - zoom[0]) * p;
  const y = pan[0] + (pan[1] - pan[0]) * ease(p);
  return <Img src={staticFile('shots/' + src)} style={{ position: 'absolute', left: 0, top: 0, width: '100%',
    opacity: o, transform: `translateY(${-y}%) scale(${s})`, transformOrigin: origin }} />;
};

const Caption: React.FC<{ from: number; dur: number; kicker: string; text: string }> = ({ from, dur, kicker, text }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [from, from + 12, from + dur, from + dur + 12], [0, 1, 1, 0], clamp);
  const y = interpolate(f, [from, from + 16], [16, 0], { ...clamp, easing: ease });
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 54, textAlign: 'center', opacity: o,
      transform: `translateY(${y}px)` }}>
      <Kicker>{kicker}</Kicker>
      <div style={{ fontFamily: SERIF, fontSize: 48, color: C.ink, marginTop: 10 }}>{text}</div>
    </div>
  );
};

const CTRL = [
  { src: 'board.png', kicker: 'all-time lens', text: 'Who built the canon.' },
  { src: 'board-now.png', kicker: 'present-day lens', text: 'Who is strong now — awards decay with the age of the work.' },
  { src: 'board-industry.png', kicker: 'academia · industry · all', text: 'Switch the field of play.' },
  { src: 'dossier.png', kicker: 'dossier', text: 'Open any lab: its people, its history, every award.' },
];
const Controls = () => {
  const D = 114;
  return (
    <AbsoluteFill style={{ background: C.plane }}>
      <Glow />
      {CTRL.map((c, i) => <Caption key={c.src} from={i * D} dur={D - 12} kicker={c.kicker} text={c.text} />)}
      <div style={{ position: 'absolute', left: 300, top: 188 }}>
        <Browser w={1320} h={780}>
          {CTRL.map((c, i) => <Shot key={c.src} src={c.src} from={i * D} dur={D - 12}
            zoom={[1, 1.04]} origin={i === 3 ? '100% 0%' : '50% 0%'} />)}
        </Browser>
      </div>
    </AbsoluteFill>
  );
};

/* ── 7. explore: map, canon, nations ────────────────────────────────────── */
const EXPLORE = [
  { src: 'map.png', kicker: 'the map', text: 'One map, everyone competes.', pan: [0, 6] as [number, number] },
  { src: 'canon.png', kicker: 'the canon', text: 'Every point of light is one honored paper.', pan: [0, 0] as [number, number] },
  { src: 'nations.png', kicker: 'nations', text: 'Credit rolled up by country and region.', pan: [0, 0] as [number, number] },
];
const Explore = () => {
  const D = 100;
  return (
    <AbsoluteFill style={{ background: C.plane }}>
      <Glow />
      {EXPLORE.map((c, i) => <Caption key={c.src} from={i * D} dur={D - 12} kicker={c.kicker} text={c.text} />)}
      <div style={{ position: 'absolute', left: 300, top: 188 }}>
        <Browser w={1320} h={780}>
          {EXPLORE.map((c, i) => <Shot key={c.src} src={c.src} from={i * D} dur={D - 12}
            zoom={[1.0, 1.05]} pan={c.pan} origin="50% 30%" />)}
        </Browser>
      </div>
    </AbsoluteFill>
  );
};

/* ── 8. end card ────────────────────────────────────────────────────────── */
const End = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - 6, fps, config: { damping: 200 } });
  const rule = interpolate(f, [10, 50], [0, 240], { ...clamp, easing: ease });
  return (
    <AbsoluteFill style={{ background: C.plane, justifyContent: 'center', alignItems: 'center' }}>
      <Glow />
      <div style={{ fontSize: 90, opacity: s, transform: `scale(${0.8 + 0.2 * s})` }}>🏆</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 34, marginTop: 10 }}>
        <div style={{ width: rule, height: 1.5, background: `linear-gradient(90deg, transparent, ${C.accent})` }} />
        <div style={{ fontFamily: SERIF, fontSize: 150, letterSpacing: '0.04em', opacity: s,
          background: 'linear-gradient(175deg, #cfe3f7 15%, #7fb3e8 60%, #4a7fb8)',
          WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
          whiteSpace: 'nowrap', padding: '0 6px' }}>AI Rankings</div>
        <div style={{ width: rule, height: 1.5, background: `linear-gradient(90deg, ${C.accent}, transparent)` }} />
      </div>
      <Rise at={30}><div style={{ fontFamily: SERIF, fontSize: 52, color: C.tot, fontStyle: 'italic', marginTop: 12 }}>
        Only the podium counts.</div></Rise>
      <Rise at={56}><div style={{ fontFamily: MONO, fontSize: 40, color: C.ink, marginTop: 70, padding: '18px 44px',
        borderRadius: 14, border: `1.5px solid ${C.baseline}`, background: C.surface }}>airankings.jingxuan.uk</div></Rise>
    </AbsoluteFill>
  );
};

const COMPONENTS: Record<string, React.FC> = {
  hook: Hook, podium: Podium, credit: Credit, stats: Stats,
  race: Race, controls: Controls, explore: Explore, end: End,
};

export const Promo = () => {
  let at = 0;
  return (
    <AbsoluteFill style={{ background: C.plane }}>
      <Audio src={staticFile('music.wav')} />
      {SCENES.map(([name, dur]) => {
        const Comp = COMPONENTS[name];
        const from = at; at += dur;
        return (
          <Sequence key={name} from={from} durationInFrames={dur} name={name}>
            <SceneFade dur={dur}><Comp /></SceneFade>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
