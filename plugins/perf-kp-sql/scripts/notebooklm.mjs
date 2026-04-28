#!/usr/bin/env node
/**
 * notebooklm.mjs — NotebookLM 知识增强层 CLI 入口
 *
 * 单入口 · 5 个 op:
 *   --op check        检查状态 (CLI 是否安装 / 认证 / notebooks)
 *   --op setup        初始化 (pip install → cookie 提取 → 创建 notebooks → 添加 URL)
 *   --op query        单条查询
 *   --op query-batch  批量查询 (诊断结果 → 深入分析)
 *   --op add-domain   注册新领域
 *
 * JSON-in / JSON-out 契约 · 与 ssh.mjs / kb.mjs 同模式。
 */

import { spawnSync, execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { homedir } from "node:os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PLUGIN_ROOT = resolve(__dirname, "..");
const CONFIG_DIR = join(homedir(), ".perf-kp-sql");
const CONFIG_PATH = join(CONFIG_DIR, "notebooklm.json");
const URLS_PATH = join(PLUGIN_ROOT, "data", "notebooklm-urls.json");

// ── helpers ──────────────────────────────────────────────────────────

function out(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

function fatal(msg) {
  out({ ok: false, error: msg });
  process.exit(1);
}

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return null;
  }
}

function saveConfig(cfg) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

function loadUrlsJson(urlsFile) {
  const p = urlsFile ?? URLS_PATH;
  if (!existsSync(p)) fatal(`notebooklm-urls.json not found: ${p}`);
  return JSON.parse(readFileSync(p, "utf8"));
}

function isCliInstalled() {
  try {
    const r = spawnSync("notebooklm", ["--version"], {
      encoding: "utf8",
      timeout: 10_000,
    });
    return r.status === 0;
  } catch {
    return false;
  }
}

function nlmExec(args, { timeoutMs = 60_000 } = {}) {
  const r = spawnSync("notebooklm", args, {
    encoding: "utf8",
    timeout: timeoutMs,
  });
  return { status: r.status, stdout: (r.stdout ?? "").trim(), stderr: (r.stderr ?? "").trim() };
}

function nlmJson(args, opts) {
  const r = nlmExec([...args, "--json"], opts);
  if (r.status !== 0) return { ok: false, raw: r };
  try {
    return { ok: true, data: JSON.parse(r.stdout), raw: r };
  } catch {
    return { ok: false, raw: r };
  }
}

function checkAuth() {
  const r = nlmExec(["auth", "check", "--test"], { timeoutMs: 15_000 });
  return r.status === 0;
}

// ── op: check ────────────────────────────────────────────────────────

function opCheck() {
  const installed = isCliInstalled();
  if (!installed) {
    return out({ installed: false, authenticated: false, notebooks: {} });
  }
  const authenticated = checkAuth();
  const cfg = loadConfig();
  const notebooks = {};
  if (cfg?.notebooks) {
    for (const [domain, nb] of Object.entries(cfg.notebooks)) {
      notebooks[domain] = {
        id: nb.id,
        source_count: nb.source_count ?? 0,
        status: "ok",
      };
    }
  }
  out({ installed, authenticated, notebooks });
}

// ── op: setup ────────────────────────────────────────────────────────

