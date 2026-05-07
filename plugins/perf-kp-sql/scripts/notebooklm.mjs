#!/usr/bin/env node
/**
 * notebooklm.mjs — perf-kp-sql NotebookLM 集成 adapter
 *
 * 不造轮子 · 全部能力来自上游 jacob-bd/notebooklm-mcp-cli (4.2K star · CDP 标准做法)
 * adapter 只做:参数透传 + JSON 解析 + domain 路由 + 配置文件读写 + 失败降级
 *
 * 单入口 · 7 个 op:
 *   --op check        检查状态 (nlm 装 / 鉴权 / notebooks)
 *   --op refresh-auth 凭据失效时触发重登 (spawn nlm login · 隔离 Chrome 弹窗)
 *   --op setup        uv tool install + nlm login + 建 notebooks + 加 sources
 *   --op disable      用户跳过 NLM · 写 skipped 标记 · 0 依赖
 *   --op query        单条查询 (auto domain 路由)
 *   --op query-batch  批量查询 (chunk 5)
 *   --op add-domain   注册新 domain
 *
 * 关键事实(adapter 必须遵守):
 *   - nlm 错误走 stdout(不是 stderr)· exit 1/2 区分 · 必须先判 exit code
 *   - nlm login --check exit 0 = 有效 / exit 2 = 失效
 *   - nlm source add 无 --json · 解析 stdout regex `Source ID: <id>` 兜底
 *   - spawn 加 NO_COLOR=1 + TERM=dumb 防 ANSI
 */

import { spawnSync, spawn } from "node:child_process";
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

// 防 nlm rich Console ANSI 颜色
const NLM_SPAWN_ENV = { ...process.env, NO_COLOR: "1", TERM: "dumb" };

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

/** Resolve NLM source_id UUIDs → actual source URLs using config mapping */
function resolveSourceIds(references, cfg) {
  if (!references || !Array.isArray(references) || !cfg?.notebooks) return references;
  const idToUrl = new Map();
  for (const nb of Object.values(cfg.notebooks)) {
    for (const entry of nb.urls ?? []) {
      if (entry.source_id && entry.url) idToUrl.set(entry.source_id, entry.url);
    }
  }
  return references.map(ref => {
    const sid = ref.source_id ?? ref.id;
    const resolvedUrl = sid ? idToUrl.get(sid) : undefined;
    return { ...ref, source_url: resolvedUrl ?? null };
  });
}

// ── nlm CLI 调用层 ──────────────────────────────────────────────────

function isCliInstalled() {
  try {
    const r = spawnSync("nlm", ["--version"], {
      encoding: "utf8",
      timeout: 10_000,
      env: NLM_SPAWN_ENV,
    });
    return r.status === 0;
  } catch {
    return false;
  }
}

function nlmExec(args, { timeoutMs = 60_000 } = {}) {
  const r = spawnSync("nlm", args, {
    encoding: "utf8",
    timeout: timeoutMs,
    env: NLM_SPAWN_ENV,
  });
  return { status: r.status, stdout: (r.stdout ?? "").trim(), stderr: (r.stderr ?? "").trim() };
}

/**
 * spawn nlm 子命令 + JSON 解析
 * 注意:nlm 错误走 stdout · 必须先判 exit code · 失败时不 JSON.parse
 */
function nlmJson(args, opts) {
  const r = nlmExec([...args, "--json"], opts);
  if (r.status !== 0) {
    return { ok: false, raw: r };
  }
  try {
    return { ok: true, data: JSON.parse(r.stdout), raw: r };
  } catch {
    // exit 0 但 stdout 非 JSON · 尝试取末尾 JSON 片段(rich 多行包了 JSON 的情况)
    const lastBrace = r.stdout.lastIndexOf("{");
    const firstBracket = r.stdout.indexOf("[");
    const start = lastBrace !== -1 ? lastBrace : firstBracket;
    if (start !== -1) {
      try {
        return { ok: true, data: JSON.parse(r.stdout.slice(start)), raw: r };
      } catch {}
    }
    return { ok: false, raw: r };
  }
}

/** async spawn — 返回 Promise<{status, stdout, stderr}> */
function nlmExecAsync(args, { timeoutMs = 60_000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn("nlm", args, { timeout: timeoutMs, env: NLM_SPAWN_ENV });
    let stdout = "", stderr = "";
    child.stdout?.on("data", (d) => (stdout += d));
    child.stderr?.on("data", (d) => (stderr += d));
    child.on("close", (code) => resolve({ status: code, stdout: stdout.trim(), stderr: stderr.trim() }));
    child.on("error", (e) => resolve({ status: 1, stdout: "", stderr: e.message }));
  });
}

