/**
 * perf-kp-sql collectors —— OS 批量 + DB 批量命令生成和 stdout 解析。
 *
* SSH 走 kernel 的 SshExec Tool；本模块只负责：
 *   - 生成要发送给 SshExec 的命令字符串（OS_BATCH_CMD、buildDbBatchCmd）
 *   - 解析 SshExec 返回的 stdout（parseOsBatch、parseDbBatch）
 * 不再做 SSH 连接。
 *
 * OS 批量命令字符串与 Python 版逐字一致（同样的 ###标签###/awk 解析）。
 */

import type { DiagContext } from "../../models.js";
import { parseOsBatch, parseIntOr, getSection } from "../../shared/utils.js";

// ---------------------------------------------------------------------------
// 命令模板
// ---------------------------------------------------------------------------

const OS_BATCH_CMD = [
  "echo '###THP###'",
  "cat /sys/kernel/mm/transparent_hugepage/enabled 2>/dev/null || echo unknown",
  "echo '###NUMA_NODES###'",
  "ls -d /sys/devices/system/node/node* 2>/dev/null | wc -l",
  "echo '###NUMA_BAL###'",
  "cat /proc/sys/kernel/numa_balancing 2>/dev/null || echo 0",
  "echo '###HUGEPAGES###'",
  "cat /proc/sys/vm/nr_hugepages 2>/dev/null || echo 0",
  "echo '###MEM###'",
  "awk '/MemTotal/{print int($2/1024)}' /proc/meminfo",
  "echo '###IOSCHED###'",
  "cat /sys/block/{vda,sda,nvme0n1}/queue/scheduler 2>/dev/null | head -n 1 || echo none",
  "echo '###SWAP###'",
  "cat /proc/sys/vm/swappiness 2>/dev/null || echo -1",
  "echo '###ARCH###'",
  "uname -m",
  "echo '###IOSTAT###'",
  "iostat -xdm 1 2 2>/dev/null | tail -n +4 | head -20 || echo 'N/A'",
  "echo '###DISKUSAGE###'",
  "df -h / | awk 'NR==2{print $5}' | tr -d '%' || echo 0",
  "echo '###TCPRETRANS###'",
  `cat /proc/net/snmp 2>/dev/null | awk '/Tcp:/{if(NR%2==0){retrans=$13; segs=$12; if(segs>0) printf "%.4f", retrans/segs*100; else print 0}}' || echo 0`,
  "echo '###CPUGOV###'",
  "cat /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor 2>/dev/null | sort -u | tr '\\n' ',' | sed 's/,$//' || echo SKIP",
  "echo '###SOMAXCONN###'",
  "sysctl -n net.core.somaxconn 2>/dev/null || echo 0",
  "echo '###TCPKEEPALIVE###'",
  "sysctl -n net.ipv4.tcp_keepalive_time 2>/dev/null || echo 0",
  "echo '###TCPKEEPALIVEINTVL###'",
  "sysctl -n net.ipv4.tcp_keepalive_intvl 2>/dev/null || echo 0",
  "echo '###DIRTYRATIO###'",
  "sysctl -n vm.dirty_ratio 2>/dev/null || echo 0",
  "echo '###DIRTYBGRATIO###'",
  "sysctl -n vm.dirty_background_ratio 2>/dev/null || echo 0",
  // ── 鲲鹏 L1 平台层专用 ──
  "echo '###SMT###'",
  "lscpu 2>/dev/null | awk -F: '/^Thread\\(s\\) per core/{gsub(/ /,\"\",$2); print $2}' || echo 0",
  "echo '###IRQBALANCE###'",
  "systemctl is-active irqbalance 2>/dev/null || echo unknown",
  // ── 环境识别（meta，不是独立 check，但影响 K-* 条件检查是否执行）──
  "echo '###VIRT###'",
  "systemd-detect-virt 2>/dev/null || echo unknown",
  "echo '###SYSVENDOR###'",
  "cat /sys/class/dmi/id/sys_vendor 2>/dev/null || echo unknown",
  "echo '###PRODUCT###'",
  "cat /sys/class/dmi/id/product_name 2>/dev/null || echo unknown",
  "echo '###DISCOVERY###'",
  // mongod 进程 + 端口 + bind IP 自发现
  `PID=$(pgrep -o mongod 2>/dev/null); ` +
    `if [ -z "$PID" ]; then PID=$(ps aux | awk '/[m]ongod/{print $2}' | head -1); fi; ` +
    `if [ -n "$PID" ]; then ` +
    `  LISTEN_LINE=$(ss -lntp 2>/dev/null | grep "pid=$PID" | head -1); ` +
    `  PORT=$(echo "$LISTEN_LINE" | awk '{print $4}' | grep -oE '[0-9]+$' | head -1); ` +
    `  BIND=$(echo "$LISTEN_LINE" | awk '{print $4}' | sed 's/:.*//'); ` +
    `  if [ "$BIND" = "*" ] || [ "$BIND" = "0.0.0.0" ] || [ "$BIND" = "::" ]; then BIND="127.0.0.1"; fi; ` +
    `  if [ -z "$BIND" ]; then BIND="127.0.0.1"; fi; ` +
    `  echo "PID=$PID PORT=\${PORT:-27017} BIND=$BIND"; ` +
    `else ` +
    `  PORT_LINE=$(ss -lntp 2>/dev/null | grep -E ':2701[0-9]\\b' | head -1); ` +
    `  if [ -n "$PORT_LINE" ]; then ` +
    `    BIND=$(echo "$PORT_LINE" | awk '{print $4}' | sed 's/:.*//'); ` +
    `    if [ "$BIND" = "*" ] || [ "$BIND" = "0.0.0.0" ] || [ "$BIND" = "::" ]; then BIND="127.0.0.1"; fi; ` +
    `    echo "PID=unknown PORT=$(echo $PORT_LINE | awk '{print $4}' | grep -oE '[0-9]+$') BIND=$BIND"; ` +
    `  else echo "PID= PORT= BIND=127.0.0.1"; fi; ` +
    `fi`,
].join("; ");
// v0.4.3 · 原 join(" && ") 改 join("; ")
// 原因:KVM 虚拟机没 /sys/devices/system/cpu/cpu*/cpufreq/ · bash glob 不匹配
// 导致 CPUGOV 段 cat 退码异常 · && 链断 · 后续 11 段全丢(含关键的 DISCOVERY)
// 用 "; " 每条独立执行 · 某条失败只丢那一段 · 不拖累后面。
// 每条命令内部 `|| echo <fallback>` 仍保留兜底值。

