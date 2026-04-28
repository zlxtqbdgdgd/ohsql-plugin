/**
 * cli-kb — KB 操作入口 (Phase 1 重写中 · M3 阶段)
 *
 * 当前阶段 export:
 *   - buildKb: 从 distill-v2/cases/<...>/*.md 入新 sqlite KB (cases 表 + 子表)
 *   - 类型 BuildKbResult / BuildKbError
 *   - SCHEMA_SQL / FTS_SCHEMA_SQL / VEC_SCHEMA_SQL (供 tests / 其他工具用)
 *   - embed (transformers 384 dim feature extraction)
 *
 * M4 阶段会重新加回 queryKb / openKb / flameMatch 等(走新 cases 表 + sqlite-vec + FTS5)。
 */

export { buildKb } from "./cli-kb/build.js";
export type {
  BuildKbArgs,
  BuildKbResult,
  BuildKbError,
  BuildKbErrorKind,
} from "./cli-kb/build.js";

export {
  SCHEMA_SQL,
  FTS_SCHEMA_SQL,
  VEC_SCHEMA_SQL,
  SCHEMA_VERSION,
} from "./cli-kb/schema.js";

export { embed, embeddingToBlob } from "./cli-kb/embed.js";

// CLI 入口 (esbuild bundle 到 scripts/kb.mjs · SKILL 调用):
//   node scripts/kb.mjs build --from <distill-v2/cases> --out <data/knowledge.sqlite>
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { resolve } from "node:path";

async function runCli(): Promise<void> {
  const { values, positionals } = parseArgs({
    options: {
      from: { type: "string" },
      out: { type: "string" },
      modelDir: { type: "string" },
    },
    allowPositionals: true,
  });

  const op = positionals[0];
  if (op === "build") {
    const casesRoot = values.from ?? "";
    const out = values.out ?? "";
    if (!casesRoot || !out) {
      console.error("Usage: kb.mjs build --from <distill-v2/cases> --out <out.sqlite>");
      process.exit(2);
    }
    const { buildKb } = await import("./cli-kb/build.js");
    const result = await buildKb({
      casesRoot: resolve(casesRoot),
      out: resolve(out),
      modelDir: values.modelDir,
    });
    console.log(JSON.stringify(result, null, 2));
    if (result.errors.length > 0) process.exit(1);
    return;
  }

  console.error(`unknown op: ${op ?? "(none)"} · 当前只支持 'build'`);
  process.exit(2);
}

// 直接运行检测 (兼容 ts 直跑 + esbuild bundle 后 .mjs)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runCli();
}
