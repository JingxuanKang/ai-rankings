# AI Rankings

[English](README.md) | **简体中文**

> 只有领奖台算数。

**在线访问：[airankings.jingxuan.uk](https://airankings.jingxuan.uk)** · [Directory（CSRankings 风格）视图](https://airankings.jingxuan.uk/classic.html)

一个"只数奖项、不数论文"的 AI 机构与人物排名。接收论文数是可以刷的——多招人、多投稿、多中稿，排名就涨；刷不动的是社区亲手挑出来的那一小撮。本项目**只**统计八个顶会的 oral、best paper（含 outstanding paper）、honorable mention / 官方 award candidate 和 test-of-time 奖：

> NeurIPS · ICML · ICLR · CVPR · ICCV · ECCV · ACL · EMNLP

普通接收论文**记 0 分——这是立场，不是遗漏**。

![AI Rankings 截图](docs/screenshot.png)

## 方法论

**记给谁。** 每篇获奖论文的分数记给**一作**和**通讯作者**在**论文发表当时**署名的机构（各 50%，重合则拿满；作者多单位均分）。论文未标注通讯时，按 AI 领域惯例以末位作者代位。中间作者不记分。

**延迟性建模。** 每条获奖记录带两个时间戳：颁奖年（`year_awarded`）与工作完成年（`year_work`）。2024 年颁给 2014 年论文的 test-of-time，荣誉记给 2014 年的那个实验室——Attention Is All You Need 属于 2017 年的 Google，而不是其作者今天的雇主。**All-time** 镜头按工作年满额记分（看家底）；**Present-day** 镜头按工作年龄做可调半衰期衰减（看当前火力），两个问题分开回答。

**默认权重**（界面可实时调节）：

| 层级 | 权重 |
|---|---|
| Test of Time | 10 |
| Best / Outstanding Paper | 8 |
| Honorable Mention / Award Candidate | 3 |
| Oral | 1 |

**一切皆为实时控件**：归属模式（一作/通讯/各半）、镜头与半衰期、学界/业界（默认只看学界）、国家、会议、奖级、权重，全部在前端毫秒级重算。点开任一机构进入档案：获奖人员名单（链接个人主页）、逐年分数、完整获奖记录；Directory 视图复刻 CSRankings 的经典可展开表格。

## 数据

- **6,476 篇获奖论文**（颁奖窗口 2012 – 2026 年中；test-of-time 追溯到 1987 年的工作），单位解析率 97.8%——test-of-time 与 best-paper 级全部解析，未解析尾部约 130 篇是 2017 年前 CVPR/ECCV 的付费墙 oral（无开放版本）。
- 荣誉数据全部来自官方来源（OpenReview、会议奖项公告、ACL Anthology、CVF Open Access），每条带来源链接。"全员上台"的会议年份（如 2010 年代中期的若干届 ICML）不计入 oral 层——人人都有的荣誉不是荣誉。
- 单位解析三路层叠：① OpenReview 作者档案（带任职起止年份，精确到"工作那年在哪"）；② Crossref 署名记录；③ 论文 PDF 首页批量提取 + 抽检；全部 test-of-time 与 best-paper 级条目逐篇人工核验。
- 机构名跨源归一（变音符折叠、别名表、校区消歧）。

**已知局限。** 末位作者代位通讯是近似；少量国别不明的机构归入 "Unknown"。TPAMI 有意不收（期刊没有 oral/best paper 机制，PAMI 社区的 test-of-time 即 Longuet-Higgins 奖颁于 CVPR，已覆盖）；AAAI/IJCAI 因信号密度低排除。

## 致谢与许可

本项目最初的灵感来自 **@Lumos（HKU）**在 X/Twitter 上的一篇帖子——他统计了机器学习顶会 best paper 在地区与机构间的分布，谢谢。

排名基于公开的会议荣誉信息汇编；奖项归各会议及其程序委员会所有；署名数据来自 OpenReview、Crossref 与论文本身。本项目与任何会议、CSRankings（Directory 视图向其经典布局致敬）或任何被排名机构均无关联。

代码：[MIT](LICENSE)。数据集（`site/data.json`）：CC BY 4.0——使用请引用本仓库。
