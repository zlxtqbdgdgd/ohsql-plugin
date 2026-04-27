# perf-kp-sql · 整 `rules` 表同步 skillhub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended for this small plan) or superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 ohsql-plugin 的 `plugins/perf-kp-sql/data/knowledge.sqlite` 一次性追平 skillhub `skills/perf-kp-sql/data/knowledge.sqlite`,关掉所有 6 个字段的 gap(318 source_url + 32 source_title + 28 metrics + 7 checks + 6 recommendations + 9 enabled)。再补上 URL 维度的源 JSON ↔ KB drift 守护,防止 `kb-build` 重建后回退。

**Architecture:**
- **整库 cp** — 已验证非 `rules` 表 7 张全部字节一致(`knowledge / flame_patterns / knowledge_fts / knowledge_fts_config / knowledge_vec_chunks / knowledge_vec_info / sqlite_sequence`),`rules` 表 411 个 rule_id 完全相同且 plugin 单向落后(0 regression)。所以 `cp skillhub_kb plugin_kb` 是最干净的同步,git 那一行 binary diff 已经把所有 gap 一次性写入。
- **drift 守护(URL only)** — 从 KB 反向同步 `source.url / source.title` 到所有 source JSON 文件,然后给 `kb-validate.ts` 加一道 lint:source.url ↔ KB.source_url 不一致就 fail。其他字段(metrics/checks/recommendations)的反向同步暂不做,因为 source JSON schema 不直接 1:1 映射 KB(kb-build 有 transform),那是另一个 PR 的事。
- **Audit 工件** — 先把这次 gap 报告落到 `tools/audit/rules-gap-from-skillhub-2026-04-26.md`,commit 信息引用它,reviewer 知道改动范围。

**Tech Stack:** Node.js, better-sqlite3,纯文件操作。无 WebFetch、无 OpenAI。

**Gap baseline(本次 PR 起点,2026-04-26):**

| 字段 | 差异行数 | 方向 |
|---|---|---|
| `source_url` | 318 (28 backfill + 290 refine) | 单向(plugin 落后) |
| `source_title` | 32 | 单向 |
| `metrics` | 28 | 单向(skillhub 加 `parse:` 路径) |
| `checks` | 7 | 单向(skillhub 把"自由文本"换成"指标 key+op+value") |
| `recommendations` | 6 | 单向(plugin `[]` → skillhub `[{action,...}]`) |
| `enabled` | 9 | 单向(skillhub 已开,plugin 还关) |
| 倒退方向 | **0** | — |

**估算工作量:** Phase A 15 分钟,Phase B 30 分钟,合计 45 分钟,2 commits。

---

## File Structure

**Will create:**
```
plugins/perf-kp-sql/tools/audit/
  .gitkeep
  rules-gap-from-skillhub-2026-04-26.md   # 本次 PR gap 报告(留痕)
plugins/perf-kp-sql/tools/
  sync-source-json-from-kb.mjs            # KB → source JSON 反向同步(URL/title)
docs/superpowers/plans/
  2026-04-26-perf-kp-sql-url-fix-all.md   # 本文件
```

**Will modify:**
```
plugins/perf-kp-sql/
  data/knowledge.sqlite                   # 整库覆盖(rules 表 6 字段同步)
  data/common/kunpeng-rules.json          # source.url + source.title 同步
  data/seeds/mongo-extended.json          # 同上
  (其他 data/*.json 凡含规则的)            # 同上
  tools/kb-validate.ts                    # 加 URL drift 检查
  .claude-plugin/plugin.json              # version 0.9.1 → 0.10.0 → 0.11.0
  .codex-plugin/plugin.json               # 镜像
```

---

## Phase A — 整 `rules` 表同步 skillhub(Commit 1)

### Task A1: 拉新分支 + 落 gap 报告

**Files:**
- Create: `plugins/perf-kp-sql/tools/audit/.gitkeep`
- Create: `plugins/perf-kp-sql/tools/audit/rules-gap-from-skillhub-2026-04-26.md`

- [ ] **Step 1: 拉分支**

