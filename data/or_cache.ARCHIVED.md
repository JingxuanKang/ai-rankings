# or_cache 已归档到 NAS

- 位置: `nas:/volume1/Research/Paper/corpus/or-cache`（11,477 文件 / 11.53GB，rclone --size-only 全量校验通过）
- 内容: OpenReview 爬取缓存（论文 PDF、pdf_work 等），重建站点数据无需它；重跑增量 pipeline 时再取回
- 取回: `rclone copy nas:/volume1/Research/Paper/corpus/or-cache ~/Build/ai-rankings/data/or_cache --transfers 16 --sftp-set-modtime=false -P`
