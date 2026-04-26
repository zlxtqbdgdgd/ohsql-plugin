/**
 * shared/index — barrel for cross-engine checks + helpers.
 */

import type { CheckFn } from "../models.js";
import {
  arm64Checks,
  kunpengChecks,
  openeulerChecks,
  osChecks,
} from "./legacy-checks.js";

export { kunpengChecks, arm64Checks, openeulerChecks, osChecks };
export { toInt, toFloat, isDigitString } from "./utils.js";

/**
 * L1 + L2 合并 · 非 mongo engine(mysql/redis)也复用这两层规则。
 *
 * 顺序:kunpeng(vendor) → arm64(arch) → openeuler(os) → linux os(engine-aware)
 * 前三组都带 scope gating,不满足条件会用 infoResult 返回"已跳过",不污染结果。
 */
export const sharedChecks: ReadonlyArray<CheckFn> = [
  ...kunpengChecks,
  ...arm64Checks,
  ...openeulerChecks,
  ...osChecks,
];
