/**
 * shared/index — barrel for shared helpers.
 *
 * Phase 1 重构(M2):legacy-checks.ts 已删除 · CheckFn 体系已废弃 ·
 * 新案例库走 distill-v2 case 体系(M3-M4 重写 cli-diagnose / cli-cases)。
 * 这里只保留 utils 的 re-export · 让其它仍在过渡的模块编译通过。
 */

export { toInt, toFloat, isDigitString } from "./utils.js";
