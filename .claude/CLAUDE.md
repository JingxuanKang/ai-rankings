# AI Rankings

只数奖项不数论文的 AI 机构排名：oral / best paper / honorable mention / test-of-time 四级荣誉，记到一作+通讯**发表时刻**的单位，8 会（NeurIPS/ICML/ICLR/CVPR/ICCV/ECCV/ACL/EMNLP），奖项事件 **2012–2026**（ToT 致敬追溯到 1987）。已上线 **airankings.jingxuan.uk**（CF Pages），GitHub public `JingxuanKang/ai-rankings`，**push master 即自动部署**（Actions + wrangler）。

## 架构

- `site/`：纯静态自包含双页——`index.html`（可视化主站，双主题：light=CSRankings 白 / dark=深海军蓝）+ `classic.html`（CSRankings 一比一复刻视图）。**评分全在前端实时算**（权重/归属/衰减/scope/国家/会议/奖级全是活控件），改评分逻辑去 `app.js` 的 `computeScores`/`contribs`。d3 已 vendor。
- `pipeline/`：`merge_raw.py`（合并 data/raw/*.json 去重，同一论文只留最高奖级）→ 单位解析三路层叠：`enrich_openreview.py`（作者档案带任职年份区间，最优；api2 有挑战墙、批量抓取靠浏览器通道写 `data/or_cache/`；老 ICLR 用 invitation 查询）→ `enrich_crossref.py`（IEEE 系 2016+ 有署名单位）→ PDF 首页批量/人工考证（产出 `data/overrides*.json`）。`enrich_openalex.py` 仅作补充（积分制配额日限 ~100 搜索）→ `build_dataset.py`（机构跨源归一：变音符折叠+去 The 前缀+别名表+UC 校区域名映射；输出 `site/data.json`+`data.js`，含 people homepages）。
- 双时间戳是核心设计：`yw`（工作年）/`ya`（颁奖年）。ToT 记入 `yw`；Present-day 镜头按工作年龄做半衰期衰减。
- 数据现状：6,476 篇，97.8% 单位解析（残余 =131 篇 2017 前 CVPR/ECCV 付费墙 oral + 9 篇论文未印单位，页脚披露）；ToT/奖级 100%。

## 红线 / 坑

- **不要把普通接收论文加进数据**——"论文=0 分"是本项目的立场，不是遗漏。同理："全员上台"年份（ICML 2014–2017/2020 等）的 talk 不算 oral，整年排除有据可查。
- **不要引入 TPAMI/AAAI**（期刊无荣誉事件；Longuet-Higgins 在 CVPR 已覆盖；AAAI 信号密度低）——README 有公开解释，改动前先改立场。
- 同一论文多荣誉只记最高级（best paper 通常也是 oral，双记会虚增）。
- `data/overrides*.json`（7 个文件，~2,700 条人工/PDF 考证）是**金标数据，别自动重写**；单位修正在 overrides 加条目，不要手改 cache.jsonl 或 data.js。归属原则："归属做出工作的机构"（发表当年，Attention 归 2017 的 Google）。
- 可视化遵循 dataviz skill 规范：奖级=金（奖）+墨蓝（选拔）双家族、地图=7 区 categorical，均过 validator（亮金超明度带是刻意的"威望=亮度"编码，靠 legend+全格标名+表格 relief）。改色需重跑验证；tier/画布颜色统一从 CSS 变量读（`applyTheme`），别在 JS 里写死色值；文本一律 textContent（标题是外部数据，防注入）。
- 部署/回滚/健康检查见 `Deploy.md`；CF 侧事实在 `~/Build/infra/cloud/cloudflare.md`。
