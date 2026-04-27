/**
 * engines/index — per-engine modules + registry.
 *
 * 第一期 mongo only。
 */

import type { CheckFn, EngineName } from "../models.js";
import { mongoChecks } from "./mongo/checks.js";
import { buildContext as buildMongoContext } from "./mongo/collector.js";

export { mongoChecks, buildMongoContext };
export type { EngineName };

export const engineChecks: Record<EngineName, ReadonlyArray<CheckFn>> = {
  mongo: mongoChecks,
};
