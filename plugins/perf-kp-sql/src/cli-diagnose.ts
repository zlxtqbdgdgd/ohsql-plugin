/**
 * cli-diagnose — perf-kp-sql skill 本地分析入口。
 *
 * Phase 1 重构(M2):老 CheckFn / rule-engine.ts / legacy-checks.ts 已删除 ·
 * 新 KB 走 distill-v2 case 体系 · 由 M3-M4 阶段重写本入口。
 *
 * 当前状态:
 *   - typecheck 通过(本文件不再 import 已删模块)
 *   - 运行时显式抛错 · 阻止误调
 */

function main(): never {
  const msg =
    "cli-diagnose 暂不可用:Phase 1 重构进行中 · M3-M4 阶段会按 distill-v2 case 体系重写。";
  process.stdout.write(JSON.stringify({ ok: false, error: msg }));
  process.exit(1);
}

main();
