/**
 * rule-engine v2 · 支持结构化规则 · 0 LLM · runtime 纯 deterministic
 *
 * 新特性 vs v1:
 *   - when[] 多前置条件 (AND 语义)
 *   - compute 字段(算术表达式 · 字段路径自动解析)
 *   - 单位归一(unit: bytes/mb/gb/percent/ms/...)
 *   - 内置函数 max / min / safe_divide
 *
 * 设计:
 *   - 所有 evaluator 是纯函数 · 可单测
 *   - 只接受白名单字符 · 防 eval 注入
 *   - 字段路径走 dotted-path lookup · 支持 ['xxx'] 引号 key
 */

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

export type Op = "gt" | "lt" | "ge" | "le" | "eq" | "ne" | "contains" | "not_contains";
export type Unit =
  | "bytes" | "kb" | "mb" | "gb"
  | "percent" | "ratio"
  | "ms" | "seconds"
  | "count" | "boolean" | "string";

export interface CheckV2 {
  /** 二选一: compute (算术表达式) 或 metric (单字段路径) */
  compute?: string;
  metric?: string;
  op: Op;
  value: number | string | boolean;
  unit?: Unit;
}

export interface RuleV2 {
  rule_id: string;
  /** 全部满足才进入 checks · 不满足直接 skipped */
  when?: CheckV2[];
  /** 任一触发即 finding */
  checks: CheckV2[];
}

export type EvalStatus = "finding" | "ok" | "skipped" | "error";

export interface EvalResult {
  rule_id: string;
  status: EvalStatus;
  triggered_check?: CheckV2 & { actual: number | string | boolean };
  skipped_reason?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// 字段路径解析 · 支持 a.b.c, a['b c'], a["b"], a[0]
// ---------------------------------------------------------------------------

const FIELD_TOKEN_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const FIELD_BRACKET_RE = /^\['([^']+)'\]|^\["([^"]+)"\]|^\[(\d+)\]/;

export function resolveField(metrics: Record<string, any>, path: string): any {
  let cur: any = metrics;
  let i = 0;
  let token = "";
  while (i < path.length) {
    const ch = path[i];
    if (ch === ".") {
      if (token) {
        cur = cur?.[token];
        token = "";
      }
      i++;
    } else if (ch === "[") {
      if (token) {
        cur = cur?.[token];
        token = "";
      }
      const sub = path.slice(i);
      const m = sub.match(FIELD_BRACKET_RE);
      if (!m) return undefined;
      const key = m[1] ?? m[2] ?? m[3];
      cur = cur?.[key as any];
      i += m[0].length;
    } else {
      token += ch;
      i++;
    }
  }
  if (token) cur = cur?.[token];
  return cur;
}

// ---------------------------------------------------------------------------
// 算术表达式评估 · 限白名单 · 不用 eval
// ---------------------------------------------------------------------------
//
// 支持:
//   - 数字: 123, 1.5, 1048576
//   - 字段路径: serverStatus.connections.current, hostInfo.system.memSizeMB
//                带 [] 的: serverStatus.wiredTiger.cache['maximum bytes configured']
//   - 运算符: + - * / 括号
//   - 函数: max(a,b,...), min(a,b,...), safe_divide(a,b) → b==0 时返 0
//
// 实现:
//   1. tokenize
//   2. recursive descent parse
//   3. evaluate AST