async function nlmJsonAsync(args, opts) {
  const r = await nlmExecAsync([...args, "--json"], opts);
  if (r.status !== 0) return { ok: false, raw: r };
  try {
    return { ok: true, data: JSON.parse(r.stdout), raw: r };
  } catch {
    const lastBrace = r.stdout.lastIndexOf("{");
    const firstBracket = r.stdout.indexOf("[");
    const start = lastBrace !== -1 ? lastBrace : firstBracket;
    if (start !== -1) {
      try {
        return { ok: true, data: JSON.parse(r.stdout.slice(start)), raw: r };
      } catch {}
    }
    return { ok: false, raw: r };
  }
}

// 鉴权失败识别 — nlm 错误模式
//   exit 2 = login --check 凭据失效
//   exit 1 + stdout 含 "Profile not found" / "Authentication failed" / "Error: ..." = 鉴权失败
const AUTH_RE = /Profile.*not found|Authentication failed|✗ Authentication|auth_expired|unauthorized|cookie_invalid|cookie expired|认证未通过|401|403/i;

function isAuthFailure(r) {
  if (!r || r.ok) return false;
  if (r.raw?.status === 2) return true;
  const stdout = r.raw?.stdout ?? "";
  const stderr = r.raw?.stderr ?? "";
  if (stdout && AUTH_RE.test(stdout)) return true;
  if (stderr && AUTH_RE.test(stderr)) return true;
  return false;
}

// nlm query 重试包装 · 非鉴权失败时等 2s 再打一次
function nlmAskWithRetry(args, opts) {
  const first = nlmJson(args, opts);
  if (first.ok) return { ...first, attempts: 1 };
  if (isAuthFailure(first)) return { ...first, attempts: 1 };
  spawnSync("sleep", ["2"]);
  const second = nlmJson(args, opts);
  return { ...second, attempts: 2 };
}

