#!/usr/bin/env node
// esbuild bundle src/*.ts → scripts/*.mjs
//
// 用法:
//   node plugins/perf-kp-sql/scripts/_build.mjs

import { build } from "esbuild";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(HERE, "..");

const banner = `#!/usr/bin/env node
import { createRequire } from "module";
import { fileURLToPath as __fileURLToPath } from "url";
import { dirname as __pathDirname } from "path";
const require = createRequire(import.meta.url);`;

const targets = [
  { in: "src/cli-ssh.ts", out: "scripts/ssh.mjs" },
  { in: "src/cli-history.ts", out: "scripts/history.mjs" },
];

const external = [
  "js-yaml",
];

for (const t of targets) {
  await build({
    entryPoints: [resolve(PLUGIN_ROOT, t.in)],
    outfile: resolve(PLUGIN_ROOT, t.out),
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node18",
    banner: { js: banner },
    external,
    logLevel: "info",
  });
  console.log(`✓ ${t.in} → ${t.out}`);
}