Run:
```bash
cd /Volumes/WD_BLACK/myagent/new_ohsql/ohsql-plugin
git checkout main
git pull --ff-only origin main
git checkout -b sync/perf-kp-sql-rules-from-skillhub
```

Expected: `Switched to a new branch 'sync/perf-kp-sql-rules-from-skillhub'`,工作树干净。

- [ ] **Step 2: 创建 audit 目录与 gap 报告占位**

Run:
```bash
mkdir -p plugins/perf-kp-sql/tools/audit
touch plugins/perf-kp-sql/tools/audit/.gitkeep
```

- [ ] **Step 3: 写 gap 报告**

Create `plugins/perf-kp-sql/tools/audit/rules-gap-from-skillhub-2026-04-26.md`:

```markdown
# perf-kp-sql · plugin 与 skillhub `rules` 表 gap · 2026-04-26

> 同步源:skillhub commit `5235484fcb3e09be3b25dc4da2ec1ecc8a355794`
> 同步对象:plugins/perf-kp-sql/data/knowledge.sqlite

## 结构层

非 `rules` 表(`knowledge`、`flame_patterns`、`knowledge_fts*`、`knowledge_vec*`、`sqlite_sequence`)字节级一致,本次同步只触动 `rules` 表。

## `rules` 表字段差异(411 行 rule_id 完全相同,无新增/删除规则)

| 字段 | 差异行数 | 性质 |
|---|---|---|
| source_url | 318 | 28 backfill (plugin NULL → skillhub 有) + 290 refine (skillhub 更精确) |
| source_title | 32 | 跟随 source_url |
| metrics | 28 | skillhub 加 `parse:"db:serverStatus.xxx"` 路径(配 collector) |
| checks | 7 | skillhub 用具体 metric key + op + value 替换自由文本 shell 片段 |
| recommendations | 6 | plugin `[]` → skillhub `[{action,rationale,...}]` |
| enabled | 9 | 全部 plugin 关、skillhub 开 |
| 倒退方向 | 0 | — |

## 9 条本次新启用的规则

```
mongo-runtime-ticket-queue-overload
mongo-config-index-build-memory-limit-spill
mongo-3-nfs-options
mongo-performance-ulimit-settings
mongo-performance-readahead-setting
mongo-net-maxincomingconnections-recommendation
kunpeng.bios.smmu_enabled
kunpeng.bios.cpu_prefetch_enabled
mongo-kunpeng-numa-binding
```

这 9 条同时也在 `metrics` / `checks` 差异列表里 — 因为 skillhub 把它们的 collector/check 写实在了才打开。

## 同步方式

`cp skillhub/.../knowledge.sqlite plugin/.../knowledge.sqlite`(整库 cp 即可,因为只 `rules` 表有差异且单向)。
```

### Task A2: 备份当前 plugin KB

- [ ] **Step 1: 文件备份**

Run:
```bash
cp plugins/perf-kp-sql/data/knowledge.sqlite plugins/perf-kp-sql/data/knowledge.sqlite.pre-skillhub-sync.bak
ls -la plugins/perf-kp-sql/data/knowledge.sqlite*
```

Expected: 看到 `knowledge.sqlite` + `knowledge.sqlite.pre-skillhub-sync.bak` 两个文件,大小相同。`.bak` 用于整段回滚保险(脚本另存的 `.bak.<ts>` 在本任务里不会用到,因为我们走 cp,不走 sqlite UPDATE)。

### Task A3: 在 skillhub 侧 checkpoint WAL,然后 cp 整库

**说明:** sqlite WAL 模式下 `.sqlite` 主文件可能不含未 checkpoint 的写入。我们用 better-sqlite3 的 `db.backup()` API 做原子拷贝,比直接 `cp` 安全。

- [ ] **Step 1: 用 db.backup() 把 skillhub KB 原子写入 plugin 路径**

Run:
```bash
node -e "
const Database = require('better-sqlite3');
const path = require('path');
const SH = '/Volumes/WD_BLACK/myagent/new_ohsql/ohsql-skillhub/skills/perf-kp-sql/data/knowledge.sqlite';
const PL = path.resolve('plugins/perf-kp-sql/data/knowledge.sqlite');
const db = new Database(SH, {readonly: true});
db.backup(PL).then(() => {
  console.log('backup written to', PL);
  db.close();
}).catch(e => { console.error(e); process.exit(1); });
"
```

