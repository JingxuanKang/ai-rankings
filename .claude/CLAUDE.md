# Signal Rank

只数奖项不数论文的 AI 机构排名：oral / best paper / honorable mention / test-of-time 四级荣誉，记到一作+通讯**发表时刻**的单位（OpenAlex authorship），8 会（NeurIPS/ICML/ICLR/CVPR/ICCV/ECCV/ACL/EMNLP），奖项事件 2021–2026。

## 架构

- `pipeline/`：`merge_raw.py`（合并去重，同一论文只留最高奖级）→ `enrich_openalex.py`（单位解析，缓存 `data/enriched/cache.jsonl` 断点续跑）→ `build_dataset.py`（输出 `site/data.json` + `data.js`）。
- `site/`：纯静态自包含（d3 已 vendor 在 `site/vendor/`），**评分全在前端实时算**——权重/归属模式/衰减/公司开关/会议筛选都是 live 控件，改评分逻辑去 `app.js` 的 `computeScores`/`contribs`。
- 双时间戳是核心设计：`yw`（工作年）/`ya`（颁奖年）。ToT 记入 `yw`；Present-day 镜头按工作年龄做半衰期衰减。

## 红线 / 坑

- **不要把普通接收论文加进数据**——"论文=0 分"是本项目的立场，不是遗漏。
- **不要引入 TPAMI/AAAI**（期刊无荣誉事件；Longuet-Higgins 在 CVPR 已覆盖；AAAI 信号密度低）——README 有公开解释，改动前先改立场。
- 同一论文多荣誉只记最高级（best paper 通常也是 oral，双记会虚增）。
- 高权重条目的单位修正走 `data/overrides.json`，**不要手改 cache.jsonl 或 data.js**。
- 可视化遵循 dataviz skill 规范：双主题（默认 light，可切 dark），奖级配色为"稀有金（ToT/Best）+ 墨蓝（HM/Oral）"双家族，两模式均过 validator 的 CVD/色度/对比检查（light: #94600a/#c08a14/#3c62a8/#6f93d4 on #faf8f2；dark: #ffd76a/#dfa93f/#7fa5e3/#4a6cb2 on #131318）；亮金超出 categorical 明度带是刻意的"威望=亮度"编码（legend+标签+表格作 relief）。改色需重跑验证；tier/画布颜色统一从 CSS 变量读（`applyTheme`），别在 JS 里写死色值；文本一律 textContent（标题是外部数据，防注入）。
- demo 数据生成器在 session scratchpad，不属于项目；`site/data.js` 若标注 "(DEMO DATA)" 说明管道还没跑真数据。
