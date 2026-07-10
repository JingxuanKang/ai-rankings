# Deploy — AI Rankings

纯静态站，托管在 **Cloudflare Pages**，无后端、无构建步骤。

## 现状

| 项 | 值 |
|---|---|
| Pages 项目 | `airankings`（account `5ad70f023c440fa4858a4bd4eaf5ed41`） |
| 生产域名 | https://airankings.jingxuan.uk（CNAME → `airankings-d3l.pages.dev`，proxied，zone `jingxuan.uk`） |
| 默认域名 | https://airankings-d3l.pages.dev |
| 部署内容 | 仓库 `site/` 目录原样上传（7 个文件，data.js ≈2MB，CDN gzip） |
| 凭据 | keychain `cloudflare-pages-token`（Pages Write）；DNS 用 `cloudflare-ddns-token` |

## 部署 / 更新

```bash
cd ~/Build/ai-rankings
CLOUDFLARE_API_TOKEN=$(security find-generic-password -s cloudflare-pages-token -w) \
CLOUDFLARE_ACCOUNT_ID=5ad70f023c440fa4858a4bd4eaf5ed41 \
npx wrangler pages deploy site --project-name=airankings --branch main --commit-dirty=true
```

数据更新流程：跑管道（见 README）重建 `site/data.js` → 上面命令重新 deploy → done。

## 健康检查

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://airankings.jingxuan.uk/            # 期望 200
curl -s -o /dev/null -w '%{http_code}\n' https://airankings.jingxuan.uk/classic.html # 期望 200
```

## 回滚

```bash
# 列历史部署，每次 deploy 都有独立 URL
CLOUDFLARE_API_TOKEN=$(security find-generic-password -s cloudflare-pages-token -w) \
CLOUDFLARE_ACCOUNT_ID=5ad70f023c440fa4858a4bd4eaf5ed41 \
npx wrangler pages deployment list --project-name=airankings
# 回滚 = 在 CF dashboard 该项目 Deployments 里 "Rollback to this deployment"，
# 或 git checkout 旧版 site/ 后重新 deploy。
```

## 故障排查

- **522 / 未生效**：Pages 自定义域名激活 + DNS 传播需 1–5 分钟；确认 zone `jingxuan.uk`
  里 `airankings` CNAME 存在且 proxied。
- **页面白屏**：几乎必是 `data.js` 缺失或损坏——重跑 `pipeline/build_dataset.py` 再 deploy。
- Pages 项目/域名的 CF 侧事实记录在 `~/Build/infra/cloud/cloudflare.md`。