Expected: `backup written to /.../plugins/perf-kp-sql/data/knowledge.sqlite`,无报错。

- [ ] **Step 2: 删 plugin 侧的 WAL/SHM(已被新 KB 替换,旧 WAL 是 stale 的)**

Run:
```bash
rm -f plugins/perf-kp-sql/data/knowledge.sqlite-wal plugins/perf-kp-sql/data/knowledge.sqlite-shm
ls plugins/perf-kp-sql/data/knowledge.sqlite*
```

Expected: 只剩 `knowledge.sqlite` + `knowledge.sqlite.pre-skillhub-sync.bak`,无 -wal/-shm。

### Task A4: 验证 — `rules` 表 6 字段全部对齐,非 `rules` 表无变动

- [ ] **Step 1: 跑全字段对比**

Run:
```bash
node -e "
const Database = require('better-sqlite3');
const sh = new Database('/Volumes/WD_BLACK/myagent/new_ohsql/ohsql-skillhub/skills/perf-kp-sql/data/knowledge.sqlite', {readonly:true});
const pl = new Database('plugins/perf-kp-sql/data/knowledge.sqlite', {readonly:true});
const cols = ['engine','bucket','severity','title','description','metrics','checks','recommendations','source_url','source_title','engine_version_min','engine_version_max','arch','vendor','enabled'];
const shAll = new Map(sh.prepare('SELECT * FROM rules').all().map(r => [r.rule_id, r]));
const plAll = new Map(pl.prepare('SELECT * FROM rules').all().map(r => [r.rule_id, r]));
let totalDiff = 0;
for (const [rid, shRow] of shAll) {
  const plRow = plAll.get(rid);
  if (!plRow) { console.log('MISSING', rid); totalDiff++; continue; }
  for (const c of cols) {
    const a = shRow[c] == null ? '' : String(shRow[c]);
    const b = plRow[c] == null ? '' : String(plRow[c]);
    if (a !== b) { console.log('DIFF', rid, c); totalDiff++; }
  }
}
console.log('total diffs:', totalDiff);
process.exit(totalDiff);
"
```

Expected: `total diffs: 0`,exit 0。

- [ ] **Step 2: 验证非 `rules` 表也未受影响(应该和原 plugin、原 skillhub 同时一致)**

Run:
```bash
node -e "
const Database = require('better-sqlite3');
const crypto = require('crypto');
const hash = (db, sql) => crypto.createHash('sha1').update(JSON.stringify(db.prepare(sql).all())).digest('hex').slice(0,12);
const sh = new Database('/Volumes/WD_BLACK/myagent/new_ohsql/ohsql-skillhub/skills/perf-kp-sql/data/knowledge.sqlite', {readonly:true});
const pl = new Database('plugins/perf-kp-sql/data/knowledge.sqlite', {readonly:true});
let bad = 0;
for (const t of ['knowledge','flame_patterns','knowledge_fts','knowledge_fts_config','knowledge_vec_chunks','knowledge_vec_info','sqlite_sequence']) {
  const a = hash(sh, \`SELECT * FROM \${t}\`);
  const b = hash(pl, \`SELECT * FROM \${t}\`);
  if (a !== b) { console.log('MISMATCH', t, 'sh=', a, 'pl=', b); bad++; }
  else console.log('OK', t);
}
process.exit(bad);
"
```

Expected: 7 行 `OK ...`,exit 0。

### Task A5: 版本号 0.9.1 → 0.10.0

**理由:** 本次同步带 9 条新启用规则 + 改写 7 条 check + 加 6 条 recommendation,运行时行为变了(新 rules 会在诊断报告里出现)。属于"功能/结构"。

- [ ] **Step 1: 改 .claude-plugin/plugin.json**

Edit `plugins/perf-kp-sql/.claude-plugin/plugin.json`:把 `"version": "0.9.1"` 改成 `"version": "0.10.0"`。

- [ ] **Step 2: 改 .codex-plugin/plugin.json(必须镜像)**

Read 文件,把 version 字段改成 `0.10.0`。