type Token =
  | { kind: "num"; v: number }
  | { kind: "ident"; v: string }
  | { kind: "str"; v: string }
  | { kind: "lparen" }
  | { kind: "rparen" }
  | { kind: "comma" }
  | { kind: "op"; v: "+" | "-" | "*" | "/" };

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === " " || ch === "\t" || ch === "\n") { i++; continue; }
    if (ch === "(") { tokens.push({ kind: "lparen" }); i++; continue; }
    if (ch === ")") { tokens.push({ kind: "rparen" }); i++; continue; }
    if (ch === ",") { tokens.push({ kind: "comma" }); i++; continue; }
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
      tokens.push({ kind: "op", v: ch as any }); i++; continue;
    }
    // string literal · rate(path, '5s') / window(path, '5min', 'avg') 用
    if (ch === "'" || ch === '"') {
      const quote = ch;
      let j = i + 1;
      while (j < input.length && input[j] !== quote) j++;
      if (j >= input.length) throw new Error(`unterminated string literal at ${i}`);
      tokens.push({ kind: "str", v: input.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    // num
    if (/[0-9]/.test(ch!)) {
      let j = i;
      while (j < input.length && /[0-9.]/.test(input[j]!)) j++;
      tokens.push({ kind: "num", v: parseFloat(input.slice(i, j)) });
      i = j; continue;
    }
    // ident · 字段路径(含 . [ ] ')
    if (/[a-zA-Z_]/.test(ch!)) {
      let j = i;
      while (j < input.length) {
        const c = input[j];
        if (c === undefined) break;
        if (/[a-zA-Z0-9_]/.test(c)) { j++; continue; }
        if (c === ".") { j++; continue; }
        if (c === "[") {
          const sub = input.slice(j);
          const m = sub.match(FIELD_BRACKET_RE);
          if (m) { j += m[0].length; continue; }
          break;
        }
        break;
      }
      tokens.push({ kind: "ident", v: input.slice(i, j) });
      i = j; continue;
    }
    throw new Error(`unexpected char '${ch}' at ${i}`);
  }
  return tokens;
}

interface Parser {
  i: number;
  tokens: Token[];
}

function peek(p: Parser): Token | undefined { return p.tokens[p.i]; }
function eat(p: Parser): Token { return p.tokens[p.i++]!; }

// expr := term (('+'|'-') term)*
// term := factor (('*'|'/') factor)*
// factor := num | ident | ident '(' expr (',' expr)* ')' | '(' expr ')'

type AST =
  | { kind: "num"; v: number }
  | { kind: "str"; v: string }
  | { kind: "field"; path: string }
  | { kind: "fn"; name: string; args: AST[] }
  | { kind: "binop"; op: "+" | "-" | "*" | "/"; l: AST; r: AST };

function parseExpr(p: Parser): AST {
  let l = parseTerm(p);
  while (true) {
    const t = peek(p);
    if (t?.kind === "op" && (t.v === "+" || t.v === "-")) {
      eat(p);
      const r = parseTerm(p);
      l = { kind: "binop", op: t.v, l, r };
    } else break;
  }
  return l;
}

function parseTerm(p: Parser): AST {
  let l = parseFactor(p);
  while (true) {
    const t = peek(p);
    if (t?.kind === "op" && (t.v === "*" || t.v === "/")) {
      eat(p);
      const r = parseFactor(p);
      l = { kind: "binop", op: t.v, l, r };
    } else break;
  }
  return l;
}

function parseFactor(p: Parser): AST {
  const t = eat(p);
  if (t.kind === "num") return { kind: "num", v: t.v };
  if (t.kind === "str") return { kind: "str", v: t.v };
  if (t.kind === "lparen") {
    const e = parseExpr(p);
    const rp = eat(p);
    if (rp.kind !== "rparen") throw new Error("expected )");
    return e;
  }
  if (t.kind === "ident") {
    const next = peek(p);
    if (next?.kind === "lparen") {
      eat(p); // (
      const args: AST[] = [];
      if (peek(p)?.kind !== "rparen") {
        args.push(parseExpr(p));
        while (peek(p)?.kind === "comma") { eat(p); args.push(parseExpr(p)); }
      }
      const rp = eat(p);
      if (rp.kind !== "rparen") throw new Error("expected ) in fn");
      return { kind: "fn", name: t.v, args };
    }
    return { kind: "field", path: t.v };
  }
  throw new Error(`unexpected token ${JSON.stringify(t)}`);
}

function evalAst(ast: AST, metrics: Record<string, any>): number {
  if (ast.kind === "num") return ast.v;
  if (ast.kind === "str") {
    // 字符串只在 fn 上下文里有意义(rate/baseline/window 的 interval 参数) ·
    // 单独的 str 不能算术求值 → 抛错
    throw new Error(`unexpected string literal '${ast.v}' outside fn arg`);
  }
  if (ast.kind === "field") {
    const v = resolveField(metrics, ast.path);
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const n = parseFloat(v);
      if (Number.isFinite(n)) return n;
    }
    if (typeof v === "boolean") return v ? 1 : 0;
    throw new Error(`field ${ast.path} not numeric (got ${JSON.stringify(v)})`);
  }
  if (ast.kind === "fn") {
    // rate / baseline 是 special case · args 不预 evaluate
    if (ast.name === "rate") return evalRate(ast, metrics);
    if (ast.name === "baseline") return evalBaseline(ast, metrics);
    const args = ast.args.map(a => evalAst(a, metrics));
    if (ast.name === "max") return Math.max(...args);
    if (ast.name === "min") return Math.min(...args);
    if (ast.name === "safe_divide") {
      if (args.length !== 2) throw new Error("safe_divide needs 2 args");
      return args[1] === 0 ? 0 : args[0]! / args[1]!;
    }
    if (ast.name === "abs") return Math.abs(args[0]!);
    throw new Error(`unknown fn ${ast.name}`);
  }
  if (ast.kind === "binop") {
    const l = evalAst(ast.l, metrics);
    const r = evalAst(ast.r, metrics);
    if (ast.op === "+") return l + r;
    if (ast.op === "-") return l - r;
    if (ast.op === "*") return l * r;
    if (ast.op === "/") {
      if (r === 0) throw new Error("division by zero (use safe_divide)");
      return l / r;
    }
  }
  throw new Error("unreachable");
}

