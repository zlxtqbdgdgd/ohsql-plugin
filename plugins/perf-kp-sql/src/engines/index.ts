/**
 * engines/index — per-engine modules.
 *
 * Phase 1 重构(M2):mongo/checks.ts 已删除 · CheckFn / engineChecks 体系已废弃 ·
 * 新 KB 走 distill-v2 case 体系(M3-M4 重写)。
 * 这里只保留 collector 的 buildMongoContext re-export。
 */

import type { EngineName } from "../models.js";
import { buildContext as buildMongoContext } from "./mongo/collector.js";

export { buildMongoContext };
export type { EngineName };