- [ ] **Step 3: 验证两个 plugin.json version 字段一致**

Run:
```bash
grep '"version"' plugins/perf-kp-sql/.claude-plugin/plugin.json plugins/perf-kp-sql/.codex-plugin/plugin.json
```

Expected: 两行都是 `"version": "0.10.0",`。

### Task A6: Commit Phase A

- [ ] **Step 1: 删本地备份(commit 不要带)**

Run:
```bash
rm plugins/perf-kp-sql/data/knowledge.sqlite.pre-skillhub-sync.bak
```

- [ ] **Step 2: 暂存 + commit**

Run:
```bash
git add plugins/perf-kp-sql/data/knowledge.sqlite \
        plugins/perf-kp-sql/.claude-plugin/plugin.json \
        plugins/perf-kp-sql/.codex-plugin/plugin.json \
        plugins/perf-kp-sql/tools/audit/.gitkeep \
        plugins/perf-kp-sql/tools/audit/rules-gap-from-skillhub-2026-04-26.md \
        docs/superpowers/plans/2026-04-26-perf-kp-sql-url-fix-all.md

git commit -m "$(cat <<'EOF'
sync(perf-kp-sql): rules 表整体追平 skillhub @5235484 (v0.10.0)

整库 cp from skillhub/skills/perf-kp-sql/data/knowledge.sqlite。
非 rules 表 7 张已验证字节级一致,本次同步只动 rules 表。

rules 表 411 个 rule_id 完全相同,差异全为 plugin 单向落后(0 倒退):
- source_url:    318 处 (28 backfill + 290 refine)
- source_title:  32 处
- metrics:       28 处 (加 parse: 路径)
- checks:        7 处  (自由文本 → 指标 key+op+value)
- recommendations: 6 处 (空 [] → 实体 action 对象)
- enabled:       9 处  (新启用 9 条 mongo/kunpeng 规则)

新启用规则清单与详细对照见
plugins/perf-kp-sql/tools/audit/rules-gap-from-skillhub-2026-04-26.md。

Drift 警告:source 端 data/common/kunpeng-rules.json 与 data/seeds/*.json
仍持有旧 source.url。下个 commit 处理(URL drift only)。
EOF
)"
```

Expected: commit 成功,`git log -1` 看到 v0.10.0 commit。

---

## Phase B — URL drift 关闭 + kb-validate 守护(Commit 2)

> **背景:** Phase A 只动 KB,源 JSON 还停在旧 URL。如果未来跑 `npx tsx tools/kb-build.ts`,会从 source JSON 重建 KB,把刚同步的 318 个 URL 全覆盖回去。Phase B 把 URL/title 从 KB 反向写回源 JSON,并加 lint 防止再次漂移。
> 
> **范围:** 只处理 `source.url + source.title`。`metrics/checks/recommendations` 字段的反向映射涉及 kb-build 的 transform(JSON 里是 `metric_expr`、`recommend` 等,与 KB 列名不一一对应),不在本 PR 范围。

### Task B1: 写反向同步脚本

**Files:**
- Create: `plugins/perf-kp-sql/tools/sync-source-json-from-kb.mjs`

- [ ] **Step 1: 写脚本**

Create `plugins/perf-kp-sql/tools/sync-source-json-from-kb.mjs`:

```javascript
#!/usr/bin/env node
/**
 * sync-source-json-from-kb — 从 data/knowledge.sqlite 反向写回 source JSON 的
 * source.url / source.title,关掉 URL drift。
 *
 * 扫描 data/**\/*.json(顶层数组的 JSON),对每个含 `id` 字段的对象,
 * 在 KB 里查同 rule_id,如果有 source_url/source_title 就写回 obj.source.{url,title}。
 *
 * 用法:
 *   node tools/sync-source-json-from-kb.mjs --dry-run   # 仅打印将改的文件/行数
 *   node tools/sync-source-json-from-kb.mjs             # 实际写入
 */
import Database from "better-sqlite3";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dir, "..", "data");
const DB = join(DATA, "knowledge.sqlite");

const dryRun = process.argv.includes("--dry-run");

const db = new Database(DB, { readonly: true });
const all = db.prepare("SELECT rule_id, source_url, source_title FROM rules").all();
const map = new Map(all.map((r) => [r.rule_id, { url: r.source_url, title: r.source_title }]));
db.close();

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (e.endsWith(".json")) out.push(p);
  }
  return out;
}

let totalUrl = 0, totalTitle = 0, totalFiles = 0;
for (const file of walk(DATA)) {
  let txt;
  try { txt = readFileSync(file, "utf8"); } catch { continue; }
  let arr;
  try { arr = JSON.parse(txt); } catch { continue; }
  if (!Array.isArray(arr)) continue;

  let changedUrl = 0, changedTitle = 0;
  for (const obj of arr) {
    if (!obj || typeof obj !== "object" || !obj.id) continue;
    const want = map.get(obj.id);
    if (!want) continue;
    obj.source ??= {};
    if (want.url != null && obj.source.url !== want.url) {
      obj.source.url = want.url; changedUrl++;
    }
    if (want.title != null && obj.source.title !== want.title) {
      obj.source.title = want.title; changedTitle++;
    }
  }
  if (changedUrl || changedTitle) {
    if (!dryRun) writeFileSync(file, JSON.stringify(arr, null, 2) + "\n");
    console.log(`${file}: url=${changedUrl} title=${changedTitle}`);
    totalUrl += changedUrl; totalTitle += changedTitle; totalFiles++;
  }
}
console.log(`\n${dryRun ? "[dry-run] " : ""}total: url=${totalUrl} title=${totalTitle} files=${totalFiles}`);
```

- [ ] **Step 2: dry-run**

Run:
```bash
cd plugins/perf-kp-sql && node tools/sync-source-json-from-kb.mjs --dry-run | tail -20
```

Expected: 看到若干 `data/.../xxx.json: url=N title=M` 行,末尾 `[dry-run] total: url=≈318 title=≈32 files=N`。如果 url 数与 318 偏差 > 5,**停下来**先排查(可能源 JSON 里 id 字段命名不同)。

- [ ] **Step 3: 真跑**

Run:
```bash
cd plugins/perf-kp-sql && node tools/sync-source-json-from-kb.mjs | tail -20
```

Expected: 同上数字,无 `[dry-run]` 前缀。

- [ ] **Step 4: 看 git diff 哪些 source JSON 改了**

Run:
```bash
git diff --stat plugins/perf-kp-sql/data/
```

Expected: 主要是 `data/common/kunpeng-rules.json`(几百行 +/-)和可能 `data/seeds/mongo-extended.json`。改动行数与 318 URL + 32 title 大致对得上。

### Task B2: 验证 kb-build 幂等

> **目的:** 跑一次 kb-build,确认重建后 KB 的 source_url/source_title 与现 KB 一致(说明源 JSON 已与 KB 对齐)。

- [ ] **Step 1: 备份当前 KB,跑 kb-build,对比 URL/title**

Run:
```bash
cp plugins/perf-kp-sql/data/knowledge.sqlite /tmp/kb-pre-rebuild.sqlite
cd plugins/perf-kp-sql && npx tsx tools/kb-build.ts --op build 2>&1 | tail -5
cd -
node -e "
const Database = require('better-sqlite3');
const a = new Database('/tmp/kb-pre-rebuild.sqlite',{readonly:true});
const b = new Database('plugins/perf-kp-sql/data/knowledge.sqlite',{readonly:true});
const ar = a.prepare('SELECT rule_id, source_url, source_title FROM rules ORDER BY rule_id').all();
const br = b.prepare('SELECT rule_id, source_url, source_title FROM rules ORDER BY rule_id').all();
let urlDiff = 0, titleDiff = 0;
for (let i=0; i<ar.length; i++) {
  if (ar[i].source_url !== br[i].source_url) { urlDiff++; if (urlDiff<=3) console.log('URL', ar[i].rule_id); }
  if (ar[i].source_title !== br[i].source_title) { titleDiff++; if (titleDiff<=3) console.log('TITLE', ar[i].rule_id); }
}
console.log('urlDiff:', urlDiff, 'titleDiff:', titleDiff);
process.exit(urlDiff || titleDiff);
"
```

