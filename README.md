# AI Rankings

一个"只数奖项、不数论文"的 AI 机构排名。立场：论文数量已经失真，真正的信号是社区亲手挑出来的那一小撮——**oral、best paper（含 outstanding paper）、honorable mention / award candidate、test-of-time award**——并且只记到**一作和通讯作者发表当时的单位**头上。

覆盖 8 个会议：NeurIPS · ICML · ICLR · CVPR · ICCV · ECCV · ACL · EMNLP，奖项事件窗口 2021 – 2026 年中（test-of-time 会自然回溯致敬更早年代的工作）。

## 方法论要点

- **双时间戳建模延迟性**：每条获奖记录带 `year_awarded`（颁奖年）和 `year_work`（工作发表年）。ToT 奖记入工作完成的年代——Attention Is All You Need 的荣誉属于 2017 年的 Google，不是今天的 Google。
- **发表时刻署名单位**：三条解析路线按质量优先级层叠——① OpenReview 作者档案（带起止年份的任职历史，按 `year_work` 精确取位，覆盖 ICLR/NeurIPS/ICML）；② Crossref authorship（IEEE 系 CVPR/ICCV 2022+ 有署名单位）；③ 人工逐篇考证（全部 test-of-time 与解析失败的高权重奖项，写 `data/overrides.json`）。OpenAlex 作为补充（积分制配额，每 IP 每日约 100 次搜索）。
- **归属**：一作单位 50% + 通讯单位 50%（重合则 100%）；无通讯标记时按 AI 惯例以末位作者代位。前端可切换只看一作 / 只看通讯。
- **默认权重**：ToT 10 · Best 8 · HM 3 · Oral 1，前端滑杆实时可调。
- **两种镜头**：All-time（按 year_work 满额记分）与 Present-day（按工作年龄做半衰期衰减，回答"现在谁强"）。
- **公司可选**：industry（OpenAlex type=company）一键包含/排除。

## 使用

```bash
# 1. 原始数据就位后（data/raw/*.json，schema 见管道脚本 docstring）：
cd pipeline
python3 merge_raw.py                 # 合并去重 -> data/merged.json
python3 enrich_openreview.py ids     # 标题匹配 + 产出 profile id 清单（api2 有反爬挑战，
                                     #   notes/profiles 批量抓取需浏览器通道写入 data/or_cache/）
python3 enrich_openreview.py resolve # 档案任职历史 -> 按 year_work 解析单位
python3 enrich_crossref.py CVPR,ICCV,ECCV,ACL,EMNLP   # Crossref 补充
python3 enrich_openalex.py           # OpenAlex 残余补充（注意每日配额）
python3 build_dataset.py             # 合并 cache + overrides -> site/data.json + data.js

# 2. 直接双击打开 site/index.html（file:// 可用，无需服务器）
```

所有解析结果共用 `data/enriched/cache.jsonl`（断点续跑）；机构跨源归一（OpenAlex id / OpenReview 域名 / 人工 slug）在 build_dataset 里按规范化名称 + 别名表合并。

高权重条目（ToT / best paper）解析出错时，写 `data/overrides.json`（key 为 `venue|year|标题规范化`，值为 first_author / corresponding 结构，见 build_dataset.py docstring），重跑 build 即可覆盖。

## 目录

```
pipeline/   merge_raw.py → enrich_openalex.py → build_dataset.py（common.py 共享）
data/       raw/（4 份采集 JSON）· merged.json · enriched/cache.jsonl · overrides.json
site/       index.html + style.css + app.js + data.js（自包含，d3 已 vendor）
```

## 为什么没有 TPAMI / AAAI

期刊没有 oral / best paper 机制，没有可计数的荣誉事件；PAMI 社区的 test-of-time（Longuet-Higgins Prize）本就颁于 CVPR，已被覆盖。AAAI / IJCAI 因信号密度低而有意排除。
