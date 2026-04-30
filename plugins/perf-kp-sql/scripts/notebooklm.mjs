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

import { spawnSync, execSync, spawn } from "node:child_process";
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

// 鉴权失败识别 — stdout JSON error 字段 / stderr 关键字 任一命中即算认证类失败
// 命中后立即返回原结果 → 让上层走 NLM-relogin 流程 · 不做 retry
const AUTH_STDOUT_RE = /auth_expired|unauthorized|cookie_invalid|cookie expired|认证未通过/i;
const AUTH_STDERR_RE = /401|403|Authentication failed|认证未通过|cookie/i;

function isAuthFailure(r) {
  if (!r || r.ok) return false;
  const stdout = r.raw?.stdout ?? "";
  const stderr = r.raw?.stderr ?? "";
  // stdout JSON 含 error 字段
  if (stdout) {
    try {
      const parsed = JSON.parse(stdout);
      const err = parsed?.error;
      if (typeof err === "string" && AUTH_STDOUT_RE.test(err)) return true;
      // 也允许 error 是 object · 取其 code / message
      if (err && typeof err === "object") {
        const blob = JSON.stringify(err);
        if (AUTH_STDOUT_RE.test(blob)) return true;
      }
    } catch {
      // 非 JSON · 直接对原文字符串扫
      if (AUTH_STDOUT_RE.test(stdout)) return true;
    }
  }
  if (stderr && AUTH_STDERR_RE.test(stderr)) return true;
  return false;
}

// nlmJson(["ask", ...]) 的 retry 包装 · 透明地完成第一次失败后的 1 次 retry
// LLM 只 call 一次 · 内部失败时(非鉴权)等 2s 再打一次 · 只有两次都挂才返回失败
// 返回结果对象里加 attempts: 1 | 2 字段 · 方便上层 / 报告诊断
function nlmAskWithRetry(args, opts) {
  const first = nlmJson(args, opts);
  if (first.ok) return { ...first, attempts: 1 };
  if (isAuthFailure(first)) return { ...first, attempts: 1 };
  // 非鉴权失败 · 等 2s 再打一次
  spawnSync("sleep", ["2"]);
  const second = nlmJson(args, opts);
  return { ...second, attempts: 2 };
}

/** async spawn — 返回 Promise<{status, stdout, stderr}> */
function nlmExecAsync(args, { timeoutMs = 60_000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn("notebooklm", args, { timeout: timeoutMs });
    let stdout = "", stderr = "";
    child.stdout?.on("data", (d) => (stdout += d));
    child.stderr?.on("data", (d) => (stderr += d));
    child.on("close", (code) => resolve({ status: code, stdout: stdout.trim(), stderr: stderr.trim() }));
    child.on("error", (e) => resolve({ status: 1, stdout: "", stderr: e.message }));
  });
}

/** async spawn + JSON parse */
async function nlmJsonAsync(args, opts) {
  const r = await nlmExecAsync([...args, "--json"], opts);
  if (r.status !== 0) return { ok: false, raw: r };
  try {
    return { ok: true, data: JSON.parse(r.stdout), raw: r };
  } catch {
    return { ok: false, raw: r };
  }
}

