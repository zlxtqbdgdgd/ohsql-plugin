/**
 * baseline-store — 持久化健康基线 · 给 rule-engine v3 的 baseline() 函数喂数据
 *
 * 文件: ~/.ohsql/perf-kp-sql/baselines/<hostname>.json
 *   形态: { "saved_at": ISO, "serverStatus.connections.current": 1023, ... }
 *
 * 设计:
 *   - 显式快照(用户/调用方决定何时 save) · 默认不污染历史
 *   - 抽 serverStatus 全部 numeric leaf (recursive flatten) · 报告里要的字段都自动覆盖
 *   - load 不存在 / 解析失败 → 静默返 null · cli-diagnose 走"无 baseline"模式
 *   - hostname 用 hostInfo.system.hostname (跨重启稳定) · 缺失退回 host param
 *
 * 调用约定:
 *   - cli-diagnose 启动: tryLoadBaseline(hostname) → 注 ctx.db_metrics.baseline
 *   - cli-diagnose --save-baseline: snapshotFromServerStatus(ss) + saveBaseline(hostname, snap)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export const BASELINE_DIR = join(homedir(), ".ohsql", "perf-kp-sql", "baselines");

export interface BaselineSnapshot {
  saved_at: string;            // ISO timestamp
  hostname?: string;
  [path: string]: number | string | undefined;  // numeric leaves keyed by serverStatus.* path
}

export function baselinePath(hostname: string): string {
  // 安全 · hostname 只允许 [\w.-]
  const safe = hostname.replace(/[^\w.-]/g, "_");
  return join(BASELINE_DIR, `${safe}.json`);
}

/** 从已加载的 serverStatus 抽所有 numeric leaf · 形成 { "serverStatus.x.y": n } map */
export function snapshotFromServerStatus(serverStatus: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!serverStatus || typeof serverStatus !== "object") return out;
  flattenNumericLeaves(serverStatus as Record<string, unknown>, "serverStatus", out);
  return out;
}

function flattenNumericLeaves(
  obj: Record<string, unknown>,
  prefix: string,
  out: Record<string, number>,
): void {
  for (const [k, v] of Object.entries(obj)) {
    // 路径里出现空格 / 特殊字符 → 用 ['key'] 形式 · 跟 resolveField 兼容
    const safeK = /^[A-Za-z_][\w]*$/.test(k) ? `.${k}` : `['${k.replace(/'/g, "\\'")}']`;
    const path = `${prefix}${safeK}`;
    if (typeof v === "number" && Number.isFinite(v)) {
      out[path] = v;
    } else if (typeof v === "boolean") {
      out[path] = v ? 1 : 0;
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      flattenNumericLeaves(v as Record<string, unknown>, path, out);
    }
    // string / array / null / undefined 跳过
  }
}

export function saveBaseline(
  hostname: string,
  snapshot: Record<string, number>,
): string {
  if (!existsSync(BASELINE_DIR)) mkdirSync(BASELINE_DIR, { recursive: true });
  const payload: BaselineSnapshot = {
    saved_at: new Date().toISOString(),
    hostname,
    ...snapshot,
  };
  const path = baselinePath(hostname);
  writeFileSync(path, JSON.stringify(payload, null, 2));
  return path;
}

/**
 * 加载 baseline · 失败/不存在返 null
 * 返回纯 numeric map (剥掉 saved_at / hostname meta)
 */
export function tryLoadBaseline(hostname: string): Record<string, number> | null {
  const path = baselinePath(hostname);
  if (!existsSync(path)) return null;
  try {
    const obj = JSON.parse(readFileSync(path, "utf8")) as BaselineSnapshot;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === "saved_at" || k === "hostname") continue;
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    }
    return out;
  } catch {
    return null;
  }
}
