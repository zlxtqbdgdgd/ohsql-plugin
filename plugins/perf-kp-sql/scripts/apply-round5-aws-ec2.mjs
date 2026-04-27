#!/usr/bin/env node
/**
 * apply-round5 · 删除 2 条 AWS EC2 规则(不适用鲲鹏部署)
 *   - mongo-2-ec2-enhanced-networking · AWS EC2 SR-IOV
 *   - mongo-2-ec2-use-provisioned-iops · AWS EC2 IOPS
 *
 * 完事 0 AWS · 100% audit.pass
 */

import { readFileSync, writeFileSync } from "node:fs";

const path = "skills/perf-kp-sql/data/mongo/rules.json";
const rules = JSON.parse(readFileSync(path, "utf8"));
const before = rules.length;
const kept = rules.filter(r =>
  !r.source?.url?.includes("aws.amazon") &&
  !r.source?.url?.includes("aws--amazon-web-services") &&
  r.id !== "mongo-2-ec2-enhanced-networking" &&
  r.id !== "mongo-2-ec2-use-provisioned-iops"
);
writeFileSync(path, JSON.stringify(kept, null, 2) + "\n");
console.log(`mongo/rules.json: ${before} → ${kept.length} (deleted ${before - kept.length} AWS EC2 rules)`);

// 验证
const allRules = [
  ...JSON.parse(readFileSync("skills/perf-kp-sql/data/mongo/rules.json", "utf8")),
  ...JSON.parse(readFileSync("skills/perf-kp-sql/data/common/kunpeng-rules.json", "utf8")),
];
const aws = allRules.filter(r => r.source?.url?.includes("aws") || r.source?.title?.includes("Graviton"));
const pass = allRules.filter(r => r.audit?.pass).length;
console.log(`\n终态:`);
console.log(`  rules total: ${allRules.length}`);
console.log(`  audit.pass=true: ${pass} (${(pass / allRules.length * 100).toFixed(1)}%)`);
console.log(`  AWS-cited: ${aws.length}`);
