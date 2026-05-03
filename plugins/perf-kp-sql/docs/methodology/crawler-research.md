# 爬虫工具 + 爬虫源调研报告

> 数据基线 · `data/quality-reports/crawler-source-probe.json`(2026-05-03 跑 · 10 源 · 30 探针 · 全可达)
> 配置基线 · `config/crawler-research-sources.json`(10 候选源)
> 方法论母本 · `~/Documents/蒸馏工程/蒸馏工程综述.md`(§3 检索 / §4 筛选 / §6 验证)
> 输出位置 · `docs/methodology/crawler-research.md`

---

## 1. 引言 · 调研目的

perf-kp-sql 节后两件事:

1. **"爬虫 vs LLM 抓取"对照实验** — 用确定性爬虫与 NotebookLM 的 LLM 抓取做横向对比 · 复用蒸馏综述 §6.1 数据三角思路;
2. **MySQL 案例库蒸馏** — 当前案例库 ~200 条以 MongoDB / 鲲鹏 / 通用 Linux 为主 · MySQL 维度需要补充 · 必须先把"抓哪些源"和"用什么工具"定下来。

本报告回答两个问题:**用什么工具**(§2 / §6) · **抓哪些源**(§3 / §4 / §5) · 并把动作衔接进蒸馏综述 §3 检索 + §4 筛选(§7)。

---

## 2. 爬虫工具对比

只列与"本地 macOS Node ESM 项目 / 中英文混杂源 / 不上商业 SaaS"匹配的候选;按"可控性 + 接入成本"排序。

| 工具 | 语言/runtime | 渲染 | 输出 | 适配本仓 | 备注 |
|---|---|---|---|---|---|
| **fetch + @mozilla/readability + jsdom** | Node ESM | 否(纯 HTTP) | HTML/正文 → markdown 需手转 | ★★★★★ | 零依赖增量 · 跟现有 `scripts/probe-crawler-source.mjs` 同栈 |
| **Playwright** | Node | 是(headless Chromium) | 完整 DOM | ★★★★ | 仅在 SPA 站(huawei-cloud-dev / mongodb-docs gatsby)兜底用 |
| **Crawl4AI** | Python | 是(Playwright 后端) | LLM-friendly markdown | ★★ | 额外引 Python 依赖链 · 跟 ESM Node 仓不匹配 |
| **Firecrawl** | 商业 SaaS | 是 | markdown + 元数据 | ★ | 调外部 API · 跟"本地可控 / 不入库凭证"原则冲突 |
| **trafilatura** | Python | 否 | 高质量正文 + meta | ★★ | 中文正文抽取最佳 · 但跨语言项目集成成本高 |
| **newspaper3k** | Python | 否 | 文章正文 | ★ | 长期维护停滞 · 中文支持弱 |
| **Scrapy** | Python | 否(可挂 splash) | 任意 | ★★ | 重型爬框架 · 单源量小不值得 |

**选型理由**(5 条):

1. 本仓主语言是 Node ESM(`scripts/*.mjs`) · 探针脚本已用 `fetch` · 主工具继续用 Node 路线避免 polyglot;
2. 候选源里 8/10 是静态 HTML 或 sitemap.xml(probe 数据 server 字段:nginx / openresty / istio-envoy / Heroku / elb / Apache / AkamaiNetStorage / cloudflare CDN) · 不需 JS 渲染就能拿到正文;
3. mongodb-docs 用 Gatsby 生成静态 HTML(probe 见 `meta name="generator" content="Gatsby 5.7.0"`)、huawei-cloud-dev 主页带客户端 JS · 必要时用 Playwright 兜底;
4. @mozilla/readability(Firefox 阅读模式同款算法)对中英文正文抽取都 OK · 配 jsdom 解析 + turndown 转 markdown 是仓内闭环;
5. Firecrawl / Crawl4AI 这种"LLM-friendly"输出是好东西 · 但当前案例库蒸馏会经过 LLM 二次处理 · markdown 质量在 readability + turndown 链路里已够用 · 不必上商业 SaaS。

---

## 3. 候选源调研(基于 probe 数据)

probe 全 10 源可达 · 1 源在 Cloudflare 后(percona) · 2 源主页跳转(openeuler / mongodb-jira)。

