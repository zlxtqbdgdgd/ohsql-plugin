/**
 * engines/index — per-engine modules + registry.
 *
 * 新 engine 加进来只改这里一处(和对应 engines/<name>/ 目录)。
 */

import type { CheckFn, EngineName } from "../models.js";
import { mongoChecks } from "./mongo/checks.js";
import { buildContext as buildMongoContext } from "./mongo/collector.js";
import { mysqlChecks } from "./mysql/checks.js";
import { parseMysqlStdout } from "./mysql/collector.js";
import { redisChecks } from "./redis/checks.js";
import { parseRedisStdout } from "./redis/collector.js";

export { mongoChecks, buildMongoContext };
export { mysqlChecks, parseMysqlStdout };
export { redisChecks, parseRedisStdout };
export type { EngineName };

/** 每个 engine 的 check 集合(只含该 engine 自己的规则,不含 shared)。 */
export const engineChecks: Record<EngineName, ReadonlyArray<CheckFn>> = {
  mongo: mongoChecks,
  mysql: mysqlChecks,
  redis: redisChecks,
};