// ---------------------------------------------------------------------------
// 内置时间函数: rate(metric_path, '5s') / baseline(metric_path)
//
// rate(path, interval): 用 collector v2 双采样数据 (t0_serverStatus / t1_serverStatus
//   / sample_interval_sec) 算 (t1-t0) / actual_interval · 单位是 path 单位/秒。
//   path 必须以 serverStatus 开头(改写为 t0_serverStatus / t1_serverStatus)。
//   interval 字符串(如 '5s')目前仅做语义提示 · 实际除数用 metrics.sample_interval_sec ·
//   不强求精确匹配(避免规则写死 5s 但 collector 改成 10s 后规则全 error)。
//
// baseline(path): 从 metrics.baseline (rule-engine 入参时由 cli-diagnose 注入) 读历史值 ·
//   metrics.baseline 形态: { "<path>": <number> } · 取不到抛 missing baseline 错误 ·
//   持久化层 (~/.ohsql/perf-kp-sql/baselines/<host>.json) 由 cli-diagnose 加载注入 ctx。
// ---------------------------------------------------------------------------

function evalRate(ast: AST & { kind: "fn" }, metrics: Record<string, any>): number {
  if (ast.args.length !== 2) throw new Error("rate needs 2 args: rate(path, '5s')");
  const pathAst = ast.args[0];
  const intvAst = ast.args[1];
  if (pathAst.kind !== "field") throw new Error("rate arg 1 must be a field path");
  if (intvAst.kind !== "str") throw new Error("rate arg 2 must be string literal like '5s'");

  // 解析 interval 字面量(语义提示 · 实际除数用 sample_interval_sec)
  const m = intvAst.v.match(/^(\d+)\s*s$/i);
  if (!m) throw new Error(`rate interval must be '<number>s', got '${intvAst.v}'`);

  const actualSec = metrics.sample_interval_sec;
  if (typeof actualSec !== "number" || actualSec <= 0) {
    throw new Error("sample_interval_sec missing or invalid (collector v2 双采样未生效?)");
  }

  // 路径改写: serverStatus.* → t0_serverStatus.* / t1_serverStatus.*
  const path = pathAst.path;
  if (!path.startsWith("serverStatus")) {
    throw new Error(`rate only supports serverStatus.* paths, got '${path}'`);
  }
  const t0Path = "t0_" + path;
  const t1Path = "t1_" + path;
  const t0 = numericOrNull(resolveField(metrics, t0Path));
  const t1 = numericOrNull(resolveField(metrics, t1Path));
  if (t0 === null) throw new Error(`rate: t0 field ${t0Path} not collected`);
  if (t1 === null) throw new Error(`rate: t1 field ${t1Path} not collected`);

  return (t1 - t0) / actualSec;
}