| id | 域名 | 可达性 | server | sitemap | Cloudflare | 推荐? |
|---|---|---|---|---|---|---|
| hikunpeng | www.hikunpeng.com | 3/3 | openresty | 多 sitemap(data1-7 + doc1-10) | 否 | 强烈推荐 |
| openeuler | docs.openeuler.org | 3/3 | elb(华为云 WAF) | 是(sitemap.xml 200) | 否 | 强烈推荐 |
| huawei-cloud-dev | developer.huaweicloud.com | 3/3 | openresty | **无**(sitemap 404) | 否 | 备用 |
| mongoing | mongoing.com | 3/3 | nginx | 是(sitemap.xml 200) | 否 | 推荐 |
| mongodb-docs | www.mongodb.com | 3/3 | istio-envoy(K8s) | 是(sitemap-index 200) | 否 | 强烈推荐 |
| mongodb-jira | jira.mongodb.org | 3/3 探针通 · 主页 302 SAML | (Atlassian 默认) | sitemap 302 → /login.jsp | 否 | 备用 |
| percona-blog | www.percona.com | 3/3 | **cloudflare**(cf-ray 9f5d4e89...-LAX) | sitemap_index.xml(301 跳) | 是 | 推荐(限速) |
| aws-graviton | github.com / raw.githubusercontent.com | 3/3 | github.com | 仓库目录树即索引 | 否 | 强烈推荐 |
| dev-to | dev.to | 3/3 | Heroku | 是(sitemap-index.xml) | 否 | 备用 |
| redhat-perf-tuning | access.redhat.com | 3/3 | Apache + AkamaiNetStorage | 是(sitemap.xml 200) | 否 | 推荐(URL 改版) |

### 3.1 探针发现的关键意外

- **hikunpeng** robots.txt 明确 `Disallow: /doc_center/` · 但同一份 robots 里 `Sitemap:` 列了 `sitemapdoc1.xml` 到 `sitemapdoc10.xml`(probe body_head 行 38) — 官方等于"禁用爬虫扫 doc_center 路径 · 但欢迎用 sitemap 列举"。**合规路径就是走 sitemap**。
- **openeuler** 主页 302 跳 `/en/` · `server: elb` + `set-cookie: HWWAFSESTIME` 揭示后端是华为云 ELB + WAF · 注意 cookie 必须保留(否则 WAF 可能拦截二次请求)。
- **huawei-cloud-dev** sitemap.xml **404**(`{"error":"Not Found"}`) · robots.txt 仅 `Allow:/` · 没有官方索引方式。只能从主页或栏目页起爬 + 限制深度。
- **mongoing** 用 nginx + WordPress + AnsPress(probe 见 `wp-content/plugins/anspress`) · 三 sitemap 全可读 · 抓取压力小。
- **mongodb-docs** server `istio-envoy` + `x-cache: Miss from cloudfront` 表明 K8s 网格 + CloudFront CDN · sitemap-index 套娃(8 个子 sitemap 含 docs / developer / community / learn) · 索引非常完整。
- **mongodb-jira** sitemap 与主页都 302 到 `/login.jsp` 或 `/plugins/servlet/samlsso` · **匿名用户拿不到 ticket 列表**。要爬必须走"已登录 + REST API"或外部检索(Google `site:jira.mongodb.org`)。
- **percona-blog** `server: cloudflare` + `cf-ray: 9f5d4e891a8ef7d9-LAX` · `sitemap.xml` 301 跳到 `sitemap_index.xml` · 现阶段不是 challenge 模式所以 probe 通 · 但**规模化抓取必须配真实 UA + 延迟 + 可能 JA3 指纹问题**。
- **aws-graviton** 直接 fetch `raw.githubusercontent.com/aws/aws-graviton-getting-started/main/*.md` 200 OK · 这是最稳的源(纯 markdown · 无渲染 · 无反爬)。
- **redhat-perf-tuning** sitemap 通 · 但样本 URL `access.redhat.com/documentation/...` **301 跳 `docs.redhat.com`**(Red Hat 2024 域名迁移) — 配置里 trust source 域名要改成 `docs.redhat.com` · 否则一直撞 301。
- **dev-to** Heroku 后 + `x-cache: HIT` 表明前置 CDN · sitemap-index 完整 · 但**社区博客信噪比差**(蒸馏综述 §4.4 反模式) · 抓取后必须严筛。

---

## 4. top 8 源最终推荐

按"信任等级 + 可达性 + 跟 NLM 源去重"打分:

| 排名 | id(域名) | 一句话理由 |
|---|---|---|
| 1 | **hikunpeng**(www.hikunpeng.com) | 鲲鹏一手文档 · sitemap 完整 · 当前 KB kunpeng 维度只有 4 NLM URL(扩展空间最大) |
| 2 | **mongodb-docs**(www.mongodb.com) | MongoDB 官方文档 · sitemap-index 套娃覆盖 docs/developer/community · NLM mongo 域已有 33 URL 但仍以参数文档为主 · 需补 production-notes/journaling 类 |
| 3 | **openeuler**(docs.openeuler.org) | 国产 Linux 官方调优文档 · sitemap OK · NLM os 域只有 7 篇 kernel.org · 这条补国产侧 |
| 4 | **redhat-perf-tuning**(docs.redhat.com) | RHEL Performance Tuning Guide 是 openEuler 同源 · 蒸馏综述 §6.1 数据三角的最佳交叉源(但要用 docs.redhat.com 而非 access.redhat.com) |
| 5 | **aws-graviton**(github.com/aws/aws-graviton-getting-started) | ARM64/Graviton 一手指南 · raw markdown 直读 · 0 反爬 · 跟 hikunpeng 互验 |
| 6 | **percona-blog**(www.percona.com) | MongoDB/MySQL 调优实战博客 · 案例库已引 3 条 · 节后 MySQL 蒸馏强依赖此源 · 但要小心 Cloudflare |
| 7 | **mongoing**(mongoing.com) | 中文 MongoDB 社区 · 案例库已有引用 · 补中文长尾踩坑 · sitemap 完整 |
| 8 | **huawei-cloud-dev**(developer.huaweicloud.com) | 鲲鹏 + 数据库调优中文工程博客 · 没 sitemap 但主页可达 · 跟 hikunpeng 形成"官方文档 + 工程博客"组合 |

不进 top 8 的:

- **mongodb-jira** → 匿名 SAML 拦截 · 改用 `site:jira.mongodb.org` 经搜索引擎引流到具体 ticket;
- **dev-to** → 信噪比差 · 案例库已有 1 条引用(devaaai 那篇)够了 · 不规模化抓。

**跟 NLM 源去重检查**:

- mongo NLM(33 URL)以 `mongodb.com/docs/manual/*` 为主 — 推荐源里 mongodb-docs 重叠但目标是补 `production-notes / journaling / replica-set-oplog` 等运维类(probe sitemap 也覆盖) · 走"sitemap 列举 → 跟 NLM URL diff → 抓 diff"流程不冲突;
- kunpeng NLM(4 URL)极少 — hikunpeng + huawei-cloud-dev 几乎全是新增;
- os NLM(7 URL)全是 kernel.org rst — openeuler + redhat-perf-tuning 域名完全不同 · 0 重叠。

---

## 5. 抓取策略(每个推荐源)

| 源 | 起点 | 关键 path | 速率 | 反爬规避 |
|---|---|---|---|---|
| hikunpeng | sitemap/sitemapdoc1.xml ~ sitemapdoc10.xml | `/document/detail/zh/kunpengdbs/**` · `/document/detail/zh/perftuning/**` | 1 req/2s | UA 用真浏览器串;robots Disallow `/doc_center/` 直链就别访问 |
| mongodb-docs | sitemap-index → docs/sitemap.xml | `/docs/manual/administration/**` · `/docs/manual/core/**` | 1 req/1s | 无特殊;CloudFront 自带限流 |
| openeuler | sitemap.xml(已含 zh + en hreflang) | `/zh/docs/**/performance**` · `/zh/docs/**/tuning**` | 1 req/2s | 保留 HWWAFSESTIME cookie;UA 别用默认 |
| redhat-perf-tuning | docs.redhat.com sitemap(注意是 docs 不是 access) | `/documentation/en-us/red_hat_enterprise_linux/9/html/monitoring*/*` | 1 req/2s | 跟 301 一次到 docs.redhat.com 后落库 |
| aws-graviton | github tree API 或 raw URL 直枚举 | repo 根 `*.md` + `c-c++.md` `optimizing.md` `SIMD_and_vectorization.md` | 5 req/s(GitHub raw 宽松) | 用 GITHUB_TOKEN(env var · 不入库)避免匿名限流 |
| percona-blog | sitemap_index.xml(301 后) | `/blog/*tuning*` · `/blog/*mongodb*` · `/blog/*mysql*` | **1 req/5s** | 真实 Chrome UA · 无 token · 失败重试加抖动 · cf-ray 出现 challenge 立即停 |
| mongoing | sitemap.xml → post-sitemap.xml | `/article/*` `/archives/*` · 排除 `/wp-admin/` | 1 req/3s | nginx 普通限流;UA 真实即可 |
| huawei-cloud-dev | 无 sitemap · 从 `/blog/` 栏目目录爬 + 深度 ≤ 2 | `/blog/topic/*kunpeng*` `/blog/topic/*mongo*` | 1 req/3s | 保留 HWWAFSESTIME cookie · 限制总页数避免被 WAF 标记 |