/** 并发执行 · 限制并发度 */
async function concurrentBatch(items, concurrency, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

/** 验证 nlm 当前 profile 凭据是否有效 · 用 `nlm login --check` exit 0/2 */
function checkAuth() {
  const r = nlmExec(["login", "--check"], { timeoutMs: 30_000 });
  return r.status === 0;
}

/**
 * 检测系统是否装了 Chromium 系浏览器(nlm CDP 必需)
 * @returns {{ ok: boolean, found: string[], suggestion?: string }}
 */
function detectChromiumBrowser() {
  const platform = process.platform;
  const found = [];

  if (platform === "darwin") {
    const apps = [
      ["Google Chrome", "/Applications/Google Chrome.app"],
      ["Microsoft Edge", "/Applications/Microsoft Edge.app"],
      ["Brave Browser", "/Applications/Brave Browser.app"],
      ["Arc", "/Applications/Arc.app"],
      ["Vivaldi", "/Applications/Vivaldi.app"],
      ["Opera", "/Applications/Opera.app"],
      ["Chromium", "/Applications/Chromium.app"],
    ];
    for (const [name, path] of apps) {
      if (existsSync(path)) found.push(name);
    }
  } else if (platform === "linux") {
    const cmds = ["google-chrome", "chromium", "chromium-browser", "brave-browser", "microsoft-edge", "vivaldi", "opera"];
    for (const cmd of cmds) {
      const r = spawnSync("which", [cmd], { encoding: "utf8", timeout: 3_000 });
      if (r.status === 0 && r.stdout?.trim()) found.push(cmd);
    }
  } else if (platform === "win32") {
    const candidates = [
      ["Chrome", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"],
      ["Chrome (x86)", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"],
      ["Edge", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"],
      ["Brave", "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe"],
    ];
    for (const [name, path] of candidates) {
      if (existsSync(path)) found.push(name);
    }
  }

  return {
    ok: found.length > 0,
    found,
    suggestion: found.length === 0
      ? "请装 Chrome / Edge / Brave 任一(免费下载 · 不影响日常用 Firefox / Safari)"
      : undefined,
  };
}

// ── op: check ────────────────────────────────────────────────────────

function opCheck() {
  const cfg = loadConfig();
  if (cfg?.skipped) {
    return out({
      installed: false,
      authenticated: false,
      skipped: true,
      skipped_at: cfg.skipped_at ?? null,
      reason: cfg.skip_reason ?? "用户在 setup 时主动选择跳过",
      notebooks: {},
    });
  }
  const installed = isCliInstalled();
  if (!installed) {
    return out({ installed: false, authenticated: false, notebooks: {} });
  }
  const authenticated = checkAuth();
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

// ── op: disable ──────────────────────────────────────────────────────

function opDisable(reason) {
  const cfg = loadConfig() || { notebooks: {}, version: "0.49.1", created_at: new Date().toISOString().slice(0, 10) };
  cfg.skipped = true;
  cfg.skipped_at = new Date().toISOString();
  if (reason) cfg.skip_reason = reason;
  saveConfig(cfg);
  console.error("→ NotebookLM 已标记跳过 · 后续诊断走仅案例(不装 notebooklm-mcp-cli · 0 依赖)");
  console.error("  下次想启用 · 跑 /perf-kp-sql-setup 选启用即可");
  out({ ok: true, skipped: true, message: "NotebookLM 已禁用 · 诊断走仅案例" });
}

// ── op: refresh-auth ─────────────────────────────────────────────────

/**
 * 凭据失效时的恢复流程 · 完全 spawn 上游 nlm · 不造轮子
 *   1. nlm login --check
 *   2. 失效 → spawn nlm login(隔离 Chrome 弹窗 · CDP 自动 detect 完成)
 */
function opRefreshAuth() {
  console.error("→ 验证当前凭据...");
  if (checkAuth()) {
    return out({ ok: true, method: "still_valid", message: "凭据仍有效 · 无需重登" });
  }

  // 检测 Chromium 系浏览器
  const browser = detectChromiumBrowser();
  if (!browser.ok) {
    return out({
      ok: false,
      need_chromium_browser: true,
      message: "客户机器无 Chromium 系浏览器 · 无法用 nlm CDP 登录",
      suggestion: browser.suggestion,
      next_steps: [
        "装 Chrome / Edge / Brave 任一(免费 · 不影响日常浏览器)",
        "或:跑 notebooklm.mjs --op disable 跳过 NLM · 走仅案例",
      ],
    });
  }

  console.error("→ 凭据失效 · 启动 nlm login(隔离 Chrome 自动弹出 · 客户登录 1 次 · CDP 自动 detect 完成 · 无 Terminal ENTER)...");
  console.error("  ⚠️ 启动前请先关闭所有 Chrome 实例(macOS Cmd+Q · Win 任务管理器 chrome.exe) · Chromium 单进程模型限制");

  const loginR = spawnSync("nlm", ["login"], {
    encoding: "utf8",
    timeout: 300_000,
    stdio: ["ignore", "pipe", "pipe"],
    env: NLM_SPAWN_ENV,
  });

  if (loginR.status === 0 && checkAuth()) {
    return out({ ok: true, method: "nlm_login", chromium: browser.found });
  }

  out({
    ok: false,
    need_user_action: true,
    error: "nlm login 失败",
    stdout: (loginR.stdout ?? "").slice(0, 500),
    stderr: (loginR.stderr ?? "").slice(0, 500),
    next_steps: [
      "1. 确认日常 Chrome 全关 · 重跑 notebooklm.mjs --op refresh-auth",
      "2. 或:跑 /perf-kp-sql-setup 重新走完整 setup",
      "3. 仍失败:上游 issue tracker https://github.com/jacob-bd/notebooklm-mcp-cli/issues",
    ],
  });
}

// ── op: setup ────────────────────────────────────────────────────────

async function opSetup(urlsFile) {
  // 不造轮子:全部 spawn 上游 jacob-bd/notebooklm-mcp-cli (4.2K star CDP 标准)
  //   1. 检测 uv
  //   2. 检测 Chromium 系浏览器(nlm CDP 必需)
  //   3. uv tool install notebooklm-mcp-cli(幂等)
  //   4. nlm login --check (exit 0=skip · exit 2=登录)
  //   5. spawn nlm login(隔离 Chrome 弹 · CDP detect 完成 · 无 Terminal ENTER)
  //   6. nlm notebook list/create + nlm source add --wait

  // 用户重跑 setup → 取消之前的 skipped 标记
  const prevCfg = loadConfig();
  if (prevCfg?.skipped) {
    delete prevCfg.skipped;
    delete prevCfg.skipped_at;
    delete prevCfg.skip_reason;
    saveConfig(prevCfg);
    console.error("→ 检测到之前 NotebookLM 已禁用 · 切换为启用");
  }

  // Step 1: 检测 uv
  const uvCheck = spawnSync("uv", ["--version"], { encoding: "utf8", timeout: 5_000 });
  if (uvCheck.status !== 0) {
    return out({
      ok: false,
      error: "uv 未安装 · 请先装 uv 后重跑 setup",
      next_steps: [
        "macOS / Linux: curl -LsSf https://astral.sh/uv/install.sh | sh",
        "或 Homebrew: brew install uv",
        "或 pipx: pipx install uv",
        "装好 uv 后重跑 /perf-kp-sql-setup",
      ],
    });
  }
  console.error(`  ✓ uv: ${uvCheck.stdout.trim()}`);

  // Step 2: 检测 Chromium 系浏览器
  const browser = detectChromiumBrowser();
  if (!browser.ok) {
    return out({
      ok: false,
      need_chromium_browser: true,
      error: "客户机器无 Chromium 系浏览器(nlm CDP 必需)",
      suggestion: browser.suggestion,
      next_steps: [
        "装 Chrome / Edge / Brave 任一(免费 · 不影响日常用 Firefox / Safari)",
        "  - Chrome: https://www.google.com/chrome/",
        "  - Edge: https://www.microsoft.com/edge",
        "  - Brave: https://brave.com/",
        "或:跑 /perf-kp-sql-setup 选 2(跳过 NLM)走仅案例",
      ],
    });
  }
  console.error(`  ✓ Chromium 系浏览器: ${browser.found.join(", ")}`);

  // Step 3: uv tool install notebooklm-mcp-cli(幂等)
  console.error("→ 装 / 升级 notebooklm-mcp-cli(uv tool install)...");
  const uvR = spawnSync("uv", ["tool", "install", "notebooklm-mcp-cli", "--upgrade"], {
    encoding: "utf8",
    timeout: 300_000,
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (uvR.status !== 0) {
    return out({
      ok: false,
      error: "uv tool install notebooklm-mcp-cli 失败",
      stderr: (uvR.stderr ?? "").slice(0, 500),
      next_steps: [`手动跑: uv tool install notebooklm-mcp-cli --upgrade`],
    });
  }
  console.error("  ✓ notebooklm-mcp-cli 装齐");

  // Step 4: nlm 验证(exit 0 = 在 PATH)
  if (!isCliInstalled()) {
    return out({
      ok: false,
      error: "uv tool install 后 nlm 仍不在 PATH",
      next_steps: [
        "确认 ~/.local/bin 在 PATH(echo $PATH | tr ':' '\\n' | grep -F '.local/bin')",
        "或跑 uv tool update-shell 自动加 PATH",
      ],
    });
  }

  // Step 5: nlm login --check
  console.error("→ 验证 nlm 凭据...");
  if (checkAuth()) {
    console.error("  ✓ 现有凭据有效 · 跳过登录 · 直接创建 notebooks");
  } else {
    console.error("→ 凭据失效或首次登录 · 启动 nlm login(隔离 Chrome 弹出 · 客户登录 1 次 · CDP 自动 detect)...");
    console.error("  ⚠️ 启动前请先关闭所有 Chrome 实例(Cmd+Q) · Chromium 单进程模型 · 只这一次");

    const loginR = spawnSync("nlm", ["login"], {
      encoding: "utf8",
      timeout: 300_000,
      stdio: ["ignore", "pipe", "pipe"],
      env: NLM_SPAWN_ENV,
    });

    if (loginR.status !== 0 || !checkAuth()) {
      return out({
        ok: false,
        need_user_login: true,
        error: "nlm login 失败 · 客户没在 5 min 内完成登录 / Chrome 进程冲突 / EDR 拦截 / 网络受限",
        stdout: (loginR.stdout ?? "").slice(0, 500),
        stderr: (loginR.stderr ?? "").slice(0, 500),
        next_steps: [
          "1. 确认所有 Chrome 实例已关(macOS Cmd+Q · Win 任务管理器结束 chrome.exe)",
          "2. 重跑 /perf-kp-sql-setup",
          "3. 仍失败 → 选项 A:跑 notebooklm.mjs --op disable 跳过 NLM · 选项 B:上游 issue tracker https://github.com/jacob-bd/notebooklm-mcp-cli/issues",
        ],
      });
    }
    console.error("  ✓ nlm login 成功 · cookie 落盘 · 后续诊断 0 客户操作");
  }

  // Step 6: 创建 notebooks + 添加 URLs
  console.error("→ 创建 Notebooks 并添加 URL...");
  const urlsData = loadUrlsJson(urlsFile);
  const cfg = loadConfig() || { notebooks: {}, version: "0.49.1", created_at: new Date().toISOString().slice(0, 10) };
  cfg.notebooks = cfg.notebooks || {};

  const results = {};

  // 拉一次 notebook list 复用避免重复创建
  const listR = nlmJson(["notebook", "list"]);
  const allNotebooks = listR.ok
    ? (listR.data?.notebooks ?? (Array.isArray(listR.data) ? listR.data : []))
    : [];

  for (const domainDef of urlsData.domains) {
    const { domain, notebook_name } = domainDef;
    const urls = domainDef.urls || [];
    console.error(`  → 领域 ${domain}: ${urls.length} 个 URL`);

    let notebookId = cfg.notebooks[domain]?.id;

    // 验证 config 里的 id 是否还存在
    if (notebookId && !allNotebooks.some((nb) => nb.id === notebookId || nb.notebook_id === notebookId)) {
      console.error(`    notebook ${notebookId} 已不存在 · 重新创建`);
      notebookId = null;
    }

    // 同名复用
    if (!notebookId) {
      const existing = allNotebooks.find((nb) => nb.title === notebook_name);
      if (existing) {
        notebookId = existing.id ?? existing.notebook_id;
        console.error(`    复用已有 notebook: ${notebookId}`);
      }
    }

    // 创建
    if (!notebookId) {
      const createR = nlmExec(["notebook", "create", notebook_name], { timeoutMs: 60_000 });
      if (createR.status !== 0) {
        console.error(`    创建 notebook '${notebook_name}' 失败: ${(createR.stdout || createR.stderr).slice(0, 200)}`);
        results[domain] = { ok: false, error: "创建失败" };
        continue;
      }
      // create 输出可能不是纯 JSON · 走 list 兜底拿 id
      const fallbackList = nlmJson(["notebook", "list"]);
      if (fallbackList.ok) {
        const nbs = fallbackList.data?.notebooks ?? (Array.isArray(fallbackList.data) ? fallbackList.data : []);
        const match = nbs.find((nb) => nb.title === notebook_name);
        if (match) notebookId = match.id ?? match.notebook_id;
      }
      if (!notebookId) {
        console.error(`    无法获取 notebook id`);
        results[domain] = { ok: false, error: "无法获取 id" };
        continue;
      }
    }

    // 增量同步 source · 去重时合并 (a) 本地 cfg 已记录 + (b) 远端 notebook 已存在
    // 复用同名 notebook 时(862c4191-...)· 远端可能有上次 setup 加的 source · 本地 cfg 清后并不知道 · 必须查远端
    const remoteSrcR = nlmJson(["source", "list", notebookId]);
    const remoteSrcs = remoteSrcR.ok
      ? (Array.isArray(remoteSrcR.data) ? remoteSrcR.data : (remoteSrcR.data?.sources ?? []))
      : [];
    const remoteUrlToId = new Map();
    for (const s of remoteSrcs) {
      const u = s.url ?? s.source_url;
      const id = s.id ?? s.source_id;
      if (u && id) remoteUrlToId.set(u, id);
    }
    if (remoteUrlToId.size > 0) {
      console.error(`    远端 notebook 已有 ${remoteUrlToId.size} 个 source · 跳过重复添加`);
    }

    const cfgUrls = cfg.notebooks[domain]?.urls ?? [];
    const cfgUrlSet = new Set(cfgUrls.map((u) => u.url));
    const allExistingUrls = new Set([...cfgUrlSet, ...remoteUrlToId.keys()]);
    const plannedUrlSet = new Set(urls.map((u) => u.url));
    const toAdd = urls.filter((u) => !allExistingUrls.has(u.url));
    const toRemove = cfgUrls.filter((u) => !plannedUrlSet.has(u.url));

    // 删除多余 source
    for (const entry of toRemove) {
      if (entry.source_id) {
        console.error(`    删除已移除的 URL source: ${entry.source_id}`);
        nlmExec(["source", "delete", entry.source_id], { timeoutMs: 30_000 });
      }
    }

    // 添加新 source(并发 5 · --wait 自带等 source 处理完成)· 远端已有的合并进 cfg(下次 setup 0 overhead)
    const addedUrls = [];
    for (const u of urls) {
      if (cfgUrlSet.has(u.url)) {
        const cfgEntry = cfgUrls.find((x) => x.url === u.url);
        addedUrls.push({ url: u.url, source_id: cfgEntry?.source_id ?? remoteUrlToId.get(u.url) ?? null });
      } else if (remoteUrlToId.has(u.url)) {
        addedUrls.push({ url: u.url, source_id: remoteUrlToId.get(u.url) });
      }
    }
    if (toAdd.length > 0) {
      console.error(`    并发添加 ${toAdd.length} 个 URL (每批 5 个 · --wait)...`);
      const addResults = await concurrentBatch(toAdd, 5, async (urlEntry) => {
        const r = await nlmExecAsync(
          ["source", "add", notebookId, "--url", urlEntry.url, "--wait"],
          { timeoutMs: 180_000 }
        );
        if (r.status !== 0) {
          console.error(`    添加 URL 失败: ${urlEntry.url} — ${(r.stdout || r.stderr).slice(0, 200)}`);
          return { url: urlEntry.url, ok: false, source_id: null };
        }
        // 解析 stdout `Source ID: <id>` 拿 id(无 --json · 上游设计)
        const idMatch = r.stdout.match(/Source ID:\s*([\w-]+)/);
        return { url: urlEntry.url, ok: true, source_id: idMatch?.[1] ?? null };
      });
      for (const ar of addResults) {
        if (ar.ok) addedUrls.push({ url: ar.url, source_id: ar.source_id });
      }
    }

    // 用 nlm source list 兜底拿全 source(含真实 id) · 容错 source add stdout 解析失败
    const srcListR = nlmJson(["source", "list", notebookId]);
    if (srcListR.ok) {
      const srcs = Array.isArray(srcListR.data) ? srcListR.data : (srcListR.data?.sources ?? []);
      const refreshedUrls = addedUrls.map((u) => {
        if (u.source_id) return u;
        const found = srcs.find((s) => s.url === u.url || s.title === u.title);
        return { ...u, source_id: found?.id ?? found?.source_id ?? null };
      });
      cfg.notebooks[domain] = {
        id: notebookId,
        source_count: refreshedUrls.length,
        urls: refreshedUrls,
      };
    } else {
      cfg.notebooks[domain] = {
        id: notebookId,
        source_count: addedUrls.length,
        urls: addedUrls,
      };
    }
    results[domain] = { ok: true, notebook_id: notebookId, source_count: cfg.notebooks[domain].source_count };
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

function resolveAutoDomain(query, cfg) {
  const matched = [];
  for (const [domain, patterns] of Object.entries(KEYWORD_ROUTES)) {
    if (!cfg.notebooks?.[domain]) continue;
    if (patterns.some((re) => re.test(query))) matched.push(domain);
  }
  if (matched.length === 0) return Object.keys(cfg.notebooks ?? {});
  return matched;
}

function opQuery(domain, query) {
  if (!domain || !query) fatal("--domain and --query required");
  if (!isCliInstalled()) fatal("nlm 未安装 · 请先跑 /perf-kp-sql-setup");

  const cfg = loadConfig();

  if (domain === "auto") {
    const targets = resolveAutoDomain(query, cfg);
    const allResults = [];
    for (const d of targets) {
      const nb = cfg.notebooks?.[d];
      if (!nb?.id) continue;
      const r = nlmAskWithRetry(
        ["notebook", "query", nb.id, query, "--timeout", "120"],
        { timeoutMs: 130_000 }
      );
      if (r.ok) {
        allResults.push({
          domain: d,
          notebook_id: nb.id,
          answer: r.data?.answer ?? r.data?.response ?? "",
          references: resolveSourceIds(r.data?.references ?? r.data?.citations ?? r.data?.sources_used ?? [], cfg),
          attempts: r.attempts,
        });
      } else {
        allResults.push({
          domain: d,
          notebook_id: nb.id,
          ok: false,
          error: ((r.raw?.stdout || r.raw?.stderr || "查询失败")).slice(0, 300),
          attempts: r.attempts,
        });
      }
      if (targets.length > 1) spawnSync("sleep", ["2"]);
    }
    return out({ ok: true, results: allResults });
  }

  if (!cfg?.notebooks?.[domain]) fatal(`领域 '${domain}' 未配置 · 请先运行 --op setup`);
  const notebookId = cfg.notebooks[domain].id;

  const r = nlmAskWithRetry(
    ["notebook", "query", notebookId, query, "--timeout", "120"],
    { timeoutMs: 130_000 }
  );
  if (!r.ok) {
    return out({
      ok: false,
      error: `查询失败: ${((r.raw?.stdout || r.raw?.stderr || "")).slice(0, 300)}`,
      domain,
      notebook_id: notebookId,
      attempts: r.attempts,
    });
  }

  out({
    ok: true,
    answer: r.data?.answer ?? r.data?.response ?? "",
    references: resolveSourceIds(r.data?.references ?? r.data?.citations ?? r.data?.sources_used ?? [], cfg),
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

  if (checkResult.data?.tags?.includes?.("cross_domain")) {
    if (cfg.notebooks?.os && !notebooks.includes("os")) notebooks.push("os");
  }

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

function buildBpPrompt(bp) {
  const paramName = bp.param_name || bp.case_id;
  const current = bp.current_value != null ? String(bp.current_value) : "未获取";
  const caseRec = bp.case_recommendation != null ? String(bp.case_recommendation) : "未给";
  const scenario = bp.scenario_quote || "";
  return `参数 ${paramName} · 当前值 ${current} · 案例推荐值 ${caseRec}\n场景: ${scenario}\n请回答:\n1. 该参数的最新官方推荐值(若与案例不一致请明确指出)\n2. 推荐理由 + 适用场景\n3. 当前值的风险评估`;
}

function routeBpToNotebooks(bp, hwArch, cfg) {
  const scope = bp.scope || "";
  const notebooks = [];
  if (/^linux-/.test(scope)) {
    if (cfg.notebooks?.os) notebooks.push("os");
  }
  if (scope === "arch" || scope === "bios-firmware") {
    if (hwArch === "kunpeng" && cfg.notebooks?.kunpeng) notebooks.push("kunpeng");
    else if (cfg.notebooks?.os && !notebooks.includes("os")) notebooks.push("os");
  }
  if (/^storage-engine-/.test(scope) || /^mongodb-/.test(scope) || scope === "app-query-layer") {
    if (cfg.notebooks?.mongo) notebooks.push("mongo");
  }
  if (notebooks.length === 0) {
    const firstAvail = Object.keys(cfg.notebooks ?? {})[0];
    if (firstAvail) notebooks.push(firstAvail);
  }
  return notebooks;
}

function opQueryBatch({ fromDiagnose, fromBpList, hwArch }) {
  if (!fromDiagnose && !fromBpList) fatal("--from-diagnose 或 --from-bp-list 必须提供其一");
  if (fromDiagnose && fromBpList) fatal("--from-diagnose 和 --from-bp-list 不能同时给");
  if (!isCliInstalled()) fatal("nlm 未安装 · 请先跑 /perf-kp-sql-setup");

  const cfg = loadConfig();
  if (!cfg?.notebooks || Object.keys(cfg.notebooks).length === 0) {
    fatal("NotebookLM 未配置 · 请先运行 --op setup");
  }

  let items = [];

  if (fromDiagnose) {
    const diagData = JSON.parse(readFileSync(resolve(fromDiagnose), "utf8"));
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

  const grouped = {};
  for (const item of items) {
    for (const t of item.route) {
      if (!grouped[t]) grouped[t] = [];
      grouped[t].push(item);
    }
  }

  const CHUNK_SIZE = 5;
  const results = [];

  for (const [domain, domainItems] of Object.entries(grouped)) {
    const nb = cfg.notebooks[domain];
    if (!nb?.id) continue;

    for (let i = 0; i < domainItems.length; i += CHUNK_SIZE) {
      const chunk = domainItems.slice(i, i + CHUNK_SIZE);
      const mergedPrompt = chunk
        .map((item, j) => `【问题 ${j + 1}】${item.prompt}`)
        .join("\n\n");

      const r = nlmAskWithRetry(
        ["notebook", "query", nb.id, mergedPrompt, "--timeout", "120"],
        { timeoutMs: 130_000 }
      );

      if (r.ok) {
        const answer = r.data?.answer ?? r.data?.response ?? "";
        const references = resolveSourceIds(r.data?.references ?? r.data?.citations ?? r.data?.sources_used ?? [], cfg);
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
        const errBlob = (r.raw?.stdout || r.raw?.stderr || "查询失败").slice(0, 200);
        console.error(`查询 ${domain} chunk[${i}-${i + chunk.length - 1}] 失败: ${errBlob}`);
        for (const item of chunk) {
          results.push({
            case_id: item.case_id,
            answer: "",
            references: [],
            domain,
            notebook_id: nb.id,
            error: errBlob,
            attempts: r.attempts,
          });
        }
      }

      if (i + CHUNK_SIZE < domainItems.length) {
        spawnSync("sleep", ["2"]);
      }
    }

    if (Object.keys(grouped).length > 1) {
      spawnSync("sleep", ["2"]);
    }
  }

  out({ ok: true, results });
}

// ── op: add-domain ───────────────────────────────────────────────────

async function opAddDomain(domain, urlsFile) {
  if (!domain) fatal("--domain required");
  if (!isCliInstalled()) fatal("nlm 未安装 · 请先跑 /perf-kp-sql-setup");

  const urlsData = loadUrlsJson(urlsFile);
  const domainDef = urlsData.domains.find((d) => d.domain === domain);
  if (!domainDef) fatal(`领域 '${domain}' 在 urls.json 中不存在`);

  const cfg = loadConfig() || { notebooks: {}, version: "0.49.1", created_at: new Date().toISOString().slice(0, 10) };
  cfg.notebooks = cfg.notebooks || {};

  const { notebook_name } = domainDef;
  const urls = domainDef.urls || [];
  let notebookId = cfg.notebooks[domain]?.id;

  // 拉 notebook list 复用
  const listR = nlmJson(["notebook", "list"]);
  const allNotebooks = listR.ok
    ? (listR.data?.notebooks ?? (Array.isArray(listR.data) ? listR.data : []))
    : [];

  if (notebookId && !allNotebooks.some((nb) => nb.id === notebookId || nb.notebook_id === notebookId)) {
    notebookId = null;
  }
  if (!notebookId) {
    const existing = allNotebooks.find((nb) => nb.title === notebook_name);
    if (existing) notebookId = existing.id ?? existing.notebook_id;
  }
  if (!notebookId) {
    const createR = nlmExec(["notebook", "create", notebook_name], { timeoutMs: 60_000 });
    if (createR.status !== 0) fatal(`创建 notebook '${notebook_name}' 失败: ${(createR.stdout || createR.stderr).slice(0, 200)}`);
    const fallbackList = nlmJson(["notebook", "list"]);
    if (fallbackList.ok) {
      const nbs = fallbackList.data?.notebooks ?? (Array.isArray(fallbackList.data) ? fallbackList.data : []);
      const match = nbs.find((nb) => nb.title === notebook_name);
      if (match) notebookId = match.id ?? match.notebook_id;
    }
    if (!notebookId) fatal("无法获取 notebook id");
  }

  // 增量同步 · 合并 (a) 本地 cfg + (b) 远端 notebook 已有 source · 不重复加
  const remoteSrcR = nlmJson(["source", "list", notebookId]);
  const remoteSrcs = remoteSrcR.ok
    ? (Array.isArray(remoteSrcR.data) ? remoteSrcR.data : (remoteSrcR.data?.sources ?? []))
    : [];
  const remoteUrlToId = new Map();
  for (const s of remoteSrcs) {
    const u = s.url ?? s.source_url;
    const id = s.id ?? s.source_id;
    if (u && id) remoteUrlToId.set(u, id);
  }
  if (remoteUrlToId.size > 0) {
    console.error(`  远端 notebook 已有 ${remoteUrlToId.size} 个 source · 跳过重复添加`);
  }

  const cfgUrls = cfg.notebooks[domain]?.urls ?? [];
  const cfgUrlSet = new Set(cfgUrls.map((u) => u.url));
  const allExistingUrls = new Set([...cfgUrlSet, ...remoteUrlToId.keys()]);
  const plannedUrlSet = new Set(urls.map((u) => u.url));
  const toRemove = cfgUrls.filter((u) => !plannedUrlSet.has(u.url));
  const toAdd = urls.filter((u) => !allExistingUrls.has(u.url));

  for (const entry of toRemove) {
    if (entry.source_id) nlmExec(["source", "delete", entry.source_id], { timeoutMs: 30_000 });
  }

  // 远端已有的合并进 addedUrls(下次 setup 0 overhead)
  const addedUrls = [];
  for (const u of urls) {
    if (cfgUrlSet.has(u.url)) {
      const cfgEntry = cfgUrls.find((x) => x.url === u.url);
      addedUrls.push({ url: u.url, source_id: cfgEntry?.source_id ?? remoteUrlToId.get(u.url) ?? null });
    } else if (remoteUrlToId.has(u.url)) {
      addedUrls.push({ url: u.url, source_id: remoteUrlToId.get(u.url) });
    }
  }
  const urlResults = [];

  if (toAdd.length > 0) {
    console.error(`  并发添加 ${toAdd.length} 个 URL (每批 5 个 · --wait)...`);
    const addResults = await concurrentBatch(toAdd, 5, async (urlEntry) => {
      const r = await nlmExecAsync(
        ["source", "add", notebookId, "--url", urlEntry.url, "--wait"],
        { timeoutMs: 180_000 }
      );
      const ok = r.status === 0;
      const idMatch = r.stdout.match(/Source ID:\s*([\w-]+)/);
      const sourceId = ok ? (idMatch?.[1] ?? null) : null;
      const status = ok ? "PENDING" : "FAILED";
      return { url: urlEntry.url, source_id: sourceId, status, ok };
    });
    for (const ar of addResults) {
      addedUrls.push({ url: ar.url, source_id: ar.source_id });
      urlResults.push({ url: ar.url, source_id: ar.source_id, status: ar.status });
    }
  }

  // source list 兜底
  const sourceListR = nlmJson(["source", "list", notebookId]);
  if (sourceListR.ok) {
    const sources = Array.isArray(sourceListR.data) ? sourceListR.data : (sourceListR.data?.sources ?? []);
    for (const ur of urlResults) {
      const src = sources.find((s) => s.id === ur.source_id || s.source_id === ur.source_id || s.url === ur.url);
      if (src) {
        ur.status = src.status ?? "READY";
        if (!ur.source_id) ur.source_id = src.id ?? src.source_id;
      }
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

if (process.argv.slice(2).some((a) => a === "--help" || a === "-h")) {
  process.stdout.write(
    [
      "Usage: notebooklm.mjs --op <op> [options]",
      "",
      "perf-kp-sql NotebookLM 集成 adapter — 全部能力 spawn 上游 jacob-bd/notebooklm-mcp-cli",
      "",
      "Ops:",
      "  check                          检查 nlm 装/鉴权状态",
      "  refresh-auth                   触发重登(spawn nlm login · 隔离 Chrome 弹窗)",
      "  setup [--urls-file <path>]     uv tool install + nlm login + 创建 notebooks + 加 URL",
      "  disable [--reason <text>]      用户跳过 NLM · 0 依赖 · 走仅案例",
      "  query --domain <d> --query <q> [--json]      单条查询(d=os/mongo/kunpeng/auto)",
      "  query-batch --from-diagnose <p> | --from-bp-list <p> [--hw-arch <a>] [--json]",
      "                                  批量查询",
      "  add-domain --domain <d> --urls-file <path>   注册新 domain",
      "",
      "Options:",
      "  --json                         结构化 JSON stdout",
      "  --domain <d>                   os | mongo | kunpeng | auto",
      "  --query <q>                    查询字面值",
      "  --from-diagnose <path>         诊断 batch JSON",
      "  --from-bp-list <path>          BP 巡检 JSON 数组",
      "  --hw-arch <arch>               kunpeng | x86_64",
      "  --urls-file <path>             URL 列表",
      "  --reason <text>                disable 时的原因",
      "  -h, --help                     显示本帮助",
      "",
    ].join("\n"),
  );
  process.exit(0);
}

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
    reason: { type: "string" },
  },
});

(async () => {
  try {
    switch (values.op) {
      case "check":
        opCheck();
        break;
      case "refresh-auth":
        opRefreshAuth();
        break;
      case "setup":
        await opSetup(values["urls-file"]);
        break;
      case "disable":
        opDisable(values.reason);
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
        fatal(`未知 op: ${values.op}。支持: check | refresh-auth | setup | disable | query | query-batch | add-domain`);
    }
  } catch (e) {
    out({ ok: false, error: e instanceof Error ? e.message : String(e) });
    process.exit(1);
  }
})();