function buildDbBatchCmd(host: string, port: string): string {
  // mongosh 单次调用，输出一段 JSON
  return (
    `mongosh --host ${shellEscape(host)} --port ${shellEscape(port)} --quiet --eval ` +
    shellEscape(
    "var ss = db.serverStatus(); " +
    "var co = db.currentOp(); " +
    "var oplog = null; " +
    'try { var local = db.getSiblingDB("local"); ' +
    "  var ol = local.oplog.rs.find().sort({$natural:-1}).limit(1).next(); " +
    "  var of = local.oplog.rs.find().sort({$natural:1}).limit(1).next(); " +
    "  if(ol && of) { oplog = {last: ol.ts, first: of.ts, " +
    "    windowHours: (ol.ts.getTime() - of.ts.getTime()) / 3600}; } " +
    "} catch(e) {} " +
    'var blockCompressor = ""; ' +
    "try { " +
    "  var opts = db.adminCommand({getCmdLineOpts: 1}); " +
    "  var sc = (opts.parsed || {}).storage || {}; " +
    "  var wt = sc.wiredTiger || {}; " +
    '  blockCompressor = ((wt.collectionConfig || {}).blockCompressor) || ""; ' +
    "  if (!blockCompressor) { " +
    "    var rc = db.adminCommand({getParameter: 1, wiredTigerEngineRuntimeConfig: 1}); " +
    '    var cfg = rc.wiredTigerEngineRuntimeConfig || ""; ' +
    "    var m = cfg.match(/block_compressor=([\\w]+)/); " +
    "    if (m) blockCompressor = m[1]; " +
    "  } " +
    "} catch(e) {} " +
    "print(JSON.stringify({serverStatus: ss, currentOp: co, oplog: oplog, blockCompressor: blockCompressor}))",
    )
  );
}

