// SKILL.md 结构单测 · 验证 Progressive Disclosure 拆分后:
//   1. references/ 目录存在 · 6 个 reference 文件齐(phase-0/1-2/3/4/5/6)
//   2. 主 SKILL.md Phase 0-6 段都包含正确的 router 指令(Read references/phase-X.md)
//   3. 关键全局约束仍然在主 SKILL.md(self-check 4 条 / NLM 双源 / URL 红线 / Phase 顺序硬约束 / Task tracking pattern)
//
// 这些是 Progressive Disclosure 重构后的核心 invariant — 拆分后 LLM 必须按 router 指令 Read reference,
// 关键约束必须在主 SKILL 注意力强的位置(开篇 / 红线段)兜底。

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(HERE, "../skills/perf-kp-sql");
const SKILL_MD = resolve(SKILL_ROOT, "SKILL.md");
const REF_DIR = resolve(SKILL_ROOT, "references");

const REQUIRED_REFS: Array<{ file: string; routerKey: string }> = [
  { file: "phase-0-env.md", routerKey: "## Phase 0" },
  { file: "phase-1-2-case.md", routerKey: "## Phase 1+2" },
  { file: "phase-3-collect.md", routerKey: "## Phase 3" },
  { file: "phase-4-multisource.md", routerKey: "## Phase 4" },
  { file: "phase-5-report.md", routerKey: "## Phase 5" },
  { file: "phase-6-followup.md", routerKey: "## Phase 6" },
];

describe("SKILL.md Progressive Disclosure 结构", () => {
  it("references/ 目录存在", () => {
    assert.ok(existsSync(REF_DIR), `references/ 目录必须存在: ${REF_DIR}`);
  });

  for (const { file } of REQUIRED_REFS) {
    it(`reference 文件存在: ${file}`, () => {
      const path = resolve(REF_DIR, file);
      assert.ok(existsSync(path), `必须存在: ${path}`);
      const content = readFileSync(path, "utf8");
      assert.ok(content.length > 100, `${file} 不能为空(< 100 字符)`);
    });
  }

  it("主 SKILL.md 每个 phase 段都包含 router 指令(Read references/phase-X.md)", () => {
    const skill = readFileSync(SKILL_MD, "utf8");
    for (const { file, routerKey } of REQUIRED_REFS) {
      const sectionStart = skill.indexOf(routerKey);
      assert.ok(sectionStart >= 0, `主 SKILL 必须包含 ${routerKey} 段`);
      // 取从 routerKey 起 1500 字符内必须有对应 reference Read 指令
      const window = skill.slice(sectionStart, sectionStart + 1500);
      const expected = `references/${file}`;
      assert.ok(
        window.includes(expected),
        `${routerKey} 段必须包含 router 指令 Read ${expected}`,
      );
      assert.ok(
        window.includes("第一动作必须") || window.includes("必须**:"),
        `${routerKey} 段必须有"第一动作必须"硬约束 phrasing`,
      );
    }
  });

  it("主 SKILL.md 保留全局关键约束(self-check / NLM 双源 / URL 红线 / Phase 顺序 / Task pattern)", () => {
    const skill = readFileSync(SKILL_MD, "utf8");
    const required = [
      "流程顺序硬约束",
      "Task tracking pattern",
      "self-check 4 条",
      "URL 强制溯源",
      "NLM 双源",
      "案例 + NLM",
      "task list 5 步主结构",
      "禁用元词清单",
    ];
    for (const kw of required) {
      assert.ok(
        skill.includes(kw),
        `主 SKILL 必须保留关键约束字符串: "${kw}"`,
      );
    }
  });

  it("主 SKILL.md 5 步主任务字面值正确(不许漏 / 改名)", () => {
    const skill = readFileSync(SKILL_MD, "utf8");
    const tasks = [
      "环境信息采集",
      "诊断案例匹配",
      "诊断指标采集",
      "多源综合诊断",
      "报告生成",
    ];
    for (const t of tasks) {
      assert.ok(skill.includes(t), `task 字面值必须存在: "${t}"`);
    }
  });

  it("references 文件不互相 router(避免循环引用)", () => {
    for (const { file } of REQUIRED_REFS) {
      const content = readFileSync(resolve(REF_DIR, file), "utf8");
      // reference 内容不应该包含其他 reference 的 router 指令
      // (允许提及其他 phase 的概念,但不许用 Read references/phase-X.md 形式 router)
      const otherRefs = REQUIRED_REFS.filter((r) => r.file !== file);
      for (const other of otherRefs) {
        const routerLine = `Read(file_path="<PLUGIN_ROOT>/skills/perf-kp-sql/references/${other.file}")`;
        assert.ok(
          !content.includes(routerLine),
          `reference ${file} 不应该 router 到其他 reference ${other.file}(循环)`,
        );
      }
    }
  });
});
