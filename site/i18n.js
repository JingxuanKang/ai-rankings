/* UI strings for AI Rankings. English is the source copy.
   Institution names, people, paper titles, venue codes and other data
   proper nouns are not in this catalog — callers leave them as-is. */
(function () {
  'use strict';

  const STRINGS = {
    en: {
      'meta.title': 'AI Rankings — only the podium counts',
      'meta.description': 'An awards-only ranking of AI institutions: orals, best papers and test-of-time awards, credited to first- and corresponding-author affiliations at publication time.',
      'meta.ogDescription': 'Awards-only ranking of AI institutions: orals, best papers and test-of-time prizes, credited to first- and corresponding-author affiliations at publication time.',

      'lang.group': 'language',
      'nav.directory': 'Directory',
      'nav.directoryTitle': 'CSRankings-style directory view',
      'theme.switch': 'switch color theme',
      'theme.dark': '☾ Dark',
      'theme.light': '☀ Light',

      'manifesto': 'Paper counts stopped meaning anything. What still means something is the podium — <span class="gold">orals</span>, <span class="gold">best papers</span>, <span class="gold">test-of-time awards</span> — credited to the first and corresponding authors\u2019 institutions <em>at the time the work was done</em>.',

      'kpi.group': 'dataset headline stats',
      'kpi.papers': 'honored papers',
      'kpi.insts': 'institutions credited',
      'kpi.venues': 'venues',
      'kpi.window': 'award window',

      'dock.controls': 'ranking controls',
      'dock.attr': 'attribution',
      'dock.credit': 'Credit',
      'credit.both': '1st + corr.',
      'credit.first': '1st author',
      'credit.corr': 'Corresponding',
      'dock.lensGroup': 'lens',
      'dock.lens': 'Lens',
      'lens.alltime': 'All-time',
      'lens.now': 'Present-day',
      'lens.halflife': 'half-life',
      'lens.yearSuffix': 'y',
      'lens.halflifeAria': 'decay half-life in years',
      'dock.yearRange': 'award year range',
      'dock.years': 'Years',
      'year.from': 'from year',
      'year.to': 'to year',
      'dock.scopeGroup': 'institution scope',
      'dock.scope': 'Scope',
      'scope.academia': 'Academia',
      'scope.industry': 'Industry',
      'scope.all': 'All',
      'dock.country': 'Country/Region',
      'country.filter': 'country/region filter',
      'country.all': 'All countries/regions',
      'dock.venueFilter': 'venue filter',
      'dock.venues': 'Venues',
      'dock.tierFilter': 'tier filter',
      'dock.tiers': 'Tiers',
      'dock.weights': 'Weights',
      'weights.reset': 'reset to defaults',
      'weights.aria': '{label} weight',

      'section.podium': 'top three institutions',
      'section.board': 'The Board',
      'legend.tiers': 'award tiers',
      'section.chart': 'Chart',
      'section.table': 'Table',
      'board.more50': 'show top 50',
      'board.more25': 'show top 25',
      'section.map': 'The Map',
      'legend.regions': 'regions',
      'map.sub': 'One map, everyone competes: area = share of all weighted credit in the current view, color = region. Hover for the breakdown; click to open the dossier.',
      'map.hidden': '{n} institutions below 0.12% share (together {pct}%) are not drawn.',
      'map.tip': '{place} · {pts} pts · {pct}% of the field',
      'section.nations': 'Nations',
      'nations.sub': 'Institutional credit rolled up by country/region. Institutions whose country/region could not be resolved are omitted.',
      'nations.tip': '{name} · {n} institutions',
      'section.vs': 'vs CSRankings',
      'vs.sub': 'CSRankings, AI areas (AI · CV · ML · NLP), 2012–2026, world — its top 20 by <em>publication counting</em>, against the same schools ranked here by <em>awards only</em> (academia view, your current weights). Gold lines hold or climb; red lines fall. CSRankings snapshot: 2026-07-10.',
      'vs.aria': 'CSRankings versus AI Rankings slopegraph',
      'vs.papers': 'CSRankings — papers',
      'vs.awards': 'AI Rankings — awards',
      'section.canon': 'The Canon',
      'canon.yw': 'year of work',
      'canon.ya': 'year awarded',
      'canon.sub': 'Every point of light is one honored paper. On the <em>year-of-work</em> axis, test-of-time awards fall back to the year the work was actually done — the faint arcs are the ten-plus years between doing something great and the field admitting it.',
      'canon.forWork': 'for work of {year}',
      'section.paths': 'Trajectories',
      'paths.sub': 'Cumulative rank as awards accrued over the last decade (by award year). Hover or tap a line.',
      'bump.aria': 'rank trajectories of leading institutions',
      'bump.after': '#{rank} after {year} awards season',
      'bump.finished': 'finished #{rank}',

      'dossier.aria': 'institution dossier',
      'dossier.close': 'close',
      'dossier.score': 'weighted score',
      'dossier.people': 'The people',
      'dossier.byYear': 'Score by year',
      'dossier.byVenue': 'By venue',
      'dossier.record': 'The record',
      'dossier.rank': 'Nº {n}',
      'dossier.papers': '{n} honored papers',
      'dossier.showAll': 'show all {n} people',
      'dossier.workOf': '(work of {year})',
      'spark.title': '{year}: {n} pts',

      'role.both': '1st + corr',
      'role.first': '1st author',
      'role.corr': 'corresponding',
      'medal.first': 'first',
      'medal.second': 'second',
      'medal.third': 'third',
      'tip.pts': '{n} pts',
      'tip.click': 'click for the record',

      'table.rank': '#',
      'table.inst': 'Institution',
      'table.type': 'Type',
      'table.score': 'Score',

      'tier.test_of_time': 'Test of Time',
      'tier.best_paper': 'Best Paper',
      'tier.honorable_mention': 'Honorable Mention',
      'tier.oral': 'Oral',

      'type.industry': 'industry',
      'type.gov': 'gov lab',
      'type.nonprofit': 'nonprofit',
      'type.facility': 'facility',
      'type.health': 'health',
      'type.archive': 'archive',
      'type.org': 'org',
      'type.academia': 'academia',

      'credit.mode.both': 'first + corresponding (50/50)',
      'credit.mode.first': 'first author',
      'credit.mode.corr': 'corresponding author',
      'lens.mode.all': 'all-time lens',
      'lens.mode.now': 'present-day lens, {y}y half-life on age of work',
      'scope.mode.all': 'academia + industry',
      'scope.mode.academia': 'academia only (incl. gov / nonprofit labs)',
      'scope.mode.industry': 'industry only',
      'board.sub': '{n} honored papers in view · credit: {credit} · {lens} · {scope}',
      'board.years': ' · awards {from}–{to}',
      'board.country': ' · {name} only',

      'region.us': 'United States',
      'region.cn': 'China',
      'region.uk': 'United Kingdom',
      'region.eu': 'Europe',
      'region.ca': 'Canada',
      'region.as': 'Asia',
      'region.row': 'Rest of world',

      'method.title': 'Method',
      'method.what': 'What counts',
      'method.whatBody': 'Only papers the community itself singled out: conference orals, best-paper–tier awards (incl. outstanding papers), honorable mentions / award candidates, and test-of-time prizes at NeurIPS, ICML, ICLR, CVPR, ICCV, ECCV, ACL and EMNLP. Regular acceptances score zero, by design. ACL and EMNLP contribute award tiers only: *ACL venues treat oral vs poster as a presentation format, not a distinction, and publish no oral lists.',
      'method.who': 'Who gets credit',
      'method.whoBody': 'The first author\'s and the corresponding author\'s institutions <em>at the time the work was done</em> — resolved from OpenReview author histories (dated positions), Crossref authorship records and manually verified sources — so a test-of-time award for 2014 work credits the 2014 lab, not the authors\' current employers. Where no corresponding author is flagged, the last author stands in, per AI convention.',
      'method.latency': 'Latency, modelled',
      'method.latencyBody': 'Every award event carries two timestamps: the year it was <em>granted</em> and the year the work was <em>done</em>. The all-time lens credits the year of work at full value; the present-day lens decays each event by the age of the work with a half-life you control — a ten-year-old triumph says less about a lab today than last year\'s does.',
      'method.weights': 'Default weights',
      'method.weightsBody': 'Test of time 10 · best paper 8 · honorable mention 3 · oral 1 — adjustable live. Credit splits 50 / 50 between first and corresponding institutions (full credit when they coincide), and equally across an author\'s multiple affiliations.',
      'foot.tpami': 'TPAMI is deliberately absent: journals have no oral / best-paper mechanism, and the PAMI community\'s test-of-time prize (Longuet-Higgins) is awarded at CVPR, which is covered. AAAI / IJCAI are excluded for low signal density.',
      'foot.coverage': 'Coverage: {papers} honored papers, affiliations resolved for {resolved} ({pct}%); unresolved papers appear in the Canon but carry no institutional credit yet. All test-of-time and best-paper affiliations are individually verified.',
      'foot.generated': 'Dataset generated {date} · award window {window} · honors from OpenReview, official award pages, ACL Anthology and CVF; affiliations via OpenReview author histories, Crossref and manual verification.',

      'empty.data': 'data.js is missing or empty — run the pipeline (see README).',

      'classic.title': 'AIRankings — classic',
      'classic.full': 'Full experience',
      'classic.subtitle': 'Awards-only rankings of AI institutions: orals, best papers and test-of-time prizes, credited to first and corresponding authors.',
      'classic.rankLead': 'Rank ',
      'classic.rankMid': ' institutions in ',
      'classic.rankTail': ' by <b>awards</b> from ',
      'classic.academic': 'academic',
      'classic.industry': 'industry',
      'classic.all': 'all',
      'classic.sector': 'sector filter',
      'classic.countryAria': 'Filter by country/region',
      'classic.tiers': 'Award tiers',
      'classic.venues': 'Venues',
      'classic.on': 'on',
      'classic.off': 'off',
      'classic.group.ml': 'Machine Learning',
      'classic.group.cv': 'Computer Vision',
      'classic.group.nlp': 'NLP',
      'classic.papers': '# Papers',
      'classic.showMore': 'show more ▾',
      'classic.scopeWord.academia': 'academic ',
      'classic.scopeWord.industry': 'industry ',
      'classic.scopeWord.all': '',
      'classic.summary.one': '{n} {scope}institution',
      'classic.summary.many': '{n} {scope}institutions',
      'classic.summary.in': '{base} in {country}',
      'classic.col.name': 'Name',
      'classic.col.tot': 'ToT',
      'classic.col.best': 'Best',
      'classic.col.hm': 'HM',
      'classic.col.oral': 'Oral',
      'classic.col.score': 'Score',
    },

    zh: {
      'meta.title': 'AI Rankings — 只有领奖台算数',
      'meta.description': '只按奖项给 AI 机构排名：口头报告、最佳论文和时间检验奖，记给论文发表时一作与通讯作者所在的机构。',
      'meta.ogDescription': '只按奖项给 AI 机构排名：口头报告、最佳论文和时间检验奖，记给论文发表时一作与通讯作者所在的机构。',

      'lang.group': '语言',
      'nav.directory': '名录',
      'nav.directoryTitle': 'CSRankings 风格的名录视图',
      'theme.switch': '切换颜色主题',
      'theme.dark': '☾ 深色',
      'theme.light': '☀ 浅色',

      'manifesto': '论文数量已经说明不了什么。还算数的是领奖台——<span class="gold">口头报告</span>、<span class="gold">最佳论文</span>、<span class="gold">时间检验奖</span>——记给一作和通讯作者<em>做这项工作时</em>所在的机构。',

      'kpi.group': '数据概览',
      'kpi.papers': '获奖论文',
      'kpi.insts': '记分机构',
      'kpi.venues': '会议',
      'kpi.window': '奖项窗口',

      'dock.controls': '排名控件',
      'dock.attr': '署名归属',
      'dock.credit': '记分',
      'credit.both': '一作+通讯',
      'credit.first': '一作',
      'credit.corr': '通讯',
      'dock.lensGroup': '镜头',
      'dock.lens': '镜头',
      'lens.alltime': '历来',
      'lens.now': '当前',
      'lens.halflife': '半衰期',
      'lens.yearSuffix': '年',
      'lens.halflifeAria': '衰减半衰期（年）',
      'dock.yearRange': '颁奖年份范围',
      'dock.years': '年份',
      'year.from': '起始年',
      'year.to': '结束年',
      'dock.scopeGroup': '机构范围',
      'dock.scope': '范围',
      'scope.academia': '学界',
      'scope.industry': '业界',
      'scope.all': '全部',
      'dock.country': '国家/地区',
      'country.filter': '按国家/地区筛选',
      'country.all': '全部国家/地区',
      'dock.venueFilter': '会议筛选',
      'dock.venues': '会议',
      'dock.tierFilter': '奖级筛选',
      'dock.tiers': '奖级',
      'dock.weights': '权重',
      'weights.reset': '恢复默认',
      'weights.aria': '{label}的权重',

      'section.podium': '前三名机构',
      'section.board': '榜单',
      'legend.tiers': '奖项层级',
      'section.chart': '图表',
      'section.table': '表格',
      'board.more50': '显示前 50',
      'board.more25': '显示前 25',
      'section.map': '版图',
      'legend.regions': '地区',
      'map.sub': '一张图，一起比：面积是当前视图里加权分数的占比，颜色表示地区。悬停看明细，点击打开档案。',
      'map.hidden': '另有 {n} 所机构占比不足 0.12%（合计 {pct}%），没有画出来。',
      'map.tip': '{place} · {pts} 分 · 占当前全部的 {pct}%',
      'section.nations': '国家与地区',
      'nations.sub': '机构分数按国家/地区汇总。没能确定国家/地区的机构不显示。',
      'nations.tip': '{name} · {n} 所机构',
      'section.vs': '对照 CSRankings',
      'vs.sub': 'CSRankings 的 AI 领域（AI · CV · ML · NLP），2012–2026，全球——对方按<em>论文数量</em>排出的前 20 所学校，对照本站按<em>只计奖项</em>的排名（学界视图，权重用你当前的设置）。金色是持平或上升，红色是下降。CSRankings 快照日期：2026-07-10。',
      'vs.aria': 'CSRankings 与 AI Rankings 对照图',
      'vs.papers': 'CSRankings — 论文数',
      'vs.awards': 'AI Rankings — 奖项',
      'section.canon': '典藏',
      'canon.yw': '工作年份',
      'canon.ya': '颁奖年份',
      'canon.sub': '每一个光点是一篇获奖论文。横轴选<em>工作年份</em>时，时间检验奖会回到工作真正完成的那一年——浅色弧线就是做成一件事、到领域承认它，中间那十几年。',
      'canon.forWork': '工作完成于 {year}',
      'section.paths': '轨迹',
      'paths.sub': '近十年奖项不断累积时的排名变化（按颁奖年）。把鼠标放上或点一条线。',
      'bump.aria': '领先机构的排名轨迹',
      'bump.after': '{year} 年奖季后排名第 {rank}',
      'bump.finished': '最终第 {rank}',

      'dossier.aria': '机构档案',
      'dossier.close': '关闭',
      'dossier.score': '加权分数',
      'dossier.people': '人物',
      'dossier.byYear': '逐年分数',
      'dossier.byVenue': '按会议',
      'dossier.record': '获奖记录',
      'dossier.rank': '第 {n} 名',
      'dossier.papers': '{n} 篇获奖论文',
      'dossier.showAll': '显示全部 {n} 人',
      'dossier.workOf': '（工作于 {year}）',
      'spark.title': '{year}：{n} 分',

      'role.both': '一作+通讯',
      'role.first': '一作',
      'role.corr': '通讯',
      'medal.first': '第一',
      'medal.second': '第二',
      'medal.third': '第三',
      'tip.pts': '{n} 分',
      'tip.click': '点击查看记录',

      'table.rank': '#',
      'table.inst': '机构',
      'table.type': '类型',
      'table.score': '分数',

      'tier.test_of_time': '时间检验奖',
      'tier.best_paper': '最佳论文',
      'tier.honorable_mention': '荣誉提名',
      'tier.oral': '口头报告',

      'type.industry': '业界',
      'type.gov': '政府',
      'type.nonprofit': '非营利',
      'type.facility': '设施',
      'type.health': '医疗',
      'type.archive': '档案',
      'type.org': '组织',
      'type.academia': '学界',

      'credit.mode.both': '一作与通讯各半（50/50）',
      'credit.mode.first': '只记一作',
      'credit.mode.corr': '只记通讯',
      'lens.mode.all': '历来镜头',
      'lens.mode.now': '当前镜头，按工作年龄衰减，半衰期 {y} 年',
      'scope.mode.all': '学界 + 业界',
      'scope.mode.academia': '只看学界（含政府与非营利实验室）',
      'scope.mode.industry': '只看业界',
      'board.sub': '当前视图 {n} 篇获奖论文 · 记分：{credit} · {lens} · {scope}',
      'board.years': ' · 奖项 {from}–{to}',
      'board.country': ' · 仅 {name}',

      'region.us': '美国',
      'region.cn': '中国',
      'region.uk': '英国',
      'region.eu': '欧洲',
      'region.ca': '加拿大',
      'region.as': '亚洲',
      'region.row': '其他地区',

      'method.title': '方法',
      'method.what': '计什么',
      'method.whatBody': '只计入社区自己挑出来的论文：NeurIPS、ICML、ICLR、CVPR、ICCV、ECCV、ACL 和 EMNLP 的口头报告、最佳论文级奖项（含杰出论文）、荣誉提名 / 奖项候选，以及时间检验奖。普通接收记零分，这是有意为之。ACL 和 EMNLP 只计入奖项层：*ACL 会议把 oral 与 poster 当作报告形式，而不是质量区分，也不公布 oral 名单。',
      'method.who': '记给谁',
      'method.whoBody': '分数记给一作和通讯作者<em>完成这项工作时</em>的机构——依据带任职时间的 OpenReview 作者履历、Crossref 署名记录，以及人工核对的来源。所以 2014 年工作拿到的时间检验奖，记的是 2014 年的实验室，不是作者现在的雇主。论文没有标通讯作者时，按 AI 领域的惯例，由末位作者顶上。',
      'method.latency': '延迟',
      'method.latencyBody': '每条奖项带两个年份：<em>颁发</em>的年份，和<em>完成工作</em>的年份。历来镜头按工作年份足额记分；当前镜头按工作的年龄衰减，半衰期可以自己调——十年前的成绩，对实验室的今天，远不如去年说明问题。',
      'method.weights': '默认权重',
      'method.weightsBody': '时间检验奖 10 · 最佳论文 8 · 荣誉提名 3 · 口头报告 1，可直接调整。一作机构和通讯机构各占一半（是同一家就记满分），一位作者挂了多个单位时再均分。',
      'foot.tpami': 'TPAMI 故意不收：期刊没有 oral / 最佳论文这套机制，PAMI 社区的时间检验奖（Longuet-Higgins）是在 CVPR 颁发的，这里已经覆盖。AAAI / IJCAI 因为信号太稀，没有纳入。',
      'foot.coverage': '覆盖范围：{papers} 篇获奖论文，已解析机构的有 {resolved} 篇（{pct}%）；还没解析的论文会出现在典藏中，但暂时没有机构分数。时间检验奖和最佳论文的机构都逐条核对过。',
      'foot.generated': '数据集生成于 {date} · 奖项窗口 {window} · 荣誉来自 OpenReview、会议官方奖项页面、ACL Anthology 和 CVF；机构信息来自 OpenReview 作者履历、Crossref 和人工核对。',

      'empty.data': '缺少 data.js 或数据为空——请先运行数据流水线（见 README）。',

      'classic.title': 'AIRankings — 名录',
      'classic.full': '完整版',
      'classic.subtitle': '只按奖项给 AI 机构排名：口头报告、最佳论文和时间检验奖，记给一作和通讯作者。',
      'classic.rankLead': '按奖项排名 ',
      'classic.rankMid': ' 机构 · ',
      'classic.rankTail': ' · ',
      'classic.academic': '学界',
      'classic.industry': '业界',
      'classic.all': '全部',
      'classic.sector': '机构类型',
      'classic.countryAria': '按国家/地区筛选',
      'classic.tiers': '奖项层级',
      'classic.venues': '会议',
      'classic.on': '开',
      'classic.off': '关',
      'classic.group.ml': '机器学习',
      'classic.group.cv': '计算机视觉',
      'classic.group.nlp': '自然语言处理',
      'classic.papers': '论文数',
      'classic.showMore': '显示更多 ▾',
      'classic.scopeWord.academia': '学界',
      'classic.scopeWord.industry': '业界',
      'classic.scopeWord.all': '',
      'classic.summary.one': '{n} 所{scope}机构',
      'classic.summary.many': '{n} 所{scope}机构',
      'classic.summary.in': '{base} · {country}',
      'classic.col.name': '姓名',
      'classic.col.tot': '检验',
      'classic.col.best': '最佳',
      'classic.col.hm': '提名',
      'classic.col.oral': '口头',
      'classic.col.score': '分数',
    },
  };

  function detectLang() {
    /* Keep in sync with the tiny inline script in index.html and classic.html. */
    let saved = '';
    try { saved = localStorage.getItem('sr-lang') || ''; } catch (e) { /* private mode */ }
    if (saved === 'en' || saved === 'zh') return saved;
    const list = (navigator.languages && navigator.languages.length)
      ? navigator.languages : [navigator.language || ''];
    for (const item of list) {
      if (/^zh/i.test(String(item || ''))) return 'zh';
    }
    return 'en';
  }

  const preset = document.documentElement.dataset.lang;
  let lang = preset === 'en' || preset === 'zh' ? preset : detectLang();

  function format(str, vars) {
    if (!vars) return str;
    return str.replace(/\{(\w+)\}/g, (m, k) => (vars[k] == null ? m : String(vars[k])));
  }

  function t(key, vars) {
    const table = STRINGS[lang] || STRINGS.en;
    const str = table[key] != null ? table[key] : (STRINGS.en[key] != null ? STRINGS.en[key] : key);
    return format(str, vars);
  }

  function apply(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    scope.querySelectorAll('[data-i18n-html]').forEach(el => {
      el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });
    scope.querySelectorAll('[data-i18n-aria]').forEach(el => {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    });
    scope.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });
    scope.querySelectorAll('[data-i18n-content]').forEach(el => {
      el.setAttribute('content', t(el.getAttribute('data-i18n-content')));
    });
    const titleKey = document.documentElement.getAttribute('data-title-key');
    if (titleKey) document.title = t(titleKey);
    scope.querySelectorAll('#lang-switch [data-lang]').forEach(btn => {
      const on = btn.getAttribute('data-lang') === lang;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.documentElement.dataset.lang = lang;
  }

  function setLang(next) {
    next = next === 'zh' ? 'zh' : 'en';
    if (next === lang) return;
    lang = next;
    try { localStorage.setItem('sr-lang', lang); } catch (e) { /* private mode */ }
    apply();
    document.dispatchEvent(new CustomEvent('sr-langchange', { detail: { lang } }));
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest && e.target.closest('#lang-switch [data-lang]');
    if (!btn) return;
    setLang(btn.getAttribute('data-lang'));
  });

  window.SR_I18N = {
    t,
    setLang,
    apply,
    get lang() { return lang; },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => apply());
  } else {
    apply();
  }
})();
