#!/usr/bin/env node
// Phase 1 · M6 · distill-v2 cases → NotebookLM-friendly flat md 投影
//
// 输入: distill-v2/cases/{_common,mongodb}/<entry_kind>/*.md (已蒸 202 case)
// 输出: plugins/perf-kp-sql/data/{common,mongo}/*.md (NotebookLM source upload 路径)
//
// 路由:
//   bucket 1 (kunpeng/arm64) → data/common/kunpeng-*.md
//   bucket 2 (linux-*/mem/tls) → data/common/os-*.md
//   bucket 3,4,5 (mongo*) → data/mongo/mongo-*.md
//
// 聚合: 同 (domain, entry_kind, scope-或-engine-类) 合并为一个 .md (NotebookLM 50 source/notebook 上限远未触及)
// 用法:
//   node scripts/cases-to-flat-md.mjs --kb data/knowledge.sqlite --out data/
//   node scripts/cases-to-flat-md.mjs --kb data/knowledge.sqlite --out data/ --dry-run

import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readdirSync, unlinkSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(HERE, "..");

const { values } = parseArgs({
  options: {
    kb: { type: "string" },
    out: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});

const dbPath = values.kb ?? join(PLUGIN_ROOT, "data/knowledge.sqlite");
const outRoot = values.out ?? join(PLUGIN_ROOT, "data");
const DRY = values["dry-run"];

if (!existsSync(dbPath)) {
  console.error(`KB not found: ${dbPath} · 先跑: node scripts/kb.mjs build --from <distill-v2/cases>`);
  process.exit(2);
}

const Database = require("better-sqlite3");
const db = new Database(dbPath, { readonly: true });

// 读所有 case
const rows = db.prepare(`
  SELECT case_id, entry_kind, database, platform, scope, case_pattern,
         title, source_url, source_authority, source_heading,
         best_practice_data, diagnostic_flow_data, flame_signature_data,
         bucket
  FROM cases
  ORDER BY entry_kind, database, scope, case_id
`).all();

console.log(`Loaded ${rows.length} cases from ${dbPath}`);

// 路由: case → domain (kunpeng/os/mongo)
function routeDomain(c) {
  if (c.database === "mongodb") return "mongo";
  // _common 下 · 按 bucket 拆 kunpeng vs os
  if (c.bucket === 1) return "kunpeng";
  return "os"; // bucket 2/5 etc 都归 os (在 _common 下)
}

// 路由: case → 文件名 (按 domain + entry_kind + scope 聚合)
function routeFilename(c, domain) {
  const ek = c.entry_kind; // best-practice / diagnostic-flow / flame-signature
  // scope 缺失(DF 多数)→ 用 engine 或通用
  let key = c.scope ?? null;
  if (!key) {
    // DF 没 scope · 按 entry_kind 全部归一份
    key = ek === "diagnostic-flow" ? "diagnostic-flow" : "misc";
  }
  // 文件名归一化
  const safe = String(key).replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  return `${domain}-${ek}-${safe}.md`;
}

// 装配 case 的 flat md (NotebookLM 友好 · 不带 yaml frontmatter · 拍平)
function caseToFlatMd(c) {
  const lines = [];
  lines.push(`## ${c.title}`);
  lines.push("");
  lines.push(`**case_id**: \`${c.case_id}\``);
  lines.push(`**来源**: [${c.source_url}](${c.source_url}) (${c.source_authority})`);
  if (c.platform) lines.push(`**平台**: ${c.platform}`);
  if (c.scope) lines.push(`**scope**: ${c.scope}`);
  if (c.case_pattern) lines.push(`**case_pattern**: ${c.case_pattern}`);
  if (c.source_heading) lines.push(`**source_heading**: ${c.source_heading}`);
  lines.push("");

  if (c.entry_kind === "best-practice" && c.best_practice_data) {
    const d = JSON.parse(c.best_practice_data);
    if (d.scenario?.description_quote) {
      lines.push(`### 场景 (原文)`);
      lines.push(`> ${d.scenario.description_quote}`);
      lines.push("");
    }
    if (d.scenario?.description_zh) {
      lines.push(`### 场景 (中文转述)`);
      lines.push(d.scenario.description_zh);
      lines.push("");
    }
    if (d.recommendation?.value) {
      lines.push(`### 推荐`);
      lines.push(`- 值: \`${d.recommendation.value}\``);
      if (d.recommendation.layer) lines.push(`- 层: ${d.recommendation.layer}`);
      if (d.recommendation.quote) {
        lines.push(`- 原文:`);
        lines.push(`  > ${d.recommendation.quote}`);
      }
      lines.push("");
    }
    if (d.detection_step?.layer) {
      lines.push(`### 检测方法`);
      if (d.detection_step.method_quote) {
        lines.push(`> ${d.detection_step.method_quote}`);
      }
      if (d.detection_step.violation_pattern_quote) {
        lines.push(`违规模式: ${d.detection_step.violation_pattern_quote}`);
      }
      lines.push("");
    }
    if (d.rationale?.quote || d.rationale?.zh) {
      lines.push(`### 机制 / 原因`);
      if (d.rationale.quote) lines.push(`> ${d.rationale.quote}`);
      if (d.rationale.zh) lines.push(d.rationale.zh);
      lines.push("");
    }
    if (d.risk?.quote || d.risk?.zh) {
      lines.push(`### 违反时的风险${d.risk.severity ? ` (${d.risk.severity})` : ""}`);
      if (d.risk.quote) lines.push(`> ${d.risk.quote}`);
      if (d.risk.zh) lines.push(d.risk.zh);
      lines.push("");
    }
  } else if (c.entry_kind === "diagnostic-flow" && c.diagnostic_flow_data) {
    const d = JSON.parse(c.diagnostic_flow_data);
    if (d.engine) lines.push(`**engine**: ${d.engine}`);
    if (d.symptom_category) lines.push(`**symptom_category**: ${d.symptom_category}`);
    lines.push("");
    if (d.symptom?.description_quote) {
      lines.push(`### 症状 (原文)`);
      lines.push(`> ${d.symptom.description_quote}`);
      lines.push("");
    }
    if (Array.isArray(d.symptom?.keywords) && d.symptom.keywords.length > 0) {
      lines.push(`**症状关键词**: ${d.symptom.keywords.join(" / ")}`);
      lines.push("");
    }
    if (Array.isArray(d.diagnostic_steps) && d.diagnostic_steps.length > 0) {
      lines.push(`### 诊断步骤`);
      for (const s of d.diagnostic_steps) {
        lines.push(`#### Step ${s.step_no}: ${s.title}`);
        if (s.metric_name) lines.push(`- metric: \`${s.metric_name}\``);
        if (s.collection_layer) lines.push(`- 采集层: ${s.collection_layer}`);
        if (s.abnormal_pattern_quote) lines.push(`- 异常模式: > ${s.abnormal_pattern_quote}`);
        if (s.abnormal_pattern_threshold) lines.push(`- 阈值: ${s.abnormal_pattern_threshold}`);
        lines.push("");
      }
    }
    if (d.likely_causes) {
      const pc = d.likely_causes.parameter_causes ?? [];
      const npc = d.likely_causes.non_parameter_causes ?? [];
      if (pc.length > 0) {
        lines.push(`### possible 根因 (参数类)`);
        for (const c2 of pc) {
          lines.push(`#### Cause ${c2.cause_no}: ${c2.title}`);
          if (c2.param_name) lines.push(`- param: \`${c2.param_name}\``);
          if (c2.abnormal_value_pattern) lines.push(`- 异常值模式: ${c2.abnormal_value_pattern}`);
          if (c2.reasoning_quote) lines.push(`- 原文: > ${c2.reasoning_quote}`);
          lines.push("");
        }
      }
      if (npc.length > 0) {
        lines.push(`### possible 根因 (非参数类)`);
        for (const c2 of npc) {
          lines.push(`#### Cause ${c2.cause_no}: ${c2.title}`);
          if (c2.cause_type) lines.push(`- type: ${c2.cause_type}`);
          if (c2.description_quote) lines.push(`- 原文: > ${c2.description_quote}`);
          if (c2.mitigation_quote) lines.push(`- 缓解: > ${c2.mitigation_quote}`);
          lines.push("");
        }
      }
    }
    if (d.mitigation_quote) {
      lines.push(`### 总体缓解`);
      lines.push(`> ${d.mitigation_quote}`);
      lines.push("");
    }
  } else if (c.entry_kind === "flame-signature" && c.flame_signature_data) {
    const d = JSON.parse(c.flame_signature_data);
    if (d.signature_type) lines.push(`**signature_type**: ${d.signature_type}`);
    if (d.match_layer) lines.push(`**match_layer**: ${d.match_layer}`);
    if (d.pattern_regex) lines.push(`**pattern_regex**: \`${d.pattern_regex}\``);
    lines.push("");
    if (d.pattern_quote) {
      lines.push(`### 火焰图原文模式`);
      lines.push(`> ${d.pattern_quote}`);
      lines.push("");
    }
    if (d.mechanism?.quote || d.mechanism?.zh) {
      lines.push(`### 机制`);
      if (d.mechanism.quote) lines.push(`> ${d.mechanism.quote}`);
      if (d.mechanism.zh) lines.push(d.mechanism.zh);
      lines.push("");
    }
    if (d.workload_implication?.quote || d.workload_implication?.zh) {
      lines.push(`### 负载含义`);
      if (d.workload_implication.quote) lines.push(`> ${d.workload_implication.quote}`);
      if (d.workload_implication.zh) lines.push(d.workload_implication.zh);
      lines.push("");
    }
    if (Array.isArray(d.tuning_directions) && d.tuning_directions.length > 0) {
      lines.push(`### 调优方向`);
      for (const t of d.tuning_directions) {
        lines.push(`- (#${t.direction_no})${t.related_param_name ? ` \`${t.related_param_name}\`` : ""}${t.confidence ? ` [${t.confidence}]` : ""}`);
        if (t.direction_quote) lines.push(`  > ${t.direction_quote}`);
      }
      lines.push("");
    }
  }

  lines.push("---");
  lines.push("");
  return lines.join("\n");
}

// 按 (domain, filename) 分组
const groups = new Map(); // domain → filename → [case markdown]
for (const c of rows) {
  const domain = routeDomain(c);
  const filename = routeFilename(c, domain);
  if (!groups.has(domain)) groups.set(domain, new Map());
  const fileMap = groups.get(domain);
  if (!fileMap.has(filename)) fileMap.set(filename, []);
  fileMap.get(filename).push(caseToFlatMd(c));
}

// 写文件
const stats = { domains: 0, files: 0, cases: 0, deleted: 0 };
const outDirs = {
  kunpeng: join(outRoot, "common"),
  os: join(outRoot, "common"),
  mongo: join(outRoot, "mongo"),
};

if (!DRY) {
  for (const dir of new Set(Object.values(outDirs))) {
    mkdirSync(dir, { recursive: true });
    // 清掉旧的 .md (保留 .gitkeep)
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".md"))) {
      unlinkSync(join(dir, f));
      stats.deleted++;
    }
  }
}

for (const [domain, fileMap] of groups) {
  stats.domains++;
  const dir = outDirs[domain];
  for (const [filename, mdBlocks] of fileMap) {
    stats.files++;
    stats.cases += mdBlocks.length;
    const header = `# ${filename.replace(/\.md$/, "")}\n\n本文件由 cases-to-flat-md.mjs 从 distill-v2 cases 自动投影。\n\n包含 ${mdBlocks.length} 条 case。\n\n---\n\n`;
    const out = header + mdBlocks.join("\n");
    if (!DRY) {
      const path = join(dir, filename);
      writeFileSync(path, out);
    }
  }
}

db.close();

console.log(JSON.stringify({
  out_root: outRoot,
  domains: groups.size,
  files: stats.files,
  cases: stats.cases,
  old_files_deleted: stats.deleted,
  dry_run: DRY,
  by_domain: Object.fromEntries(
    [...groups].map(([d, fm]) => [d, { files: fm.size, cases: [...fm.values()].reduce((a, b) => a + b.length, 0) }]),
  ),
}, null, 2));