Expected: `urlDiff: 0 titleDiff: 0`,exit 0。

> **如果非 0:** 说明 kb-build 用源 JSON 之外的某些字段或 transform 覆盖了 source.url。停下来读 kb-build.ts 找 url 写入逻辑,排查。

- [ ] **Step 2: 把 kb-build 重建后的 KB 替换回去(确保 commit 的 KB 是 build 一遍的版本,纯净)**

Run:
```bash
# kb-build 已经把 plugins/perf-kp-sql/data/knowledge.sqlite 写成最新状态
# 直接对比就行,无需替换
ls -la plugins/perf-kp-sql/data/knowledge.sqlite
```

(skip — kb-build 已经原地写过了。)

### Task B3: 在 kb-validate.ts 加 URL drift 检查

**Files:**
- Modify: `plugins/perf-kp-sql/tools/kb-validate.ts`

- [ ] **Step 1: 读 kb-validate.ts 现状**

Run: `Read plugins/perf-kp-sql/tools/kb-validate.ts`(完整读完,确认现有结构)。

- [ ] **Step 2: 在文件末尾或合适的 validate 函数里加新检查**

加这段代码(根据现有 import / structure 微调):

```typescript
// ============================================================================
// URL drift check: source.url in *.json must equal KB rules.source_url
// ============================================================================
import { readdirSync as _ls, statSync as _st, readFileSync as _rd } from "node:fs";

function walkJson(dir: string): string[] {
  return _ls(dir).flatMap((e) => {
    const p = `${dir}/${e}`;
    return _st(p).isDirectory() ? walkJson(p) : (e.endsWith(".json") ? [p] : []);
  });
}

function checkSourceUrlDrift(db: Database.Database, dataDir: string): number {
  const kbUrls = new Map<string, string | null>(
    db.prepare("SELECT rule_id, source_url FROM rules").all()
      .map((r: any) => [r.rule_id, r.source_url])
  );
  let drift = 0;
  for (const f of walkJson(dataDir)) {
    let arr: any;
    try { arr = JSON.parse(_rd(f, "utf8")); } catch { continue; }
    if (!Array.isArray(arr)) continue;
    for (const obj of arr) {
      if (!obj?.id || !kbUrls.has(obj.id)) continue;
      const kb = kbUrls.get(obj.id) ?? null;
      const src = obj.source?.url ?? null;
      if (kb !== src) {
        console.error(`drift: ${obj.id}\n  source.url=${src}\n  KB.source_url=${kb}\n  file=${f}`);
        drift++;
      }
    }
  }
  if (drift) console.error(`source/KB URL drift: ${drift} rules`);
  return drift;
}

// 在 validate() 主流程末尾调用:
//   const drift = checkSourceUrlDrift(db, join(__dirname, "..", "data"));
//   if (drift) process.exitCode = 1;
```

> **改 validate 主入口时,确保把 `drift` 计入 exit code,但不要 throw(让其他 lint 也跑完)。**

- [ ] **Step 3: 跑 kb-validate,确认通过**

Run:
```bash
cd plugins/perf-kp-sql && npx tsx tools/kb-validate.ts 2>&1 | tail -10
```

Expected: 退出码 0,无 `drift:` 报错。

### Task B4: 版本号 0.10.0 → 0.11.0

**理由:** 加新工具脚本 + kb-validate 新校验,属于"功能"。

- [ ] **Step 1: 改两个 plugin.json**

Edit `plugins/perf-kp-sql/.claude-plugin/plugin.json` 与 `plugins/perf-kp-sql/.codex-plugin/plugin.json`,version 字段改成 `0.11.0`。

- [ ] **Step 2: 验证一致**

Run:
```bash
grep '"version"' plugins/perf-kp-sql/.claude-plugin/plugin.json plugins/perf-kp-sql/.codex-plugin/plugin.json
```

Expected: 两行都是 `"version": "0.11.0",`。

### Task B5: Commit Phase B

- [ ] **Step 1: 暂存 + commit**

