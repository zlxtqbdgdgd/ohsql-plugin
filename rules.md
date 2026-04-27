1. 来源等级必须强制标记，不许省略                                                                                                                                                                              
   
  每条 check 点必须挂一个 provenance 字段，且只能是这几个枚举值：                                                                                                                                                
                                                        
  - verified — 有具体 URL + 抓取日期 + 原文引文片段，且引文里能直接读出这条断言                                                                                                                                  
  - inferred — 来源支持相关结论，但这条是模型基于来源做的逻辑外推（必须写明从哪条 verified 派生）
  - model-generated — 完全来自模型自己的训练知识，没有外部出处                                                                                                                                                   
                                                                                                                                                                                                                 
  **军规：model-generated 的内容禁止出现在"执行命令"和"具体阈值"字段。**它们只能出现在"提示语"或"分类标签"里。这样幻觉就被关在笼子里了。                                                                         
                                                                                                                                                                                                                 
  2. 引用必须能机器校验，不准糊弄                                                                                                                                                                                
                                                        
  - 每条 verified 必须有 source.url + source.fetched_at + source.quote（≥30 字的原文片段），三个字段缺一不可                                                                                                     
  - 禁止"综合自多个来源"：要么单源，要么把每个来源各自支持哪一句拆开列出
  - 命令、参数名、阈值数字必须原文复制，不准模型改写（"InnoDB Buffer Pool" 不准写成 "innodb 缓冲池"，因为改写就丢了可搜索性）                                                                                    
                                                                                                                                                                                                                 
  写一个简单 lint 脚本就能跑：grep provenance: verified 的条目里 source.quote 非空且包含关键命令字符串。机器卡得住的规则才是真军规。                                                                             
                                                                                                                                                                                                                 
  3. 阈值数字的"不准估算"红线                                                                                                                                                                                    
                                                        
  最容易出幻觉的就是"P99 > 200ms 应警惕"这种数字。军规：                                                                                                                                                         
  
  - 阈值数字必须能从 source.quote 里直接读到，否则整条降级成 inferred 或丢弃                                                                                                                                     
  - 引文片段里没数字时，模型不准"凭经验补一个看起来合理的"——直接把字段留 null，写 "threshold_source": "需人工补充"
                                                                                                                                                                                                                 
  4. 二次校验机制（可选但强烈建议）                                                                                                                                                                              
                                                                                                                                                                                                                 
  蒸馏完后跑一遍"反向校验"：另一个模型只看 source.quote + source.url，不看模型写的 check 描述，独立判断这段引文是否真的支持那条 check。两边对不上的就打回。                                                      
                                                        
  这一步比写军规本身重要——军规防不住自欺，独立校验能防住。

---

# 附录 · 工程化落地（2026-04-27）

军规是原则，附录把它们落到具体的字段、闸门、工具与回退路径，构成"零幻觉、可溯源"的完整保证链。

## 一、保证模型 · 4 闸门同时通过才算合规

每条 fact 必须同时满足 4 个机器化闸门，缺一不可：

| 闸门 | 对应军规 | 校验对象 | 工具 / 字段 |
|---|---|---|---|
| ① 字面 verbatim | 军规 2 | source.quote 是 source.url 字面子串 | `lint-kb-quotes.mjs` 的 canonical-subset 比对 |
| ② provenance 链路完整 | 军规 1 + 1.4 | provenance ∈ {verified, inferred, model-generated} 且 inferred 必带 derived_from | `lint-kb-quotes.mjs` 的 BAD_PROVENANCE / MISSING_DERIVED_FROM 检查 |
| ③ 阈值数字读得到 | 军规 3 | fact_type=threshold 的 quote 必须含 Arabic digit / 英文数字词 / boolean default | `kb-audit.mjs --mode rewrite-quotes` 的 isThreshold gate · 实在抽不到 → 自动降级为 inferred + derived_from + confidence=0.7 |
| ④ 独立 LLM 反向校验 | 军规 4 | 另一个模型只看 (rule_id, title, quote, url) 判 pass/fail/uncertain | `kb-audit.mjs --mode reverse-check` (gpt-4o-mini · ≈ $0.10 / 全 KB 1548 facts) |