// ---------------------------------------------------------------------------
// 主入口
// ---------------------------------------------------------------------------

/**
 * 解析已经通过 SshExec 拿到的 OS 批量 stdout + DB 批量 stdout，拼成 DiagContext。
 *
 * 调用方（skill 的 cli-diagnose.ts）先调 SshExec 跑 OS_BATCH_CMD，
 * 解析 DISCOVERY 段拿到 mongoBind/Port，再调 SshExec 跑 buildDbBatchCmd(bind, port)，
 * 最后把两段 stdout 喂给本函数。
 */
export function buildContext(
  osStdout: string,
  dbStdout: string,
  dbStderr = "",
  dbExitCode: number | null = 0,
): { context: DiagContext; discovered: { port: string; bind: string; pid?: string } } {
  const os_metrics: Record<string, unknown> = {};
  const db_metrics: Record<string, unknown> = {};
  let mongoPort = "27017";
  let mongoBind = "127.0.0.1";
  let pid: string | undefined;

  if (osStdout) {
    parseOsBatch(osStdout, os_metrics);
    const disc = getSection(osStdout.split("###"), "DISCOVERY");
    if (disc) {
      for (const part of disc.split(/\s+/)) {
        if (part.startsWith("PORT=") && /^\d+$/.test(part.slice(5))) mongoPort = part.slice(5);
        if (part.startsWith("BIND=") && part.slice(5)) mongoBind = part.slice(5);
      }
      db_metrics["_discovered_port"] = mongoPort;
      db_metrics["_discovered_bind"] = mongoBind;
      const pidPart = disc.split(/\s+/).find((p: string) => p.startsWith("PID="));
      if (pidPart && pidPart.slice(4)) {
        pid = pidPart.slice(4);
        db_metrics["_discovered_pid"] = pid;
      }
    }
  }

  parseDbBatch({ stdout: dbStdout, stderr: dbStderr, exitCode: dbExitCode }, db_metrics);

  return {
    context: { os_metrics, db_metrics, db_type: "mongo" },
    discovered: { port: mongoPort, bind: mongoBind, pid },
  };
}

/** 导出静态命令给 SKILL.md 的 collect-cmds.json 使用 */
export { OS_BATCH_CMD, buildDbBatchCmd };

function coerceEjsonNumbers(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(coerceEjsonNumbers);
  const o = v as Record<string, unknown>;
  // 形态 A：EJSON number wrappers
  if (typeof o["$numberLong"] === "string") {
    const n = Number(o["$numberLong"]);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof o["$numberInt"] === "string") {
    const n = Number(o["$numberInt"]);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof o["$numberDouble"] === "string") {
    const n = Number(o["$numberDouble"]);
    return Number.isFinite(n) ? n : 0;
  }
  // 形态 B：BSON Long 原生 {high, low, unsigned}
  // 关键识别特征：恰好三个字段，且类型匹配
  if (
    typeof o["high"] === "number" &&
    typeof o["low"] === "number" &&
    typeof o["unsigned"] === "boolean" &&
    Object.keys(o).length === 3
  ) {
    const high = o["high"];
    const low = o["low"];
    // 公式：high * 2^32 + (low 视为无符号 32 位)
    // JS 数字精度 2^53，只要 |value| < 2^53 就精确（我们的 cache 大小、计数都够）
    const n = high * 0x100000000 + (low >>> 0);
    return Number.isFinite(n) ? n : 0;
  }
  // 递归子字段（普通对象）
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(o)) out[k] = coerceEjsonNumbers(val);
  return out;
}