通用原则(蒸馏综述 §3.1 + §4.3):

- 每源的"已抓 URL"落库 · 增量抓 · 不重复;
- 抓回的 HTML 用 readability + turndown → markdown · 同时保存 raw HTML 一份(后续 reproduce);
- 每条记录强制带 `source_url + fetched_at + content_hash` 三元组(蒸馏综述 §6.2 PRISMA-Lite 可追溯)。

---

## 6. 工具选型最终方案

**主工具** · `fetch + @mozilla/readability + jsdom + turndown`(纯 Node ESM · 同 `scripts/probe-crawler-source.mjs` 栈) — 候选源 8/10 是静态 HTML · 这条链路零外部依赖 + 可控 + 跟仓库已有 ESM 脚本对齐。

**备用工具** · `Playwright`(headless Chromium) — 仅当主工具拿不到正文(JS-rendered SPA / 需登录交互)时启用;首选 percona-blog 出现 Cloudflare challenge 时用真 Chromium 过 JA3 指纹检测 · 第二目标是 huawei-cloud-dev 的客户端渲染栏目页。

---

## 7. 对接蒸馏综述

爬虫调研在四步流水线里的位置:

| 蒸馏阶段 | 综述章节 | 爬虫工作的角色 |
|---|---|---|
| 检索 | §3.1 query 矩阵 | top 8 源 = 把"site: 限定的精确检索"前置成"站点级穷举";sitemap 等于把综述 §3.4 "Deep Research 列 source list"换成"我来列" |
| 检索 | §3.4 LLM 时代检索范式 | NotebookLM 是"已选定源 → 本地问答" · 爬虫是"未选定源 → 候选池";这次推荐 top 8 输出后 · 再喂给 NLM 做问答(角色互补) |
| 筛选 | §4.1 SIFT | 横向核源在抓回后做 · 但 trust_tier(`vendor-primary` / `official` / `vendor-blog` / `community-blog`)已经在 config 里预标 · 等于把 SIFT 的 "I" 步骤工程化前置 |
| 筛选 | §4.3 漏斗 | 抓取阶段产生 N₁(全部 sitemap URL) → robots/path 白名单过滤产 N₂ → readability 抽正文失败丢出 N₃ |
| 验证 | §6.1 数据三角 | redhat-perf-tuning + openeuler 互证 · hikunpeng + aws-graviton 互证 ARM64 调优 · mongodb-docs + percona-blog 互证 MongoDB |
| 验证 | §6.3 反偏倚 | 中英源都覆盖(避免生态系偏倚) · 官方 + 工程博客都覆盖(避免权威光晕) · 反向求证则要节后手动补搜 |

---

## 8. 风险 + 待手动核验项

| # | 项 | 标记 |
|---|---|---|
| 1 | percona-blog 规模化抓取(>50 页/h)是否触发 Cloudflare challenge · probe 单次 OK 不代表批量 OK | [需手动核验] |
| 2 | mongodb-jira 是否有匿名可读的 REST API(如 `/rest/api/2/search?jql=`) 替代 sitemap | [需手动核验] |
| 3 | huawei-cloud-dev `/blog/topic/*kunpeng*` 真实 URL pattern · probe 没探具体栏目 | [需手动核验] |
| 4 | redhat-perf-tuning 迁移后 `docs.redhat.com` 是否有独立 sitemap · 还是与 access.redhat.com 共享 | [需手动核验] |
| 5 | hikunpeng sitemapdoc1-10.xml 总 URL 数 · 影响初次全量抓的预算 | [需手动核验] |
| 6 | openeuler ELB + WAF 长会话超时 · 跨小时抓需不需要重新拿 cookie | [需手动核验] |
| 7 | mongoing post-sitemap.xml 最近更新时间(probe 见 sitemap.xml 索引项 lastmod 是 2024-12) · 是否仍活跃 | [需手动核验] |
| 8 | aws-graviton repo 是否有非根 markdown(子目录 .md) · 当前 README + 几个文件够不够 | [需手动核验] |

风险:

- Cloudflare 升级反爬(percona) · 备用 Playwright 通常能过基础 challenge · 但未来若启用 Turnstile/JA4 要重新评估;
- robots.txt 变动 · 节后周期性 re-probe(已有脚本) · 任何 Disallow 新增立即停对应路径;
- 案例库引用域名漂移(redhat 已发生) · trust source 配置加 301 跟随策略 · 落库时记录最终 URL。

---

> 报告完成 · 行数随仓库 lint 后微调 · 主工具 fetch+readability · 备用 Playwright · 8 [需手动核验] 项节后补