任一闸门 fail → 这条 fact 不允许进生产。CI 上 lint 红线 baseline=0，新增违规直接拦 PR。

## 二、字段模型 · 哪些字段是机器卡的

`knowledge` 表 (sqlite) 强制字段 + 触发器：

| 字段 | 类型 | 强制规则 |
|---|---|---|
| `provenance` | TEXT enum | 只允许 `verified` / `inferred` / `model-generated`；触发器 `knowledge_provenance_check_ins` + `_upd` 拦插入与更新 |
| `source_url` | TEXT | verified 必填；不允许是 array (军规 2.2) |
| `source.quote` / `quote` | TEXT (≥30 字) | verified 必填；必须 verbatim 出现在 url 缓存里 (canonical-subset) |
| `fetched_at` | TEXT (YYYY-MM-DD) | verified 必填 (军规 2.1) |
| `derived_from` | TEXT | inferred 必填 (军规 1.4)，写明从哪条 verified 派生 |
| `confidence` | REAL | verified 默认 0.95；inferred 兜底为 0.7 |

## 三、闸门 ① 字面 verbatim · 怎么防"模型改写"

`tools/lint-kb-quotes.mjs` 跑 5 种 fail 检查 + 1 个 warn 检查：

- **QUOTE_FALSE**：quote 不是 url 字面子串（按 canonical 规整：HTML entity decode + Unicode 引号→ASCII + 全角→半角 + 多空格折叠 + 大小写归一）
- **SHORT_QUOTE**：quote < 30 字
- **MULTI_SOURCE**：source 是 array / quote 含"综合自多个来源" / "based on multiple sources" / "from various sources" 等关键词（军规 2.2）
- **BAD_PROVENANCE**：provenance 非 enum；或 model-generated 带 quote
- **MISSING_DERIVED_FROM**：inferred 但 derived_from 空（军规 1.4）
- ⚠ **MISSING_FETCHED_AT**：verified 但 fetched_at 空（warn-only · 军规 2.1）

URL 文本缓存：`tools/refresh-url-cache.mjs` 用 puppeteer-core 全文抓 → 落到 `tools/url-cache/<sha1[:12]>.txt`，CI 用 `actions/cache@v4` 按 rules.json + sqlite 哈希 cache，避免每次 PR 都重抓。

`tools/lint-kb-quotes.baseline.json` 记已知遗留违规白名单（当前 `count: 0`）；新增违规不在 baseline → CI 拦。

## 四、闸门 ② provenance · 怎么防"假装有来源"

provenance 三档语义不重叠：

```
verified         有 url + fetched_at + ≥30 字 verbatim quote · 引文里能直接读出断言
inferred         来源支持相关结论 · 但本条是模型基于来源做的逻辑外推 · 必须 derived_from 指原 verified 的 url
model-generated  完全来自模型训练知识 · 没有外部出处 · 严禁出现在 "执行命令" 与 "具体阈值" 字段
```

sqlite 触发器 (`knowledge_provenance_check_ins` / `_upd`、`knowledge_inferred_check_ins` / `_upd`) 在 INSERT / UPDATE 时校验 provenance enum 与 derived_from 必填，违反直接拒写。

## 五、闸门 ③ 阈值数字 · 怎么防"凭经验补一个看着合理的"

`kb-audit.mjs --mode rewrite-quotes` 在 fact_type=threshold 的候选筛选里加硬过滤 `/[0-9]/.test(s)` —— 没数字的句子直接出局，OpenAI 也无从选。

如果 source URL 里完全找不到带数字的切题句子，按军规 3 的 fallback 路径走：

