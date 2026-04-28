# Phase 1 现场快照 fixture 索引

5 份典型故障场景 · 用于 M4-M7 测试 cli-diagnose 4 路径 (A/B/C/D) 覆盖。

每个 fixture 由两份文件组成:
- `snapshot.json`: 拟造的 mongo 现场快照 (metrics + config_dump + 可选 flamegraph_stacks)
- `expected.json`: 该 fixture 跑诊断时**应当命中**的 case_id 清单 + **应当不命中**的 case_id 清单(防 false positive)

## 概览

| Fixture | 场景 | 命中 BP (路径 A) | 命中 DF (路径 B) | 命中 Flame (路径 C) |
|---|---|---|---|---|
| fixture-01-numa-misconfig | NUMA 错配 (未走 numactl + zone_reclaim_mode=1) | 2 条 | 1 条 | 0 |
| fixture-02-swap-thp | swappiness=60 + THP=always | 2 条 | 1 条 | 0 |
| fixture-03-wt-cache-too-small | wiredTigerCacheSizeGB=0.25 (64GB RAM) | 1 条 | 1 条 | 1 条 |
| fixture-04-tcp-keepalive-cloud-lb | tcp_keepalive_time=7200 (云 LB 后) | 1 条 | 1 条 | 0 |
| fixture-05-conn-pool-too-small | driver maxPoolSize=40 vs 并发 200 | 1 条 | 1 条 | 0 |

## 命中的 case_id 清单 (来源真实 KB · 已逐条核验)

### fixture-01-numa-misconfig
- BP `linux-mm-numactl-interleave-all-mongod-startup-07` — NUMA 主机上 mongod 必须 numactl --interleave=all
- BP `linux-mm-vm-zone-reclaim-mode-disable-08` — vm.zone_reclaim_mode 必须 0
- DF `mongo-numa-cross-node-memory-degradation-04` — MongoDB 在 NUMA 硬件上跨节点访问导致间歇性慢

### fixture-02-swap-thp
- BP `linux-mm-vm-swappiness-1-or-0-mongo-host-05` — vm.swappiness 设 0/1
- BP `linux-thp-disabled-db-mem-fragmentation-bp-01` — 数据库场景关闭 THP
- DF `mongo-os-vm-swappiness-default-60-aggressive-swap-05` — vm.swappiness 默认 60 → 频繁 swap

### fixture-03-wt-cache-too-small
- BP `wt-cache-size-default-half-ram-minus-1g-01` — cacheSizeGB = max(0.5×(RAM-1GB), 0.256GB)
- DF `wt-eviction-trigger-app-thread-throttle-01` — cache 用量 ≈ 95% → app thread 被拉去做 eviction
- Flame `wt-app-thread-evict-assist-pressure-01` — pattern_regex `^__wt_cache_eviction_.*`

### fixture-04-tcp-keepalive-cloud-lb
- BP `os-net-tcp-keepalive-time-cloud-lb-120s-01` — 云 LB 后 tcp_keepalive_time=120
- DF `mongo-network-tcp-keepalive-too-long-cloud-lb-drops-02` — keepalive 大于 LB idle timeout → 连接静默切断

### fixture-05-conn-pool-too-small
- BP `mongo-driver-connection-pool-size-110-115pct-concurrent-03` — pool size = 110-115% × 并发请求数
- DF `mongo-driver-pool-size-too-small-vs-concurrent-requests-02` — maxPoolSize < 1.10×并发 → 池排队

## 用法

### 后续 M4 测试中的预期使用

```typescript
// 伪代码 · M4 实现 cli-diagnose 后
import { diagnose } from '../../src/cli/diagnose';
import { readFileSync } from 'node:fs';

const snap = JSON.parse(readFileSync('tests/fixtures/fixture-01-numa-misconfig/snapshot.json', 'utf8'));
const expected = JSON.parse(readFileSync('tests/fixtures/fixture-01-numa-misconfig/expected.json', 'utf8'));

const result = await diagnose(snap);
const hitIds = result.matched_cases.map(c => c.case_id);

for (const exp of expected.expected_hits) {
  expect(hitIds).toContain(exp.case_id);  // 必命中
}
for (const noHit of expected.expected_no_hits) {
  expect(hitIds).not.toContain(noHit);    // 不应命中
}
```

### 手工跑单 fixture

M4 落地后预期 cli 接口:
```bash
node dist/cli/diagnose.js \
  --snapshot tests/fixtures/fixture-01-numa-misconfig/snapshot.json \
  --output /tmp/diagnose-output.json
```
然后对照 `expected.json` 看命中清单是否一致。

## fixture 设计约定

1. **case_id 100% 真实存在** · 来自 `docs/data/distill-v2/kb-{best-practice,diagnostic-flow,flame-signature}.jsonl`
2. **现场值锐利** · 偏离推荐值的程度足够大 · 不靠边缘判断 (例: swappiness=60 而非 2)
3. **每个 fixture 至少 1 BP + 1 DF 命中** · 体现 cross-section 价值
4. **fixture-03 含路径 C 火焰图命中** · 验证 stack pattern_regex 匹配
5. **expected_no_hits 列 8-11 条** · 防止规则过广命中无关 case
6. **JSON 严格合法** · 可用 `node -e "JSON.parse(...)"` 验证
