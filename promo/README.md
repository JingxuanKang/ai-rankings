# promo — AI Rankings 宣传视频

71.5 秒 1920×1080 动效视频，英文文案，8 个场景：论文数失效 → 四级荣誉权重 → 按工作年份记功（ResNet 例）→ 数据规模 → 2012–2026 学界累计榜赛跑 → 真实站点控件（镜头 / 范围 / 档案）→ 地图、Canon、Nations → 片尾。站点画面是 airankings.jingxuan.uk 的真实截图（暗色主题），数字全部由 `../site/data.json` 按站点默认评分算出。

同一分镜有两套实现，共用截图、数据和配乐：

- `src/`：Remotion（React）版，`npm run render` 出 `out/ai-rankings-promo-remotion.mp4`；`npm run studio` 打开时间轴预览。
- `html/index.html`：纯 HTML 版，`window.__render(t)` 确定性渲染。浏览器直接打开即循环预览，`?t=12.3` 定格某一帧。`scripts/render-html.mjs` 用 Playwright 逐帧截图，再用 ffmpeg 合成 `out/ai-rankings-promo-html.mp4`；`--stills 4,18,32` 只出单帧 PNG。

运行环境：macOS 本机，`promo/` 内的 npm 依赖（remotion、playwright）+ ffmpeg + python3/numpy。

- `scripts/shots.mjs`：打开线上站点，切暗色主题，截出各区块与各控件状态，输出到 `public/shots/`。
- `scripts/build_data.py`：从 `../site/data.json` 算出 KPI、各奖级篇数和逐年累计榜，写 `src/data.json` 与 `html/data.js`。
- `scripts/music.py`：合成 100 BPM lo-fi 配乐（FM 电钢琴 + 贝斯 + 鼓 + 点击 / 钟声），卡点对齐场景切点。

```bash
npm install && npx playwright install chromium
npm run shots
npm run data
python3 scripts/music.py out/music-raw.wav
ffmpeg -y -i out/music-raw.wav -af loudnorm=I=-16:TP=-1.5:LRA=9 -ar 44100 out/music.wav
cp out/music.wav public/music.wav
npm run render                    # Remotion 版
node scripts/render-html.mjs      # HTML 版
```

场景切点（秒）在 `src/Promo.tsx` 的 `SCENES`、`html/index.html` 的 `data-from/data-to` 和 `scripts/music.py` 三处，改一处要同步另外两处。`public/shots/`、`public/music.wav` 与 `out/` 为生成物，不入库。站点 UI 或数据变了，重跑 `shots` 和 `data` 再出片。