/** 并发执行，限制并发度 */
async function concurrentBatch(items, concurrency, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

function checkAuth() {
  // 两层验证:
  // 1. 本地 cookie 文件 sanity (auth check --test) — 文件存在 / 格式合法 / cookie 域 OK
  // 2. 真打一次 API 验证 Google 侧 session 也 OK (list 命令)
  // 因为 auth check --test 只验本地 · Google 侧 cookie 过期时它仍会通过 · 但 API 调用 401。
  const localR = nlmExec(["auth", "check", "--test"], { timeoutMs: 15_000 });
  if (localR.status !== 0) return false;

  // 真 API 调用验证 (list 是无副作用的轻量 API · stdout 为 401 表明 Google 侧过期)
  const apiR = nlmJson(["list"], { timeoutMs: 30_000 });
  if (!apiR.ok) {
    // list --json 失败 · 可能是 401 / 网络 / 其他
    return false;
  }
  // list 返回错误对象({error: true, ...}) · 也算认证失败
  if (apiR.data?.error === true) return false;
  return true;
}

// ── refreshCookies: rookiepy 从浏览器重提 cookie ─────────────────────

/**
 * 用 rookiepy 从本机浏览器重新提取 Google cookie → 写入 ~/.notebooklm/storage_state.json
 * @returns {{ ok: boolean, cookie_count?: number, browser?: string, error?: string }}
 */
function refreshCookies() {
  const cookieScript = `
import rookiepy, json, os, sys

domains = ['.google.com', 'notebooklm.google.com', 'accounts.google.com']
browsers = [
    ("any_browser", rookiepy.load),
    ("chrome",      lambda **kw: rookiepy.chrome(**kw)),
    ("edge",        lambda **kw: rookiepy.edge(**kw)),
    ("brave",       lambda **kw: rookiepy.brave(**kw)),
    ("chromium",    lambda **kw: rookiepy.chromium(**kw)),
    ("firefox",     lambda **kw: rookiepy.firefox(**kw)),
    ("safari",      lambda **kw: rookiepy.safari(**kw)),
    ("vivaldi",     lambda **kw: rookiepy.vivaldi(**kw)),
    ("opera",       lambda **kw: rookiepy.opera(**kw)),
    ("arc",         lambda **kw: rookiepy.arc(**kw)),
    ("librewolf",   lambda **kw: rookiepy.librewolf(**kw)),
]
cookies = []
used = "none"
for name, fn in browsers:
    try:
        cookies = fn(domains=domains)
        if cookies:
            used = name
            break
    except Exception:
        continue

if not cookies:
    print(json.dumps({"ok": False, "error": "no_cookies", "browser": "none"}))
    sys.exit(0)

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
os.chmod(path, 0o600)
print(json.dumps({"ok": True, "cookie_count": len(cookies), "browser": used}))
`;
  const py = spawnSync("python3", ["-c", cookieScript], {
    encoding: "utf8",
    timeout: 30_000,
  });
  try {
    return JSON.parse(py.stdout);
  } catch {
    return { ok: false, error: "rookiepy_spawn_failed", detail: (py.stderr ?? "").slice(0, 300) };
  }
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

// 检测 notebooklm CLI 实际用的 Python 解释器(可能在 venv 里)· 返回该 Python
// 对应的 pip / playwright 命令。这样如果 notebooklm 装在 venv 里 · 我们用 venv
// 的 pip 装 Playwright · 不会装到系统全局而 venv 里仍缺。
function detectNotebooklmPython() {
  // which notebooklm
  const which = spawnSync("which", ["notebooklm"], { encoding: "utf8", timeout: 5_000 });
  if (which.status !== 0 || !which.stdout?.trim()) return null;
  const cliPath = which.stdout.trim();
  try {
    const firstLine = readFileSync(cliPath, "utf8").split("\n")[0];
    const m = firstLine.match(/^#!\s*(\S+)/);
    if (!m) return null;
    const pythonPath = m[1];
    // 跳过 /usr/bin/env python · 那种没指定具体 venv
    if (pythonPath.includes("/env") || !pythonPath.match(/python/)) return null;
    if (!existsSync(pythonPath)) return null;
    // venv/bin/python → venv/bin/pip + venv/bin/playwright
    const binDir = dirname(pythonPath);
    const pipPath = pythonPath.replace(/python[0-9.]*$/, "pip");
    const pwPath = `${binDir}/playwright`;
    return {
      python: pythonPath,
      pip: existsSync(pipPath) ? pipPath : null,
      playwright: existsSync(pwPath) ? pwPath : `${binDir}/playwright`, // 装完才会有
    };
  } catch {
    return null;
  }
}

async function opSetup(urlsFile) {
  // 检测 notebooklm CLI 的 venv Python(如果有)
  const detectedEnv = detectNotebooklmPython();
  if (detectedEnv) {
    console.error(`→ 检测到 notebooklm CLI 在 venv:${detectedEnv.python}`);
    console.error(`  使用 ${detectedEnv.pip ?? "fallback pip3"} 装包`);
  }

  // Step 9: 安装/升级 pip packages
  // 不能只看 isCliInstalled() · 因为老的基础版 notebooklm 也会让它返 true ·
  // 但缺 [browser] extras → Playwright 没装 → notebooklm login 跑不了。
  // 始终跑 pip install -U notebooklm-py[browser] rookiepy 确保 extras 在。
  // 优先用 detected venv pip · 没检测到才 fallback 到全局 pip3 / pip。
  console.error("→ 安装/升级 notebooklm-py[browser] + rookiepy...");
  const pipArgs = ["install", "-U", "notebooklm-py[browser]", "rookiepy"];
  const pipCandidates = detectedEnv?.pip
    ? [detectedEnv.pip, "pip3", "pip"]
    : ["pip3", "pip"];
  let pipOk = false;
  for (const cmd of pipCandidates) {
    const r = spawnSync(cmd, pipArgs, {
      encoding: "utf8",
      timeout: 180_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    if (r.status === 0) {
      pipOk = true;
      console.error(`  ✓ 用 ${cmd} 装齐`);
      break;
    }
    console.error(`${cmd} install 失败: ${(r.stderr ?? "").slice(0, 300)}`);
  }
  if (!pipOk) {
    return out({
      ok: false,
      error: detectedEnv?.pip
        ? `pip install 失败 · 请手动跑:${detectedEnv.pip} install -U 'notebooklm-py[browser]' rookiepy`
        : "pip install notebooklm-py[browser] rookiepy 失败 · 请手动跑:pip install -U 'notebooklm-py[browser]' rookiepy",
    });
  }

  // 验 Playwright Python 包真装上 · 用 detected venv Python 验
  console.error("→ 验证 Playwright Python 包...");
  const pythonCmd = detectedEnv?.python ?? "python3";
  const pwCheck = spawnSync(pythonCmd, ["-c", "from playwright.sync_api import sync_playwright"], {
    encoding: "utf8",
    timeout: 15_000,
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (pwCheck.status !== 0) {
    return out({
      ok: false,
      error: `Playwright 仍缺(用 ${pythonCmd} 验证) · 请手动跑:${detectedEnv?.pip ?? "pip3"} install playwright`,
      detail: (pwCheck.stderr ?? "").slice(0, 300),
    });
  }

  // 装 chromium browser(notebooklm login 必需)· 用 detected venv playwright
  console.error("→ 安装 Playwright Chromium...");
  const playwrightCmd = detectedEnv?.playwright ?? "playwright";
  const chromR = spawnSync(playwrightCmd, ["install", "chromium"], {
    encoding: "utf8",
    timeout: 180_000,
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (chromR.status !== 0) {
    // 不致命 · 但提示
    console.error(`playwright install chromium 失败:${(chromR.stderr ?? "").slice(0, 300)}`);
    console.error(`→ 后续 notebooklm login 可能跑不起来 · 请手动跑:${playwrightCmd} install chromium`);
  }

  // Step 10: cookie extraction via rookiepy (auto-detect browser)
  console.error("→ 提取浏览器 cookie (rookiepy · 自动探测)...");
  const cookieResult = refreshCookies();
  if (!cookieResult.ok) {
    console.error(`cookie 提取失败: ${cookieResult.error}`);
    console.error("请确保已在任意浏览器中登录 https://notebooklm.google.com/");
  } else {
    console.error(`→ 从 ${cookieResult.browser} 提取到 ${cookieResult.cookie_count} 条 cookie`);
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
        const nbs = listR.data?.notebooks ?? (Array.isArray(listR.data) ? listR.data : []);
        const found = nbs.some((nb) => nb.id === notebookId || nb.notebook_id === notebookId);
        if (!found) {
          console.error(`    notebook ${notebookId} 已不存在,重新创建`);
          notebookId = null;
        }
      }
    }

    // create notebook if needed — 先查同名，避免重复创建
    if (!notebookId) {
      const listR = nlmJson(["list"]);
      if (listR.ok) {
        const nbs = listR.data?.notebooks ?? (Array.isArray(listR.data) ? listR.data : []);
        const existing = nbs.find((nb) => nb.title === notebook_name && nb.is_owner !== false);
        if (existing) {
          notebookId = existing.id;
          console.error(`    复用已有 notebook: ${notebookId}`);
        }
      }
    }
    if (!notebookId) {
      const createR = nlmJson(["create", notebook_name]);
      if (!createR.ok) {
        console.error(`    创建 notebook '${notebook_name}' 失败: ${createR.raw.stderr}`);
        results[domain] = { ok: false, error: "创建失败" };
        continue;
      }
      notebookId = createR.data?.notebook?.id ?? createR.data?.id ?? createR.data?.notebook_id;
      if (!notebookId) {
        const fallbackList = nlmJson(["list"]);
        if (fallbackList.ok) {
          const nbs = fallbackList.data?.notebooks ?? (Array.isArray(fallbackList.data) ? fallbackList.data : []);
          const match = nbs.find((nb) => nb.title === notebook_name);
          if (match) notebookId = match.id;
        }
      }
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

    // add new URLs (concurrent, batch of 5)
    const addedUrls = [...(cfg.notebooks[domain]?.urls ?? []).filter((u) => plannedUrlSet.has(u.url))];
    if (toAdd.length > 0) {
      console.error(`    并发添加 ${toAdd.length} 个 URL (每批 5 个)...`);
      const addResults = await concurrentBatch(toAdd, 5, async (urlEntry) => {
        const r = await nlmJsonAsync(["source", "add", urlEntry.url]);
        if (r.ok) {
          const sourceId = r.data?.source?.id ?? r.data?.id ?? r.data?.source_id ?? null;
          return { url: urlEntry.url, ok: true, source_id: sourceId };
        }
        console.error(`    添加 URL 失败: ${urlEntry.url} — ${r.raw.stderr}`);
        return { url: urlEntry.url, ok: false, source_id: null };
      });
      for (const ar of addResults) {
        if (ar.ok) addedUrls.push({ url: ar.url, source_id: ar.source_id });
      }
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
      const r = nlmAskWithRetry(["ask", query], { timeoutMs: 60_000 });
      if (r.ok) {
        allResults.push({
          domain: d,
          notebook_id: nb.id,
          answer: r.data?.answer ?? r.data?.response ?? "",
          references: r.data?.references ?? r.data?.citations ?? [],
          attempts: r.attempts,
        });
      } else {
        allResults.push({
          domain: d,
          notebook_id: nb.id,
          ok: false,
          error: r.raw?.stderr || r.raw?.stdout || "查询失败",
          attempts: r.attempts,
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

  const r = nlmAskWithRetry(["ask", query], { timeoutMs: 60_000 });
  if (!r.ok) {
    return out({
      ok: false,
      error: `查询失败: ${r.raw.stderr || r.raw.stdout}`,
      domain,
      notebook_id: notebookId,
      attempts: r.attempts,
    });
  }

  out({
    ok: true,
    answer: r.data?.answer ?? r.data?.response ?? "",
    references: r.data?.references ?? r.data?.citations ?? [],
    domain,
    notebook_id: notebookId,
    attempts: r.attempts,
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

// M4 · best-practice 巡检 prompt(对齐设计书 §4 · NLM 刷新最新推荐)
function buildBpPrompt(bp) {
  const paramName = bp.param_name || bp.case_id;
  const current = bp.current_value != null ? String(bp.current_value) : "未获取";
  const kbRec = bp.kb_recommendation != null ? String(bp.kb_recommendation) : "未给";
  const scenario = bp.scenario_quote || "";
  return `参数 ${paramName} · 当前值 ${current} · KB 推荐值 ${kbRec}\n场景: ${scenario}\n请回答:\n1. 该参数的最新官方推荐值(若与 KB 不一致请明确指出)\n2. 推荐理由 + 适用场景\n3. 当前值的风险评估`;
}

// M4 · best-practice scope → notebook 路由
function routeBpToNotebooks(bp, hwArch, cfg) {
  const scope = bp.scope || "";
  const notebooks = [];

  // OS 层(linux-*)→ os notebook
  if (/^linux-/.test(scope)) {
    if (cfg.notebooks?.os) notebooks.push("os");
  }
  // 鲲鹏 / ARM / BIOS → kunpeng notebook(若 hwArch=kunpeng)
  if (scope === "arch" || scope === "bios-firmware") {
    if (hwArch === "kunpeng" && cfg.notebooks?.kunpeng) notebooks.push("kunpeng");
    else if (cfg.notebooks?.os && !notebooks.includes("os")) notebooks.push("os");
  }
  // 引擎 / mongo 配置 / 应用层 → mongo notebook
  if (/^storage-engine-/.test(scope) || /^mongodb-/.test(scope) || scope === "app-query-layer") {
    if (cfg.notebooks?.mongo) notebooks.push("mongo");
  }
  // fallback: 第一个可用 notebook
  if (notebooks.length === 0) {
    const firstAvail = Object.keys(cfg.notebooks ?? {})[0];
    if (firstAvail) notebooks.push(firstAvail);
  }
  return notebooks;
}

// M4 · 通用 batch · 接 fromDiagnose | fromBpList · chunk size 5 控制单 ask 长度
function opQueryBatch({ fromDiagnose, fromBpList, hwArch }) {
  if (!fromDiagnose && !fromBpList) fatal("--from-diagnose 或 --from-bp-list 必须提供其一");
  if (fromDiagnose && fromBpList) fatal("--from-diagnose 和 --from-bp-list 不能同时给");
  if (!isCliInstalled()) fatal("notebooklm CLI 未安装");

  const cfg = loadConfig();
  if (!cfg?.notebooks || Object.keys(cfg.notebooks).length === 0) {
    fatal("NotebookLM 未配置,请先运行 --op setup");
  }

  // 统一 items 列表 [{ case_id, prompt, route: [domain, ...] }]
  let items = [];

  if (fromDiagnose) {
    const diagData = JSON.parse(readFileSync(resolve(fromDiagnose), "utf8"));
    // 只对 critical/warning 问题项跑 NotebookLM · 排除 path D (FTS) 和 info/ok
    const checks = (diagData.matched ?? []).filter(
      (r) => r.path !== "D" && (r.severity === "critical" || r.severity === "warning")
    );
    items = checks.map((cr) => ({
      case_id: cr.case_id,
      prompt: buildQueryPrompt(cr),
      route: routeToNotebooks(cr, hwArch, cfg),
    }));
  } else {
    const bpList = JSON.parse(readFileSync(resolve(fromBpList), "utf8"));
    if (!Array.isArray(bpList)) fatal("--from-bp-list 文件须是 JSON 数组");
    items = bpList.map((bp) => ({
      case_id: bp.case_id,
      prompt: buildBpPrompt(bp),
      route: routeBpToNotebooks(bp, hwArch, cfg),
    }));
  }

  if (items.length === 0) {
    return out({ ok: true, results: [], reason: "无项目进入 NotebookLM batch · 跳过" });
  }

  // group by notebook
  const grouped = {}; // notebook_domain -> [{ case_id, prompt }]
  for (const item of items) {
    for (const t of item.route) {
      if (!grouped[t]) grouped[t] = [];
      grouped[t].push(item);
    }
  }

  // chunk + batch query · CHUNK_SIZE=5 防 prompt 超 NLM 输入限
  const CHUNK_SIZE = 5;
  const results = [];

  for (const [domain, domainItems] of Object.entries(grouped)) {
    const nb = cfg.notebooks[domain];
    if (!nb?.id) continue;

    nlmExec(["use", nb.id]);

    for (let i = 0; i < domainItems.length; i += CHUNK_SIZE) {
      const chunk = domainItems.slice(i, i + CHUNK_SIZE);
      const mergedPrompt = chunk
        .map((item, j) => `【问题 ${j + 1}】${item.prompt}`)
        .join("\n\n");

      const r = nlmAskWithRetry(["ask", mergedPrompt], { timeoutMs: 90_000 });

      if (r.ok) {
        const answer = r.data?.answer ?? r.data?.response ?? "";
        const references = r.data?.references ?? r.data?.citations ?? [];
        for (const item of chunk) {
          results.push({
            case_id: item.case_id,
            answer,
            references,
            domain,
            notebook_id: nb.id,
            attempts: r.attempts,
          });
        }
      } else {
        console.error(`查询 ${domain} chunk[${i}-${i + chunk.length - 1}] 失败: ${r.raw.stderr}`);
        for (const item of chunk) {
          results.push({
            case_id: item.case_id,
            answer: "",
            references: [],
            domain,
            notebook_id: nb.id,
            error: r.raw.stderr || "查询失败",
            attempts: r.attempts,
          });
        }
      }

      // throttle between chunks (2s within same notebook)
      if (i + CHUNK_SIZE < domainItems.length) {
        spawnSync("sleep", ["2"]);
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

async function opAddDomain(domain, urlsFile) {
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

  // check existence — 先查 config id 是否有效，再查同名
  if (notebookId) {
    const listR = nlmJson(["list"]);
    if (listR.ok) {
      const nbs = listR.data?.notebooks ?? (Array.isArray(listR.data) ? listR.data : []);
      if (!nbs.some((nb) => nb.id === notebookId || nb.notebook_id === notebookId)) {
        notebookId = null;
      }
    }
  }
  if (!notebookId) {
    // 查同名 notebook，避免重复创建
    const listR = nlmJson(["list"]);
    if (listR.ok) {
      const nbs = listR.data?.notebooks ?? (Array.isArray(listR.data) ? listR.data : []);
      const existing = nbs.find((nb) => nb.title === notebook_name && nb.is_owner !== false);
      if (existing) notebookId = existing.id;
    }
  }
  if (!notebookId) {
    const createR = nlmJson(["create", notebook_name]);
    if (!createR.ok) fatal(`创建 notebook '${notebook_name}' 失败: ${createR.raw.stderr}`);
    notebookId = createR.data?.notebook?.id ?? createR.data?.id ?? createR.data?.notebook_id;
    if (!notebookId) {
      const fallbackList = nlmJson(["list"]);
      if (fallbackList.ok) {
        const nbs = fallbackList.data?.notebooks ?? (Array.isArray(fallbackList.data) ? fallbackList.data : []);
        const match = nbs.find((nb) => nb.title === notebook_name);
        if (match) notebookId = match.id;
      }
    }
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

  if (toAdd.length > 0) {
    console.error(`  并发添加 ${toAdd.length} 个 URL (每批 5 个)...`);
    const addResults = await concurrentBatch(toAdd, 5, async (urlEntry) => {
      const r = await nlmJsonAsync(["source", "add", urlEntry.url]);
      const sourceId = r.ok ? (r.data?.source?.id ?? r.data?.id ?? r.data?.source_id ?? null) : null;
      const status = r.ok ? "PENDING" : "FAILED";
      return { url: urlEntry.url, source_id: sourceId, status, ok: r.ok };
    });
    for (const ar of addResults) {
      addedUrls.push({ url: ar.url, source_id: ar.source_id });
      urlResults.push({ url: ar.url, source_id: ar.source_id, status: ar.status });
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
    "from-bp-list": { type: "string" },
    "hw-arch": { type: "string" },
    "urls-file": { type: "string" },
  },
});

(async () => {
  try {
    switch (values.op) {
      case "check":
        opCheck();
        break;
      case "setup":
        await opSetup(values["urls-file"]);
        break;
      case "query":
        opQuery(values.domain, values.query);
        break;
      case "query-batch":
        opQueryBatch({
          fromDiagnose: values["from-diagnose"],
          fromBpList: values["from-bp-list"],
          hwArch: values["hw-arch"],
        });
        break;
      case "add-domain":
        await opAddDomain(values.domain, values["urls-file"]);
        break;
      default:
        fatal(`未知 op: ${values.op}。支持: check | setup | query | query-batch | add-domain`);
    }
  } catch (e) {
    out({ ok: false, error: e instanceof Error ? e.message : String(e) });
    process.exit(1);
  }
})();
