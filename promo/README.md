# promo — AI Rankings 宣传视频

71.5 秒 1920×1080 动效视频，中文文案，浅色主题（站点亮色配色 + 暖白底），8 个场景：论文数失效 → 四级荣誉权重 → 按工作年份记功（ResNet 例）→ 数据规模 → 2012–2026 学界累计榜赛跑 → 真实站点控件（视角 / 范围 / 档案）→ 地图、经典、国家与地区 → 片尾。站点画面是 airankings.jingxuan.uk 的真实截图（亮色主题，英文界面），数字全部由 `../site/data.json` 按站点默认评分算出。

运行环境：macOS 本机，`promo/` 内的 npm 依赖（playwright）+ ffmpeg + python3/numpy。

- `scripts/shots.mjs`：打开线上站点，用亮色主题截出各区块与各控件状态，输出到 `shots/`。
- `scripts/build_data.py`：从 `../site/data.json` 算出 KPI、各奖级篇数和逐年累计榜，机构名换成中文，写 `html/data.js`。
- `html/index.html`：全部画面与时间轴，`window.__render(t)` 确定性渲染。浏览器直接打开即循环预览，`?t=12.3` 定格某一帧。
- `scripts/music.py`：合成 100 BPM lo-fi 配乐（FM 电钢琴 + 贝斯 + 鼓 + 点击 / 钟声），卡点对齐场景切点。
- `scripts/render-html.mjs`：Playwright 按 30 fps 逐帧截图，ffmpeg 合成 `out/ai-rankings-promo.mp4`；`--stills 4,18,32` 只出单帧 PNG。

```bash
npm install && npx playwright install chromium
npm run shots
npm run data
npm run music
npm run render
```

场景切点（秒）在 `html/index.html` 的 `data-from/data-to` 和 `scripts/music.py` 两处，改一处要同步另一处。`shots/` 与 `out/` 为生成物，不入库。站点 UI 或数据变了，重跑 `shots` 和 `data` 再出片。
