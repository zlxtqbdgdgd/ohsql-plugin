// Phase 1 · M6 · NotebookLM 扩展查询 (路径 E · 不直接调 API · spawn notebooklm.mjs CLI)
//
// 同事文档约定 (docs/linear-wishing-trinket.md §8):
//   node scripts/notebooklm.mjs --op query-batch --from-diagnose <diagnose.json> [--hw-arch <X>] --json
//
// 返回:
//   { ok: true, results: [{ case_id, answer, references: [{ cited_text }], domain, notebook_id }] }
//
// 失败优雅降级:
//   - notebooklm.mjs 不存在 → 跳过 (M6 阶段同事尚未实装也允许)
//   - 认证过期 / 网络超时 → 跳过 + 打 warning
//   - 不阻塞主报告

import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CheckResult, DiagnoseResult } from "./types.js";

export interface NlmExpansion {
  answer: string;
  references?: Array<{ cited_text: string }>;
  domain?: string;
  notebook_id?: string;
}

export interface NlmResult {
  ok: boolean;
  expansions: Map<string, NlmExpansion>;
  reason?: string; // 失败原因
}

export interface NlmCallArgs {
  scriptPath: string; // notebooklm.mjs 路径
  diagnoseResult: DiagnoseResult;
  hwArch?: "kunpeng" | "x86_64";
  timeoutMs?: number;
}

export function callNotebookLm(args: NlmCallArgs): NlmResult {
  const { scriptPath, diagnoseResult, hwArch, timeoutMs = 60_000 } = args;

  // 先检查 notebooklm.mjs 是否存在
  if (!existsSync(scriptPath)) {
    return { ok: false, expansions: new Map(), reason: "notebooklm.mjs 未安装(由对接 NotebookLM 的同事维护 · 当前阶段可选)" };
  }

  // 仅对 critical/warning 命中跑 batch (path A/B/C · 不含 D rag_context)
  const targets: CheckResult[] = diagnoseResult.matched.filter((r) => r.path !== "D");
  if (targets.length === 0) {
    return { ok: true, expansions: new Map(), reason: "无 critical/warning 命中 · 跳过 NotebookLM" };
  }

  const tmpDir = mkdtempSync(join(tmpdir(), "diagnose-nlm-"));
  const inputFile = join(tmpDir, "diagnose-output.json");
  writeFileSync(inputFile, JSON.stringify({ matched: targets }));

  const spawnArgs = ["--op", "query-batch", "--from-diagnose", inputFile, "--json"];
  if (hwArch) spawnArgs.push("--hw-arch", hwArch);

  let result;
  try {
    result = spawnSync("node", [scriptPath, ...spawnArgs], {
      encoding: "utf8",
      timeout: timeoutMs,
    });
  } catch (e) {
    rmSync(tmpDir, { recursive: true, force: true });
    return { ok: false, expansions: new Map(), reason: `spawn 失败: ${e instanceof Error ? e.message : String(e)}` };
  }

  rmSync(tmpDir, { recursive: true, force: true });

  if (result.status !== 0) {
    return {
      ok: false,
      expansions: new Map(),
      reason: `notebooklm.mjs 退出码 ${result.status} · stderr: ${(result.stderr ?? "").slice(0, 300)}`,
    };
  }

  let parsed: { ok?: boolean; results?: Array<{ case_id: string } & NlmExpansion> };
  try {
    parsed = JSON.parse(result.stdout);
  } catch (e) {
    return { ok: false, expansions: new Map(), reason: `解析 stdout JSON 失败: ${e instanceof Error ? e.message : String(e)}` };
  }

  if (!parsed.ok) {
    return { ok: false, expansions: new Map(), reason: "notebooklm.mjs 返回 ok=false" };
  }

  const expansions = new Map<string, NlmExpansion>();
  for (const r of parsed.results ?? []) {
    expansions.set(r.case_id, {
      answer: r.answer,
      references: r.references,
      domain: r.domain,
      notebook_id: r.notebook_id,
    });
  }

  return { ok: true, expansions };
}