function evalBaseline(ast: AST & { kind: "fn" }, metrics: Record<string, any>): number {
  if (ast.args.length !== 1) throw new Error("baseline needs 1 arg: baseline(path)");
  const pathAst = ast.args[0];
  if (pathAst.kind !== "field") throw new Error("baseline arg 1 must be a field path");

  const baselines = metrics.baseline as Record<string, number> | undefined;
  if (!baselines || typeof baselines !== "object") {
    throw new Error("baseline data missing (~/.ohsql/perf-kp-sql/baselines/<host>.json 未加载?)");
  }
  const v = baselines[pathAst.path];
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new Error(`baseline: no value for '${pathAst.path}'`);
  }
  return v;
}

function numericOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  if (typeof v === "boolean") return v ? 1 : 0;
  return null;
}

export function evalCompute(expr: string, metrics: Record<string, any>): number {
  const tokens = tokenize(expr);
  const p: Parser = { i: 0, tokens };
  const ast = parseExpr(p);
  if (p.i !== tokens.length) throw new Error("trailing tokens");
  return evalAst(ast, metrics);
}

// ---------------------------------------------------------------------------
// Op 比较
// ---------------------------------------------------------------------------

export function applyOp(op: Op, actual: number | string | boolean, expected: number | string | boolean): boolean {
  switch (op) {
    case "eq": return actual === expected;
    case "ne": return actual !== expected;
    case "gt": return Number(actual) > Number(expected);
    case "lt": return Number(actual) < Number(expected);
    case "ge": return Number(actual) >= Number(expected);
    case "le": return Number(actual) <= Number(expected);
    case "contains": return String(actual).includes(String(expected));
    case "not_contains": return !String(actual).includes(String(expected));
  }
}

// ---------------------------------------------------------------------------
// 单条 check 评估
// ---------------------------------------------------------------------------

export function evaluateCheck(check: CheckV2, metrics: Record<string, any>): {
  triggered: boolean;
  actual: number | string | boolean;
  error?: string;
} {
  let actual: any;
  try {
    if (check.compute) {
      actual = evalCompute(check.compute, metrics);
    } else if (check.metric) {
      actual = resolveField(metrics, check.metric);
      if (actual === undefined) return { triggered: false, actual: "(undefined)", error: "metric not collected" };
    } else {
      return { triggered: false, actual: "(none)", error: "no compute / metric" };
    }
  } catch (e: any) {
    return { triggered: false, actual: "(error)", error: e?.message ?? String(e) };
  }

  return { triggered: applyOp(check.op, actual, check.value), actual };
}

// ---------------------------------------------------------------------------
// 单条规则评估
// ---------------------------------------------------------------------------

export function evaluateRule(rule: RuleV2, metrics: Record<string, any>): EvalResult {
  // when 子句 · 任一不满足 → skipped
  if (rule.when && rule.when.length > 0) {
    for (const w of rule.when) {
      const r = evaluateCheck(w, metrics);
      if (r.error) return { rule_id: rule.rule_id, status: "skipped", skipped_reason: `when: ${r.error}` };
      if (!r.triggered) return { rule_id: rule.rule_id, status: "skipped", skipped_reason: `when not satisfied: ${w.compute ?? w.metric} ${w.op} ${w.value} · actual=${r.actual}` };
    }
  }
  // checks 任一触发 → finding
  for (const c of rule.checks) {
    const r = evaluateCheck(c, metrics);
    if (r.error) return { rule_id: rule.rule_id, status: "error", error: r.error };
    if (r.triggered) {
      return { rule_id: rule.rule_id, status: "finding", triggered_check: { ...c, actual: r.actual } };
    }
  }
  return { rule_id: rule.rule_id, status: "ok" };
}
