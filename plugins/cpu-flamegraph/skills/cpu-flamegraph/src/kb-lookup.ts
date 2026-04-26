/**
 * kb-lookup — 根据热点函数名 / 模块名查 KB seeds，返回权威解读
 *
 * **架构**：纯逻辑模块，无副作用（除 `loadKbSeeds` 同步读盘）。analyze.ts 在
 * 产出 hot_functions 后调 `lookupHotFunction()` 填 `HotFunction.rag_hits`。
 *
 * **两层 fallback**（与 perf-kp-sql 既有 query-kb 三层 fallback 中前两层对齐；
 * ancestor 层暂不做——cpu-flamegraph 目前没把 top-N 的祖先栈传到 lookup
 * 这里。后续若 analyze.ts 暴露 ancestor 信息，可在此补第三层）：
 *   1. function scope 的 regex 命中 fn 名 → 高置信
 *   2. function 全 miss → module scope 的 regex 命中 fn.module → 粗粒度
 *   3. 全 miss → []，render 走"模板 B 请独立验证"
 *
 * **零幻觉**：seeds 是手工 curated 的句末完整 snippet（≤ 300 字符，以
 * `。/!/?` 收尾），render 直接 inline，不做 slice，不让 LLM 复述。
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface KbFact {
  id: string;
  scope: "function" | "module";
  /** 编译为 RegExp 的正则字面量，用 RE2 兼容子集（^ $ ( ) | . * + ? \ \\ ） */
  regex: string;
  semantic_group: string;
  /** 句末完整 snippet（≤ 300 字符，以 `。/!/?` 收尾，不做截断）*/
  snippet: string;
  source_url: string;
  source_authority: "official" | "community";
}

export interface KbHit {
  semantic_group: string;
  snippet: string;
  source_url: string;
  source_authority: string;
  match_type: "function" | "module";
}

interface CompiledFact extends KbFact {
  compiled: RegExp;
}

/**
 * 从 `<dataDir>/<engine>-flame.json` 读 seeds。文件不存在 / engine 未识别 →
 * 返回 []（静默退化，调用方据此跳过 KB 解读段）。文件存在但 JSON 损坏 / 必
 * 填字段缺失 → 抛错（调用方的 try/catch 决定是降级还是 fail）。
 */
export function loadKbSeeds(engine: string, dataDir: string): CompiledFact[] {
  const path = join(dataDir, `${engine}-flame.json`);
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw new Error(`kb-lookup: failed to read ${path}: ${(e as Error).message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`kb-lookup: invalid JSON in ${path}: ${(e as Error).message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`kb-lookup: expected array in ${path}, got ${typeof parsed}`);
  }

  return parsed.map((f, i) => validateAndCompile(f, path, i));
}

function validateAndCompile(raw: unknown, path: string, idx: number): CompiledFact {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`kb-lookup: ${path}[${idx}] not an object`);
  }
  const f = raw as Record<string, unknown>;
  const need = ["id", "scope", "regex", "semantic_group", "snippet", "source_url", "source_authority"];
  for (const k of need) {
    if (typeof f[k] !== "string") {
      throw new Error(`kb-lookup: ${path}[${idx}].${k} missing or not string`);
    }
  }
  const scope = f["scope"];
  if (scope !== "function" && scope !== "module") {
    throw new Error(`kb-lookup: ${path}[${idx}].scope must be "function" or "module" (got: ${String(scope)})`);
  }
  const auth = f["source_authority"];
  if (auth !== "official" && auth !== "community") {
    throw new Error(`kb-lookup: ${path}[${idx}].source_authority must be "official" or "community" (got: ${String(auth)})`);
  }
  let compiled: RegExp;
  try {
    compiled = new RegExp(f["regex"] as string);
  } catch (e) {
    throw new Error(`kb-lookup: ${path}[${idx}].regex invalid: ${(e as Error).message}`);
  }
  return {
    id: f["id"] as string,
    scope: scope as "function" | "module",
    regex: f["regex"] as string,
    semantic_group: f["semantic_group"] as string,
    snippet: f["snippet"] as string,
    source_url: f["source_url"] as string,
    source_authority: auth as "official" | "community",
    compiled,
  };
}

/**
 * 对单个热点函数 (fn name + module) 查 KB，返回最多一条 hit。
 *
 * - 优先 function scope（正则匹配函数名）—— 高置信，写入 match_type="function"
 * - function 全 miss → 取 module scope 第一个匹配 fn.module 的 fact —— 粗粒度，
 *   写入 match_type="module"
 * - 全 miss → []
 *
 * 返回数组而非单值是为了对外保持"可扩展为 top-K"的灵活性；当前固定取 1。
 */
export function lookupHotFunction(fn: string, module: string, facts: CompiledFact[]): KbHit[] {
  // 1) function scope 优先
  for (const f of facts) {
    if (f.scope === "function" && f.compiled.test(fn)) {
      return [
        {
          semantic_group: f.semantic_group,
          snippet: f.snippet,
          source_url: f.source_url,
          source_authority: f.source_authority,
          match_type: "function",
        },
      ];
    }
  }
  // 2) module scope fallback
  for (const f of facts) {
    if (f.scope === "module" && f.compiled.test(module)) {
      return [
        {
          semantic_group: f.semantic_group,
          snippet: f.snippet,
          source_url: f.source_url,
          source_authority: f.source_authority,
          match_type: "module",
        },
      ];
    }
  }
  return [];
}
