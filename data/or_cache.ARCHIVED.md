# or_cache 已归档到 NAS

- 位置: `nas:/volume1/Research/Paper/corpus/or-cache`（11,477 文件 / 11.53GB，rclone --size-only 全量校验通过）
- 内容: OpenReview 爬取缓存（论文 PDF、pdf_work、`profiles.jsonl`、`homepages_extra_*.json` 等）。
- 重跑 `pipeline/build_dataset.py` 前必须先取回：作者主页只来自这里的 `profiles.jsonl` 与 `homepages_extra_*.json`。目录不存在时 `build_dataset.py` 直接退出。
- 取回: `rclone copy nas:/volume1/Research/Paper/corpus/or-cache ~/Build/ai-rankings/data/or_cache --transfers 16 --sftp-set-modtime=false -P`