export interface DbBatchResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  err?: string;
}

function parseDbBatch(res: DbBatchResult, out: Record<string, unknown>): void {
  if (res.err) {
    out["_db_collection_failed"] = true;
    out["_db_collection_error"] = res.err;
    return;
  }
  const txt = res.stdout.trim();
  if (!txt) {
    out["_db_collection_failed"] = true;
    out["_db_collection_error"] = "mongosh 返回空输出";
    return;
  }
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(extractJsonObject(txt)) as Record<string, unknown>;
  } catch {
    out["_db_collection_failed"] = true;
    out["_db_collection_error"] = "mongosh 返回非 JSON 格式";
    return;
  }
  // 统一抹平 EJSON 数字对象（Long/Int/Double → number）
  raw = coerceEjsonNumbers(raw) as Record<string, unknown>;

  const ss = (raw["serverStatus"] ?? {}) as Record<string, unknown>;

  // 把 ss 的顶层字段都拷过去（包含 connections / wiredTiger / 等）
  for (const [k, v] of Object.entries(ss)) {
    out[k] = v;
  }
  out["_db_collection_failed"] = false;

  const wt = (((ss["wiredTiger"] ?? {}) as Record<string, unknown>)["cache"] ??
    {}) as Record<string, unknown>;
  if (Object.keys(wt).length > 0) {
    out["_wt_cache_detail"] = wt;
    out["wt_cache_maximum_bytes"] = wt["maximum bytes configured"] ?? 0;
  }

  // currentOp 解析
  const co = (raw["currentOp"] ?? {}) as Record<string, unknown>;
  const inprog = (co["inprog"] ?? []) as Array<Record<string, unknown>>;
  const activeOps = inprog.filter((op) => op["active"]);
  const getSec = (op: Record<string, unknown>): number => {
    const v = op["secs_running"];
    if (v && typeof v === "object") {
      const vo = v as Record<string, unknown>;
      return parseIntOr(String(vo["$numberLong"] ?? vo["$numberInt"] ?? 0), 0);
    }
    if (typeof v === "number") return Math.trunc(v);
    if (typeof v === "string" && /^\d+$/.test(v)) return parseInt(v, 10);
    return 0;
  };
  const slowOps = activeOps.filter((op) => getSec(op) > 3);
  out["currentOp"] = {
    active_count: activeOps.length,
    slow_count: slowOps.length,
    top_slow_secs:
      slowOps.length > 0 ? Math.max(...slowOps.map((op) => getSec(op))) : 0,
  };

  // Oplog 窗口
  const oplog = raw["oplog"];
  if (oplog && typeof oplog === "object") {
    const w = (oplog as Record<string, unknown>)["windowHours"];
    const wn = typeof w === "number" ? w : parseFloat(String(w));
    out["_oplog_window_hours"] = Number.isFinite(wn) ? wn : -1;
  }

  // block_compressor
  const bc = raw["blockCompressor"];
  if (typeof bc === "string" && bc) out["_wt_block_compressor"] = bc;
}

function extractJsonObject(stdout: string): string {
  // No fast-path: always run the scanner. A fast-path checking
  // startsWith("{")/endsWith("}") would false-positive on multi-object
  // stdout like "{...}\n{...}" and break JSON.parse.
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  let lastObject = "";
  for (let i = 0; i < stdout.length; i++) {
    const ch = stdout[i]!;
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }
    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
      continue;
    }
    if (ch === "}") {
      if (depth === 0) continue;
      depth--;
      if (depth === 0 && start >= 0) {
        lastObject = stdout.slice(start, i + 1);
        start = -1;
      }
    }
  }

  if (!lastObject) {
    throw new Error("no JSON object found");
  }
  return lastObject;
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export const __perfKpSqlCollectorTestables = {
  buildDbBatchCmd,
  coerceEjsonNumbers,
  extractJsonObject,
};