```
provenance:    verified → inferred
derived_from:  原 source_url
confidence:    0.95 → 0.7
quote:         保留原 verbatim quote (用于追溯)
```

降级原因：CheckFn 用的具体阈值数字成了"模型推断"，明确标记 inferred 让下游 (报告渲染、二次审计) 知道该数字不是字面读出来的。

英文数字词 (one / two / three / hundred 等) 与 boolean default (`Default : true|false`) 视为合规 —— quote 里"three concurrent index builds"和数字 `3` 等价。

## 六、闸门 ④ 独立 LLM 反向校验 · 怎么防"军规防不住自欺"

`kb-audit.mjs --mode reverse-check`：另一个模型 (gpt-4o-mini · 与写规则的模型解耦) 只看 (rule_id, title, source_url, quote) 判 `pass | fail | uncertain`，输出 JSON 报告。

判定规则强制：

```
★ 规则话题由 rule_id 决定 · NOT title (title 可能就是错的) ★

verdict:
  pass        quote 直接支持 rule_id 的话题
  fail        quote 是无关话题
  uncertain   边缘相关 · 但不直接支持
```

成本：1548 facts ≈ 484K input + 41K output token @ gpt-4o-mini ≈ $0.10。

报告驱动下一轮 `--mode rewrite-quotes`：fail 的 fact 自动从同 url 里抽 12 候选 verbatim 句子 → OpenAI 选/拒（同时检查 prior_quote 是不是其实对题、只是 title 错配，避免误改）。

## 七、CI / 工具栈 · 一图看清

```
                ┌────────────────────────────────────────────┐
PR 提 commit → │ .github/workflows/lint-kb-quotes.yml       │
                │  refresh-url-cache → lint-kb-quotes        │
                │  baseline.json 卡新增违规                  │
                └─────────────┬──────────────────────────────┘
                              │ baseline=0 才能 merge
                              ▼
                          merged
                              │
              手动跑（开发期 · 非 CI 强制）
                              │
                ┌─────────────▼──────────────────────────────┐
                │ tools/kb-audit.mjs · 5 mode 单工具         │
                │   --mode reverse-check    LLM 判 pass/fail │
                │   --mode rewrite-quotes   LLM 选/拒替换    │
                │   --mode fix-titles       LLM 派生 title   │
                │   --mode shrink           本地三闸门收敛   │
                │   --mode topic-audit      本地扫话题错配   │
                └────────────────────────────────────────────┘
```

每个 LLM mode 共享 `prompt_cache_key` 让 OpenAI 自动缓存 system prompt，重跑成本进一步降。

## 八、回退路径 · 谁兜底

| 触发 | 回退动作 |
|---|---|
| lint baseline 新增违规 | CI 拦 PR · 必须修干净再 merge |
| reverse-check fail | 本地跑 `--mode rewrite-quotes` 自动选 verbatim 替换 |
| rewrite-quotes 选不到 (no_candidates_after_token_filter / openai_says_none) | 残留写到 `/tmp/auto-rewrite-residue.json` · 人工换 source URL 或删整条 |
| rewrite-quotes 判 prior 其实对题 | 残留标 `title_likely_wrong` · 跑 `--mode fix-titles` 让 LLM 派生新 title |
| 阈值数字找不到 verbatim | 自动降级 verified → inferred + derived_from + confidence=0.7 |
| reverse-check uncertain | 进 review queue · 人工二选一 |

## 九、不变量 · 一句话总结"零幻觉"承诺

> 任何一条 verified fact，工具链能在 1s 内回答两个问题：
>
> 1. 这条 quote 字面出现在哪个 URL 的哪一段？(answer: lint-kb-quotes.mjs)
> 2. 一个独立模型是否同意这条 quote 支持 rule_id 的判定？(answer: kb-audit.mjs reverse-check)
>
> 任一答不上 → 这条 fact 不算 verified。

这就是"真实可溯源"的机器化定义：每个声明都能定位到一个外部权威片段，并通过独立 LLM 的反向同意。