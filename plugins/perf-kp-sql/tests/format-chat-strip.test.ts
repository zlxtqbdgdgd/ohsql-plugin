import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { stripChatTags } from "../scripts/format-chat.mjs";

describe("stripChatTags", () => {
  it("移除单个 inline tag", () => {
    assert.equal(stripChatTags("事实 [OBS]"), "事实");
  });

  it("移除多种 tag", () => {
    const input = "WT eviction [KB]<br>cache=94% [OBS]";
    assert.equal(stripChatTags(input), "WT eviction<br>cache=94%");
  });

  it("[OBS][参考3] 紧挨 → 只剥 [OBS]", () => {
    assert.equal(stripChatTags("事实 [OBS][参考3]"), "事实 [参考3]");
  });

  it("[OBS] [参考3] 中间空格 → 只剥 [OBS]", () => {
    assert.equal(stripChatTags("事实 [OBS] [参考3]"), "事实 [参考3]");
  });

  it("[KB] [参考1] 也剥 [KB]", () => {
    assert.equal(stripChatTags("[参考1] 标题 — domain [KB]"), "[参考1] 标题 — domain");
  });

  it("移除整段 ## 来源标记 (debug) section", () => {
    const input = `# title

## 来源标记 (debug)

| 标记 | 含义 |
|---|---|
| \`[IDX]\` | cases/INDEX.md |
| \`[KB]\`  | cases/KB.md |

## 诊断结果

| a |
|---|
| 事实 [OBS] |
`;
    const out = stripChatTags(input);
    assert.ok(!out.includes("## 来源标记"));
    assert.ok(!out.includes("cases/INDEX.md"));
    assert.ok(out.includes("## 诊断结果"));
    assert.ok(out.includes("事实"));
    assert.ok(!out.includes("[OBS]"));
  });

  it("legend 在文件末尾(无后续 ## )也能正确移除", () => {
    const input = `# title

## 诊断结果

table

## 来源标记 (debug)

| 标记 | 含义 |
|---|---|
| \`[KB]\` | cases/KB.md |
`;
    const out = stripChatTags(input);
    assert.ok(!out.includes("## 来源标记"));
    assert.ok(out.includes("## 诊断结果"));
  });

  it("无 tag 文本不被改动", () => {
    const input = "纯文本 没有标签 应该原样\n第二行";
    assert.equal(stripChatTags(input), input);
  });

  it("不该把 [参考N] 误剥", () => {
    const input = "事实 [参考3]";
    assert.equal(stripChatTags(input), "事实 [参考3]");
  });

  it("剥后留下的双空格被压成单空格", () => {
    const input = "事实 [OBS] · 阈=95% [KB]";
    assert.equal(stripChatTags(input), "事实 · 阈=95%");
  });

  it("(回归)空字符串 → 空字符串", () => {
    assert.equal(stripChatTags(""), "");
  });

  it("(回归)只有 legend 段 · 返回空", () => {
    const input = `## 来源标记 (debug)

| 标记 | 含义 |
|---|---|
| \`[OBS]\` | 现场采集 |
`;
    assert.equal(stripChatTags(input).trim(), "");
  });

  it("(回归)旧报告(无 legend · 无 5 标签)原样返回", () => {
    const input = `# 报告

## 诊断结果

| a | b |
|---|---|
| x | [参考1] |

## 参考

[参考1] foo bar
        https://example.com
`;
    assert.equal(stripChatTags(input), input);
  });

  it("(回归)## 参考 段的 [KB] / [NLM] 也被剥", () => {
    const input = `## 参考

[参考1] WiredTiger Tuning — source.wiredtiger.com [KB]
        https://example.com/a
[参考2] vm.swappiness — kernel.org [NLM]
        https://example.com/b
`;
    const out = stripChatTags(input);
    assert.ok(!out.includes("[KB]"));
    assert.ok(!out.includes("[NLM]"));
    assert.ok(out.includes("[参考1]"));
    assert.ok(out.includes("[参考2]"));
    assert.ok(out.includes("WiredTiger Tuning"));
  });

  it("(回归)CRLF 行尾 + legend 段也能正确移除", () => {
    const input = "# title\r\n\r\n## 来源标记 (debug)\r\n\r\n| a | b |\r\n|---|---|\r\n| `[KB]` | foo |\r\n\r\n## 诊断结果\r\n\r\n事实 [OBS]\r\n";
    const out = stripChatTags(input);
    assert.ok(!out.includes("## 来源标记"));
    assert.ok(out.includes("## 诊断结果"));
    assert.ok(!out.includes("[OBS]"));
    assert.ok(!out.includes("[KB]"));
  });
});