function opSetup(urlsFile) {
  // Step 9: install pip packages
  console.error("→ 检查 notebooklm CLI...");
  if (!isCliInstalled()) {
    console.error("→ 安装 notebooklm-py + rookiepy...");
    const pip = spawnSync("pip", ["install", "notebooklm-py[browser]", "rookiepy"], {
      encoding: "utf8",
      timeout: 120_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    if (pip.status !== 0) {
      console.error(`pip install 失败: ${pip.stderr}`);
      // 尝试 pip3
      const pip3 = spawnSync("pip3", ["install", "notebooklm-py[browser]", "rookiepy"], {
        encoding: "utf8",
        timeout: 120_000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      if (pip3.status !== 0) {
        return out({
          ok: false,
          error: "pip install notebooklm-py[browser] rookiepy 失败",
          detail: (pip3.stderr ?? "").slice(0, 500),
        });
      }
    }
    // install playwright chromium
    console.error("→ 安装 Playwright Chromium...");
    spawnSync("playwright", ["install", "chromium"], {
      encoding: "utf8",
      timeout: 180_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
  }

  // Step 10: cookie extraction via rookiepy
  console.error("→ 提取 Chrome cookie (rookiepy)...");
  const cookieScript = `
import rookiepy, json, os
cookies = rookiepy.chrome(domains=['.google.com', 'notebooklm.google.com', 'accounts.google.com'])
storage_state = {
    'cookies': [
        {
            'name': c['name'], 'value': c['value'], 'domain': c['domain'],
            'path': c.get('path', '/'), 'expires': c.get('expires', -1),
            'httpOnly': c.get('httpOnly', False), 'secure': c.get('secure', False),
            'sameSite': 'None' if c.get('secure') else 'Lax',
        }
        for c in cookies
    ],
    'origins': []
}
path = os.path.expanduser('~/.notebooklm/storage_state.json')
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, 'w') as f:
    json.dump(storage_state, f)
print(json.dumps({"ok": True, "cookie_count": len(cookies)}))
`;
  const py = spawnSync("python3", ["-c", cookieScript], {
    encoding: "utf8",
    timeout: 30_000,
  });
  if (py.status !== 0) {
    console.error(`cookie 提取失败: ${py.stderr}`);
    console.error("请确保已在 Chrome 中登录 https://notebooklm.google.com/");
  }

  // Step 10b: verify auth
  console.error("→ 验证认证...");
  const authOk = checkAuth();
  if (!authOk) {
    console.error("⚠️ 认证未通过。请在 Chrome 中登录 NotebookLM 后重试。");
  }

  // Step 11: create notebooks + add URLs
  console.error("→ 创建 Notebooks 并添加 URL...");
  const urlsData = loadUrlsJson(urlsFile);
  const cfg = loadConfig() || { notebooks: {}, version: "0.25.0", created_at: new Date().toISOString().slice(0, 10) };
  cfg.notebooks = cfg.notebooks || {};

  const results = {};

  for (const domainDef of urlsData.domains) {
    const { domain, notebook_name } = domainDef;
    const urls = domainDef.urls || [];
    console.error(`  → 领域 ${domain}: ${urls.length} 个 URL`);

    let notebookId = cfg.notebooks[domain]?.id;

    // check if notebook still exists
    if (notebookId) {
      const listR = nlmJson(["list"]);
      if (listR.ok) {
        const nbs = Array.isArray(listR.data) ? listR.data : listR.data?.notebooks ?? [];
        const found = nbs.some((nb) => nb.id === notebookId || nb.notebook_id === notebookId);
        if (!found) {
          console.error(`    notebook ${notebookId} 已不存在,重新创建`);
          notebookId = null;
        }
      }
    }

    // create notebook if needed
    if (!notebookId) {
      const createR = nlmJson(["create", notebook_name]);
      if (!createR.ok) {
        console.error(`    创建 notebook '${notebook_name}' 失败: ${createR.raw.stderr}`);
        results[domain] = { ok: false, error: "创建失败" };
        continue;
      }
      notebookId = createR.data?.id ?? createR.data?.notebook_id;
      if (!notebookId) {
        console.error(`    无法获取 notebook id`);
        results[domain] = { ok: false, error: "无法获取 id" };
        continue;
      }
    }

    // use this notebook
    nlmExec(["use", notebookId]);

    // determine which URLs need adding (incremental sync)
    const existingUrls = new Set((cfg.notebooks[domain]?.urls ?? []).map((u) => u.url));
    const toAdd = urls.filter((u) => !existingUrls.has(u.url));
    const plannedUrlSet = new Set(urls.map((u) => u.url));
    const toRemove = (cfg.notebooks[domain]?.urls ?? []).filter((u) => !plannedUrlSet.has(u.url));

    // remove deleted URLs
    for (const entry of toRemove) {
      if (entry.source_id) {
        console.error(`    删除已移除的 URL source: ${entry.source_id}`);
        nlmExec(["source", "delete", entry.source_id]);
      }
    }

    // add new URLs (batch of 5)
    const addedUrls = [...(cfg.notebooks[domain]?.urls ?? []).filter((u) => plannedUrlSet.has(u.url))];
    for (let i = 0; i < toAdd.length; i += 5) {
      const batch = toAdd.slice(i, i + 5);
      const promises = batch.map((urlEntry) => {
        const r = nlmJson(["source", "add", urlEntry.url]);
        if (r.ok) {
          const sourceId = r.data?.id ?? r.data?.source_id ?? null;
          addedUrls.push({ url: urlEntry.url, source_id: sourceId });
          return { url: urlEntry.url, ok: true, source_id: sourceId };
        }
        console.error(`    添加 URL 失败: ${urlEntry.url} — ${r.raw.stderr}`);
        return { url: urlEntry.url, ok: false };
      });
    }

    cfg.notebooks[domain] = {
      id: notebookId,
      source_count: addedUrls.length,
      urls: addedUrls,
    };
    results[domain] = { ok: true, notebook_id: notebookId, source_count: addedUrls.length };
  }

  // Step 12: wait for sources to be ready
  console.error("→ 等待 source 就绪...");
  for (const [domain, nb] of Object.entries(cfg.notebooks)) {
    for (const u of nb.urls ?? []) {
      if (u.source_id) {
        nlmExec(["source", "wait", u.source_id, "--timeout", "120"], { timeoutMs: 130_000 });
      }
    }
  }

  cfg.auth_checked_at = new Date().toISOString();
  saveConfig(cfg);

  out({ ok: true, results });
}

// ── op: query ────────────────────────────────────────────────────────

const KEYWORD_ROUTES = {
  os: [/vm\.\w+/i, /dirty_ratio/i, /hugepage/i, /\bTHP\b/i, /sysctl/i, /cgroup/i, /swappiness/i, /transparent_hugepage/i, /kernel\./i, /net\.core/i, /net\.ipv4/i, /io.?schedul/i, /readahead/i, /nr_request/i],
  mongo: [/wiredTiger/i, /mongod/i, /oplog/i, /shard/i, /连接池/i, /journal/i, /mongo/i, /repl.?set/i, /cursor/i, /index/i, /profil/i, /aggregate/i, /lookup/i, /bulk.?write/i, /capped/i, /transaction/i, /evict/i],
  kunpeng: [/鲲鹏/i, /kunpeng/i, /\bARM\b/i, /aarch64/i, /\bNUMA\b/i, /ampere/i, /核绑定/i, /affinity/i],
};

function resolveAutoDomainn(query, cfg) {
  const matched = [];
  for (const [domain, patterns] of Object.entries(KEYWORD_ROUTES)) {
    if (!cfg.notebooks?.[domain]) continue;
    if (patterns.some((re) => re.test(query))) matched.push(domain);
  }
  // fallback: query all notebooks
  if (matched.length === 0) return Object.keys(cfg.notebooks ?? {});
  return matched;
}

function opQuery(domain, query) {
  if (!domain || !query) fatal("--domain and --query required");
  if (!isCliInstalled()) fatal("notebooklm CLI 未安装");

  const cfg = loadConfig();

  // auto domain routing
  if (domain === "auto") {
    const targets = resolveAutoDomainn(query, cfg);
    const allResults = [];
    for (const d of targets) {
      const nb = cfg.notebooks?.[d];
      if (!nb?.id) continue;
      nlmExec(["use", nb.id]);
      const r = nlmJson(["ask", query], { timeoutMs: 60_000 });
      if (r.ok) {
        allResults.push({
          domain: d,
          notebook_id: nb.id,
          answer: r.data?.answer ?? r.data?.response ?? "",
          references: r.data?.references ?? r.data?.citations ?? [],
        });
      }
      // throttle between notebooks
      if (targets.length > 1) spawnSync("sleep", ["2"]);
    }
    return out({ ok: true, results: allResults });
  }

  if (!cfg?.notebooks?.[domain]) fatal(`领域 '${domain}' 未配置,请先运行 --op setup`);

  const notebookId = cfg.notebooks[domain].id;
  nlmExec(["use", notebookId]);

  const r = nlmJson(["ask", query], { timeoutMs: 60_000 });
  if (!r.ok) {
    return out({
      ok: false,
      error: `查询失败: ${r.raw.stderr || r.raw.stdout}`,
      domain,
      notebook_id: notebookId,
    });
  }

  out({
    ok: true,
    answer: r.data?.answer ?? r.data?.response ?? "",
    references: r.data?.references ?? r.data?.citations ?? [],
    domain,
    notebook_id: notebookId,
  });
}

// ── op: query-batch ──────────────────────────────────────────────────

function routeToNotebooks(checkResult, hwArch, cfg) {
  const notebooks = [];
  const bucket = checkResult.bucket;

  if (bucket === 1 || bucket === 2) {
    if (cfg.notebooks?.os) notebooks.push("os");
    if (hwArch === "kunpeng" && cfg.notebooks?.kunpeng) notebooks.push("kunpeng");
  }
  if (bucket === 3 || bucket === 4 || bucket === 5) {
    const engine = checkResult.database ?? "mongo";
    if (cfg.notebooks?.[engine]) notebooks.push(engine);
  }

  // cross_domain tag
  if (checkResult.data?.tags?.includes?.("cross_domain")) {
    if (cfg.notebooks?.os && !notebooks.includes("os")) notebooks.push("os");
  }

  // scope=arch → kunpeng
  if (checkResult.scope === "arch" && hwArch === "kunpeng") {
    if (cfg.notebooks?.kunpeng && !notebooks.includes("kunpeng")) notebooks.push("kunpeng");
  }

  return notebooks.length > 0 ? notebooks : Object.keys(cfg.notebooks ?? {}).slice(0, 1);
}

function buildQueryPrompt(cr) {
  const paramName = cr.title || cr.case_id;
  const currentVal = cr.current_value != null ? String(cr.current_value) : "未获取";
  const reason = cr.reason_zh || "";
  return `${paramName} 当前值为 ${currentVal}，${reason}。\n请从以下角度分析：\n1. 该参数的作用机制\n2. 默认值与推荐值范围\n3. 当前值的风险点\n4. 生产环境最佳实践与调优建议`;
}

function opQueryBatch(fromDiagnose, hwArch) {
  if (!fromDiagnose) fatal("--from-diagnose required");
  if (!isCliInstalled()) fatal("notebooklm CLI 未安装");

  const cfg = loadConfig();
  if (!cfg?.notebooks || Object.keys(cfg.notebooks).length === 0) {
    fatal("NotebookLM 未配置,请先运行 --op setup");
  }

  const diagData = JSON.parse(readFileSync(resolve(fromDiagnose), "utf8"));
  const checks = diagData.matched ?? [];

  if (checks.length === 0) {
    return out({ ok: true, results: [] });
  }

  // group by notebook
  const grouped = {}; // notebook_domain -> [{ cr, prompt }]
  for (const cr of checks) {
    const targets = routeToNotebooks(cr, hwArch, cfg);
    const prompt = buildQueryPrompt(cr);
    for (const t of targets) {
      if (!grouped[t]) grouped[t] = [];
      grouped[t].push({ cr, prompt });
    }
  }

  // batch query: merge prompts per notebook into single ask
  const results = [];
  for (const [domain, items] of Object.entries(grouped)) {
    const nb = cfg.notebooks[domain];
    if (!nb?.id) continue;

    nlmExec(["use", nb.id]);

    // merge prompts for single ask (performance: 5 items ~25s vs ~90s one-by-one)
    const mergedPrompt = items
      .map((item, i) => `【问题 ${i + 1}】${item.prompt}`)
      .join("\n\n");

    const r = nlmJson(["ask", mergedPrompt], { timeoutMs: 90_000 });

    if (r.ok) {
      const answer = r.data?.answer ?? r.data?.response ?? "";
      const references = r.data?.references ?? r.data?.citations ?? [];

      // try to split merged answer back to individual items
      for (const item of items) {
        results.push({
          case_id: item.cr.case_id,
          answer,
          references,
          domain,
          notebook_id: nb.id,
        });
      }
    } else {
      console.error(`查询 ${domain} 失败: ${r.raw.stderr}`);
      // individual fallback
      for (const item of items) {
        results.push({
          case_id: item.cr.case_id,
          answer: "",
          references: [],
          domain,
          notebook_id: nb.id,
          error: r.raw.stderr || "查询失败",
        });
      }
    }

    // throttle between notebooks (2s)
    if (Object.keys(grouped).length > 1) {
      spawnSync("sleep", ["2"]);
    }
  }

  out({ ok: true, results });
}

// ── op: add-domain ───────────────────────────────────────────────────

function opAddDomain(domain, urlsFile) {
  if (!domain) fatal("--domain required");
  if (!isCliInstalled()) fatal("notebooklm CLI 未安装");

  const urlsData = loadUrlsJson(urlsFile);
  const domainDef = urlsData.domains.find((d) => d.domain === domain);
  if (!domainDef) fatal(`领域 '${domain}' 在 urls.json 中不存在`);

  const cfg = loadConfig() || { notebooks: {}, version: "0.25.0", created_at: new Date().toISOString().slice(0, 10) };
  cfg.notebooks = cfg.notebooks || {};

  const { notebook_name } = domainDef;
  const urls = domainDef.urls || [];
  let notebookId = cfg.notebooks[domain]?.id;

  // check existence
  if (notebookId) {
    const listR = nlmJson(["list"]);
    if (listR.ok) {
      const nbs = Array.isArray(listR.data) ? listR.data : listR.data?.notebooks ?? [];
      if (!nbs.some((nb) => nb.id === notebookId || nb.notebook_id === notebookId)) {
        notebookId = null;
      }
    }
  }

  // create if needed
  if (!notebookId) {
    const createR = nlmJson(["create", notebook_name]);
    if (!createR.ok) fatal(`创建 notebook '${notebook_name}' 失败: ${createR.raw.stderr}`);
    notebookId = createR.data?.id ?? createR.data?.notebook_id;
    if (!notebookId) fatal("无法获取 notebook id");
  }

  nlmExec(["use", notebookId]);

  // incremental sync
  const existingUrls = new Set((cfg.notebooks[domain]?.urls ?? []).map((u) => u.url));
  const plannedUrlSet = new Set(urls.map((u) => u.url));
  const toRemove = (cfg.notebooks[domain]?.urls ?? []).filter((u) => !plannedUrlSet.has(u.url));
  const toAdd = urls.filter((u) => !existingUrls.has(u.url));

  for (const entry of toRemove) {
    if (entry.source_id) nlmExec(["source", "delete", entry.source_id]);
  }

  const addedUrls = [...(cfg.notebooks[domain]?.urls ?? []).filter((u) => plannedUrlSet.has(u.url))];
  const urlResults = [];

  for (let i = 0; i < toAdd.length; i += 5) {
    const batch = toAdd.slice(i, i + 5);
    for (const urlEntry of batch) {
      const r = nlmJson(["source", "add", urlEntry.url]);
      const sourceId = r.ok ? (r.data?.id ?? r.data?.source_id ?? null) : null;
      const status = r.ok ? "PENDING" : "FAILED";
      addedUrls.push({ url: urlEntry.url, source_id: sourceId });
      urlResults.push({ url: urlEntry.url, source_id: sourceId, status });
    }
  }

  // wait for sources
  for (const u of addedUrls) {
    if (u.source_id) {
      nlmExec(["source", "wait", u.source_id, "--timeout", "120"], { timeoutMs: 130_000 });
    }
  }

  // verify source status
  const sourceListR = nlmJson(["source", "list"]);
  if (sourceListR.ok) {
    const sources = Array.isArray(sourceListR.data) ? sourceListR.data : sourceListR.data?.sources ?? [];
    for (const ur of urlResults) {
      const src = sources.find((s) => s.id === ur.source_id || s.source_id === ur.source_id);
      ur.status = src?.status ?? "UNKNOWN";
    }
  }

  cfg.notebooks[domain] = { id: notebookId, source_count: addedUrls.length, urls: addedUrls };
  saveConfig(cfg);

  out({
    ok: true,
    domain,
    notebook_id: notebookId,
    source_count: addedUrls.length,
    urls: urlResults,
  });
}

// ── main ─────────────────────────────────────────────────────────────

const { values } = parseArgs({
  options: {
    op: { type: "string" },
    json: { type: "boolean", default: false },
    domain: { type: "string" },
    query: { type: "string" },
    "from-diagnose": { type: "string" },
    "hw-arch": { type: "string" },
    "urls-file": { type: "string" },
  },
});

switch (values.op) {
  case "check":
    opCheck();
    break;
  case "setup":
    opSetup(values["urls-file"]);
    break;
  case "query":
    opQuery(values.domain, values.query);
    break;
  case "query-batch":
    opQueryBatch(values["from-diagnose"], values["hw-arch"]);
    break;
  case "add-domain":
    opAddDomain(values.domain, values["urls-file"]);
    break;
  default:
    fatal(`未知 op: ${values.op}。支持: check | setup | query | query-batch | add-domain`);
}