Run:
```bash
git add plugins/perf-kp-sql/tools/sync-source-json-from-kb.mjs \
        plugins/perf-kp-sql/tools/kb-validate.ts \
        plugins/perf-kp-sql/data/common/ \
        plugins/perf-kp-sql/data/seeds/ \
        plugins/perf-kp-sql/data/mongo/ \
        plugins/perf-kp-sql/data/mysql/ \
        plugins/perf-kp-sql/data/redis/ \
        plugins/perf-kp-sql/data/knowledge.sqlite \
        plugins/perf-kp-sql/.claude-plugin/plugin.json \
        plugins/perf-kp-sql/.codex-plugin/plugin.json

git commit -m "$(cat <<'EOF'
fix(perf-kp-sql): close source/KB URL drift · add kb-validate guard (v0.11.0)

Phase A 只动 KB · 源 data/**/*.json 的 source.url 还停在旧值 ·
跑一次 kb-build 就会把刚同步的 318 个 URL 覆盖回去 · 这个 PR 关掉这条回退路径。

- tools/sync-source-json-from-kb.mjs · 一次性反向同步:
  扫 data/**/*.json 顶层数组里所有含 id 字段的对象 ·
  在 KB 查同 rule_id 把 source.url / source.title 写回 ·
  跑一次后 kb-build 已验证幂等(重建 KB 与现 KB URL/title 0 diff)
- tools/kb-validate.ts · 新增 checkSourceUrlDrift:
  source.url ↔ KB.source_url 任一规则不一致即 fail
- data/**/*.json · 318 处 url + 32 处 title 写回(commit diff 主要在
  data/common/kunpeng-rules.json 与 data/seeds/mongo-extended.json)

Out of scope · metrics / checks / recommendations 的反向同步另开 PR
(kb-build 对这几列有 transform · 源 JSON schema 不与 KB 列 1:1 映射)。
EOF
)"
```

Expected: commit 成功。

- [ ] **Step 2: push 分支(不开 PR,等用户确认)**

Run:
```bash
git push -u origin sync/perf-kp-sql-rules-from-skillhub
```

Expected: push 成功,gh 给 PR 创建链接。**不要自动 `gh pr create`,等用户确认 PR title/body/reviewer。**

---

## Self-Review

✓ **Spec coverage:** 用户诉求"以 skillhub 为准把 plugin 追齐"。Phase A 整库 cp 一次性追齐 6 字段全部 gap;Phase B 关 URL drift 防回退。`metrics/checks/recommendations` 的源 JSON drift 在 commit message 里显式 out-of-scope。

✓ **Placeholder scan:** 无 TBD / TODO / "类似 Task N"。所有命令完整可粘贴。Task B3 改 kb-validate 的代码片段需要根据现有文件结构做小调整,但模式给全(`checkSourceUrlDrift` 函数体完整)。

✓ **Type consistency:** `Map<string, string|null>` 类型在 B3 与 B1 保持一致(rule_id → source_url 字符串或 null)。脚本里 source_url/source_title 字段名与 KB 列名一致。

⚠ **风险:**
- Task A3 用 `db.backup()` API 而非 `cp`,以避开 WAL/SHM 不一致问题。该 API 是 better-sqlite3 标准方法,异步 Promise。
- Task B2 假设 kb-build 是幂等的(重建 KB 不应改 source_url)。如果 kb-build 有 url 重写逻辑(例如自动加 anchor),Step 1 会失败,需要先读 kb-build.ts 排查。这个风险已在 Step 1 的"如果非 0"提示里覆盖。
- Phase B Task B1 的脚本依赖源 JSON 用 `id` 作为规则键、`source` 是对象。Task B1 Step 2 dry-run 数与 318 偏差 > 5 就停 — 是这个假设的安全门。

---

## 执行选项

**推荐:Inline(executing-plans)** — 总共 ~45 分钟,任务原子化,无 WebFetch/外部调用,inline 跑最直接。

**不推荐 subagent-driven** — 任务太短,subagent 启动 + 上下文转移成本反而更高。

**可独立执行的切分点:** Phase A 是单独自洽的 commit(plugin 追齐 skillhub),哪怕 Phase B 没做也是有用进展。如果 Phase B 中 kb-build 幂等性验证失败,可以暂停 Phase B、保留 Phase A commit,单独排查 kb-build。
