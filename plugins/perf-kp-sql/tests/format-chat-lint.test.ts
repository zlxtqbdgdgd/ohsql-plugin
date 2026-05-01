import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lintReport, rewrapTable } from "../scripts/format-chat.mjs";

const FULL_REPORT_OK = `# perf-kp-sql · 性能诊断报告

- 诊断时间:2026-05-01 10:00
- 目标主机:10.0.0.1 · root · port=22 · engine=mongo

## 来源标记 (debug)

| 标记 | 含义 |
|---|---|
| \`[IDX]\` | cases/INDEX.md |
| \`[KB]\`  | cases/KB.md |

## 诊断结果

| 确认的根因 | 判定依据 | 建议措施 | 风险等级 | 置信度 | 参考来源 |
|---|---|---|---|---|---|
| WT eviction [KB] | cache=94.7% [OBS] | 调 target=3% [LLM] | high [LLM] | 高 [LLM] | [参考1] |

## 参考

[参考1] WiredTiger Tuning — source.wiredtiger.com [KB]
        https://source.wiredtiger.com/mongodb-6.0/tune_cache.html
`;

const FULL_REPORT_MISSING = `# perf-kp-sql · 性能诊断报告

## 诊断结果

| 确认的根因 | 判定依据 | 建议措施 | 风险等级 | 置信度 | 参考来源 |
|---|---|---|---|---|---|
| WT eviction | cache=94.7% | 调 target=3% | high | 高 | [参考1] |
`;

describe("lintReport", () => {
  it("空文档 → 0 atoms / 0 missing / missRate=0", () => {
    const r = lintReport("");
    assert.equal(r.total, 0);
    assert.equal(r.missing.length, 0);
    assert.equal(r.missRate, 0);
  });

  it("全 5 标签报告 → missRate=0", () => {
    const r = lintReport(FULL_REPORT_OK);
    assert.equal(r.missRate, 0);
  });

  it("整张表全漏 → 每个 cell 都被记为 missing", () => {
    const r = lintReport(FULL_REPORT_MISSING);
    assert.ok(r.total >= 5, `expected ≥ 5 atoms, got ${r.total}`);
    assert.ok(r.missing.length >= 5, `expected ≥ 5 missing, got ${r.missing.length}`);
    assert.ok(r.missRate > 0.5);
  });

  it("legend 段 lint 豁免", () => {
    const md = `# title

## 来源标记 (debug)

| 标记 | 含义 |
|---|---|
| \`[IDX]\` | cases/INDEX.md |
| \`[KB]\`  | cases/KB.md(无标签 不该报错) |

## 诊断结果

| a | b | c | d | e | f |
|---|---|---|---|---|---|
| 事实 [OBS] | 事实 [OBS] | 事实 [OBS] | 事实 [OBS] | 事实 [OBS] | [参考1] |
`;
    const r = lintReport(md);
    assert.equal(r.missRate, 0);
  });

  it("参考段 lint 豁免", () => {
    const md = `# title

## 诊断结果

| a | b | c | d | e | f |
|---|---|---|---|---|---|
| 事实 [OBS] | 事实 [OBS] | 事实 [OBS] | 事实 [OBS] | 事实 [OBS] | [参考1] |

## 参考

[参考1] 标题 — domain (这里没标签 不该报错)
        https://example.com
`;
    const r = lintReport(md);
    assert.equal(r.missRate, 0);
  });

  it("code fence 内容 lint 豁免", () => {
    const md = `# title

## 诊断结果

| a | b | c | d | e | f |
|---|---|---|---|---|---|
| 事实 [OBS] | 事实 [OBS] | 事实 [OBS] | 事实 [OBS] | 事实 [OBS] | [参考1] |

## 火焰图分析

\`\`\`
random text without tags
more lines without tags
\`\`\`
`;
    const r = lintReport(md);
    assert.equal(r.missRate, 0);
  });

  it("blockquote 行豁免", () => {
    const md = `# title

## 现场观测

> 以下根因未经权威背书 · 仅供参考:

- 事实 1 [OBS]
`;
    const r = lintReport(md);
    assert.equal(r.missRate, 0);
  });

  it("表格 cell 中 ` · ` 分隔的 sub-atom 各自检查", () => {
    const md = `# title

## 诊断结果

| a | b | c | d | e | f |
|---|---|---|---|---|---|
| cache=94% [OBS] · 阈=95% [KB] | 事实 [OBS] | 事实 [OBS] | 事实 [OBS] | 事实 [OBS] | [参考1] |
`;
    const r = lintReport(md);
    assert.equal(r.missRate, 0);
  });

  it("表格 cell 中 ` · ` 分隔的某个 sub-atom 漏标 → 计入 missing", () => {
    const md = `# title

## 诊断结果

| a | b | c | d | e | f |
|---|---|---|---|---|---|
| cache=94% · 阈=95% [KB] | 事实 [OBS] | 事实 [OBS] | 事实 [OBS] | 事实 [OBS] | [参考1] |
`;
    const r = lintReport(md);
    assert.ok(r.missing.length >= 1);
    assert.ok(r.missing[0].text.includes("cache=94%"));
  });

  it("missing 列表给出 line 号 + 文本片段", () => {
    const r = lintReport(FULL_REPORT_MISSING);
    assert.ok(r.missing[0].line > 0);
    assert.ok(typeof r.missing[0].text === "string");
    assert.ok(r.missing[0].text.length > 0);
  });

  it("[OBS][参考3] 紧挨写法被识别为已挂标签", () => {
    const md = `# title

## 诊断结果

| a | b | c | d | e | f |
|---|---|---|---|---|---|
| cache=94% [OBS][参考3] | 事实 [OBS] | 事实 [OBS] | 事实 [OBS] | 事实 [OBS] | [参考1] |
`;
    const r = lintReport(md);
    assert.equal(r.missRate, 0);
  });

  it("[OBS] [参考3] 中间空格写法被识别为已挂标签", () => {
    const md = `# title

## 诊断结果

| a | b | c | d | e | f |
|---|---|---|---|---|---|
| cache=94% [OBS] [参考3] | 事实 [OBS] | 事实 [OBS] | 事实 [OBS] | 事实 [OBS] | [参考1] |
`;
    const r = lintReport(md);
    assert.equal(r.missRate, 0);
  });
});

describe("rewrapTable", () => {
  it("没有 ## 诊断结果 表 → 返回 { found: false } 不抛异常", () => {
    const md = `# 报告\n\n这里没有诊断结果表。\n`;
    const r = rewrapTable(md, 100);
    assert.equal(r.found, false);
    assert.equal(r.content, md); // 返回原文不变
  });
});
