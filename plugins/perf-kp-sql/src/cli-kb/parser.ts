// Phase 1 · M3 · distill-v2 cases md 解析器
//
// 把蒸馏出来的 md 文件结构化为 cli-kb 入库前的中间表示:
//   1. parseFrontmatter:  yaml frontmatter → fm 字典
//   2. splitCases:        body → 多个 ## case_id 区块
//   3. parseCaseFields:   一个 case 区块 → { fields: Map, quotes: Map }
//   4. assemble{Bp,Df,Flame}Data: → entry_kind 专属 JSON
//
// 蒸馏 md 结构约定见 PHASE-1-SCHEMA-AND-USAGE.md §1。

import yaml from "js-yaml";

export interface Frontmatter {
  entry_kind?: string;
  database?: string | null;
  platform?: string;
  source_url?: string;
  source_url_lang?: string;
  source_authority?: string;
  extracted_at?: string;
  extractor_model?: string;
  inferred_fields?: string[];
  notes?: string;
  [k: string]: unknown;
}

export interface CaseBlock {
  caseId: string;
  content: string; // 含起始的 ## case_id 行
}

export function parseFrontmatter(content: string): { fm: Frontmatter; body: string } {
  const m = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return { fm: {}, body: content };
  let fm: Frontmatter = {};
  try {
    const loaded = yaml.load(m[1]) as Frontmatter | null;
    fm = loaded ?? {};
  } catch {
    fm = {};
  }
  return { fm, body: content.slice(m[0].length) };
}

export function splitCases(body: string): CaseBlock[] {
  const headerRe = /^## case_id:\s*`?([^`\n]+?)`?\s*$/gm;
  const heads: { caseId: string; start: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(body)) !== null) {
    heads.push({ caseId: m[1].trim(), start: m.index });
  }
  const out: CaseBlock[] = [];
  for (let i = 0; i < heads.length; i++) {
    const start = heads[i].start;
    const end = i + 1 < heads.length ? heads[i + 1].start : body.length;
    out.push({ caseId: heads[i].caseId, content: body.slice(start, end) });
  }
  return out;
}

// 抓所有 `| key | value |` 表行 (第一个 value 胜出 · 跳表头/分隔行)
function parseTableFields(content: string): Map<string, string> {
  const fields = new Map<string, string>();
  const re = /^\|\s*([^|\n]+?)\s*\|\s*([^|\n]*?)\s*\|/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const k = m[1].trim();
    const v = m[2].trim();
    if (!k || !v) continue;
    if (k === "字段" && v === "值") continue;
    if (/^[\s\-:|]+$/.test(k) || /^[\s\-:|]+$/.test(v)) continue;
    if (!fields.has(k)) fields.set(k, v);
  }
  return fields;
}

// 抓 `#### <label>(...)\n\n> ...` 形式的 block-quote
function parseQuotes(content: string): Map<string, string> {
  const quotes = new Map<string, string>();
  // 形如:
  //   #### scenario_description_quote (逐字 · en)
  //
  //   > foo bar
  //   > baz
  const re = /^####\s+(\w+)[^\n]*\n+>\s*([^\n]+(?:\n>\s*[^\n]+)*)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const key = m[1];
    if (!quotes.has(key)) {
      quotes.set(key, m[2].replace(/\n>\s*/g, " ").trim());
    }
  }
  return quotes;
}

// 抓 `#### <label>(中文转述 ...) ↓ 段落 (非 > 引用 · 直到下一个 #### 或 ###)`
function parseZhBlocks(content: string): Map<string, string> {
  const zh = new Map<string, string>();
  // 形如:
  //   #### rationale (中文转述 · 模型推断 · 非逐字)
  //
  //   foo bar baz...
  const re = /^####\s+(\w+)\s*\(中文转述[^)]*\)\s*\n+([^\n][\s\S]*?)(?=\n####\s+|\n###\s+|\n##\s+|\n---|\n\n\|)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const key = m[1] + "_zh";
    if (!zh.has(key)) {
      zh.set(key, m[2].trim());
    }
  }
  return zh;
}

export function parseCaseFields(content: string): {
  fields: Map<string, string>;
  quotes: Map<string, string>;
  zh: Map<string, string>;
} {
  return {
    fields: parseTableFields(content),
    quotes: parseQuotes(content),
    zh: parseZhBlocks(content),
  };
}

// 切 JSON 数组字符串 (`["a","b"]` 形式)
function parseJsonArray(s: string | undefined): string[] {
  if (!s) return [];
  const cleaned = s.replace(/^`|`$/g, "").trim();
  if (!cleaned.startsWith("[")) return [];
  try {
    const arr = JSON.parse(cleaned);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

// 把 NULL 字段值识别为 null (蒸馏约定: `(NULL · ...)`)
function nullable(v: string | undefined): string | null {
  if (!v) return null;
  if (/^\(NULL[\s)·]/.test(v)) return null;
  return v;
}

// === assemble for entry_kind ===

export interface BestPracticeData {
  scenario: {
    description_quote: string | null;
    description_zh: string | null;
    keywords: string[];
    triggers_quote: string | null;
  };
  recommendation: {
    value: string | null;
    layer: string | null;
    quote: string | null;
  };
  detection_step: {
    layer: string | null;
    method_quote: string | null;
    violation_pattern_quote: string | null;
  } | null;
  rationale: {
    quote: string | null;
    quote_lang: string | null;
    zh: string | null;
  };
  risk: {
    severity: string | null;
    quote: string | null;
    zh: string | null;
  };
  cross_reference: string[];
}

export function assembleBestPracticeData(c: CaseBlock, _fm: Frontmatter): BestPracticeData {
  const { fields, quotes, zh } = parseCaseFields(c.content);

  const detectionLayer = fields.get("detection_layer");
  const detection = detectionLayer
    ? {
        layer: detectionLayer,
        method_quote: nullable(fields.get("detection_method_quote")),
        violation_pattern_quote: nullable(fields.get("violation_pattern_quote")),
      }
    : null;

  return {
    scenario: {
      description_quote: quotes.get("scenario_description_quote") ?? null,
      description_zh: zh.get("scenario_description_zh") ?? null,
      keywords: parseJsonArray(fields.get("scenario_keywords")),
      triggers_quote: nullable(fields.get("triggers_quote")),
    },
    recommendation: {
      value: nullable(fields.get("recommendation_value")),
      layer: nullable(fields.get("recommendation_layer")),
      quote: quotes.get("recommendation_quote") ?? null,
    },
    detection_step: detection,
    rationale: {
      quote: quotes.get("rationale_quote") ?? null,
      quote_lang: nullable(fields.get("rationale_quote_lang")),
      zh: zh.get("rationale_zh") ?? null,
    },
    risk: {
      severity: nullable(fields.get("risk_severity")),
      quote: quotes.get("risk_quote") ?? null,
      zh: zh.get("risk_zh") ?? null,
    },
    cross_reference: [],
  };
}

export interface DiagnosticFlowStep {
  step_no: number;
  title: string;
  metric_name: string | null;
  collection_layer: string | null;
  collection_method_quote: string | null;
  abnormal_pattern_quote: string | null;
  abnormal_pattern_threshold: string | null;
  metric_unit: string | null;
  prerequisite_steps: string[];
}

export interface DiagnosticFlowData {
  engine: string | null;
  symptom_category: string | null;
  symptom: {
    description_quote: string | null;
    keywords: string[];
  };
  diagnostic_steps: DiagnosticFlowStep[];
  likely_causes: {
    parameter_causes: Array<{
      cause_no: number;
      title: string;
      param_name: string | null;
      abnormal_value_pattern: string | null;
      reasoning_quote: string | null;
      linked_diagnostic_step_no: number | null;
    }>;
    non_parameter_causes: Array<{
      cause_no: number;
      title: string;
      cause_type: string | null;
      description_quote: string | null;
      linked_diagnostic_step_no: number | null;
      mitigation_quote: string | null;
    }>;
  };
  mitigation_quote: string | null;
}

export function assembleDiagnosticFlowData(c: CaseBlock, _fm: Frontmatter): DiagnosticFlowData {
  const { fields, quotes } = parseCaseFields(c.content);

  // 抓 #### keywords 后的 `[...]` 行
  const keywordsLine = c.content.match(/####\s+keywords\s*\n+\s*`(\[[^\]]+\])`/);
  const keywords = keywordsLine ? parseJsonArray(keywordsLine[1]) : [];

  // 抓所有 #### step_no N · <title> 区块
  // 注意: lookahead 用 \n#### 等 (而非 ^#### + multiline) · 避免 multiline `$` 在每行结尾打断 [\s\S]*?
  const stepRe = /^####\s+step_no\s+(\d+)[^\n]*?(?:·\s*([^\n]+))?\n([\s\S]*?)(?=\n####\s+|\n###\s+|\n##\s+|$(?![\s\S]))/gm;
  const steps: DiagnosticFlowStep[] = [];
  let sm: RegExpExecArray | null;
  while ((sm = stepRe.exec(c.content)) !== null) {
    const stepNo = parseInt(sm[1], 10);
    const title = (sm[2] ?? "").trim();
    const stepFields = parseTableFields(sm[3]);
    steps.push({
      step_no: stepNo,
      title,
      metric_name: nullable(stepFields.get("metric_name")),
      collection_layer: nullable(stepFields.get("collection_layer")),
      collection_method_quote: nullable(stepFields.get("collection_method_quote")),
      abnormal_pattern_quote: nullable(stepFields.get("abnormal_pattern_quote")),
      abnormal_pattern_threshold: nullable(stepFields.get("abnormal_pattern_threshold")),
      metric_unit: nullable(stepFields.get("metric_unit")),
      prerequisite_steps: parseJsonArray(stepFields.get("prerequisite_steps")),
    });
  }

  // 抓 likely_causes 下的 #### parameter_causes / non_parameter_causes 子块 + 各自 ##### cause N
  const parameterCauses: DiagnosticFlowData["likely_causes"]["parameter_causes"] = [];
  const nonParameterCauses: DiagnosticFlowData["likely_causes"]["non_parameter_causes"] = [];
  const lcMatch = c.content.match(/###\s+likely_causes\s*\n([\s\S]*?)(?=\n###\s+|\n---\s*$|$)/);
  if (lcMatch) {
    const sec = lcMatch[1];
    const subRe = /####\s+(parameter_causes|non_parameter_causes)\s*\n([\s\S]*?)(?=\n####\s+|\n###\s+|$)/g;
    let cm: RegExpExecArray | null;
    while ((cm = subRe.exec(sec)) !== null) {
      const subName = cm[1];
      const subBody = cm[2];
      if (/^\s*\(无[^)]*\)/.test(subBody.trim())) continue;
      const causeRe = /#####\s+cause\s+(\d+)[^\n]*?(?:·\s*([^\n]+))?\n([\s\S]*?)(?=\n#####\s+|\n####\s+|\n###\s+|$)/g;
      let ccm: RegExpExecArray | null;
      while ((ccm = causeRe.exec(subBody)) !== null) {
        const causeNo = parseInt(ccm[1], 10);
        const title = (ccm[2] ?? "").trim();
        const cf = parseTableFields(ccm[3]);
        if (subName === "parameter_causes") {
          const linkRaw = cf.get("linked_diagnostic_step_no");
          parameterCauses.push({
            cause_no: causeNo,
            title,
            param_name: nullable(cf.get("param_name")),
            abnormal_value_pattern: nullable(cf.get("abnormal_value_pattern")),
            reasoning_quote: nullable(cf.get("reasoning_quote")),
            linked_diagnostic_step_no: linkRaw ? parseInt(linkRaw, 10) : null,
          });
        } else {
          const linkRaw = cf.get("linked_diagnostic_step_no");
          nonParameterCauses.push({
            cause_no: causeNo,
            title,
            cause_type: nullable(cf.get("cause_type")),
            description_quote: nullable(cf.get("description_quote")),
            linked_diagnostic_step_no: linkRaw ? parseInt(linkRaw, 10) : null,
            mitigation_quote: nullable(cf.get("mitigation_quote")),
          });
        }
      }
    }
  }

  return {
    engine: nullable(fields.get("engine")),
    symptom_category: nullable(fields.get("symptom_category")),
    symptom: {
      description_quote: quotes.get("description") ?? null,
      keywords,
    },
    diagnostic_steps: steps,
    likely_causes: {
      parameter_causes: parameterCauses,
      non_parameter_causes: nonParameterCauses,
    },
    mitigation_quote: quotes.get("mitigation") ?? null,
  };
}

export interface FlameSignatureData {
  signature_type: string | null;
  pattern_regex: string | null;
  match_layer: string | null;
  pattern_quote_anchor: string | null;
  pattern_quote: string | null;
  mechanism: { quote: string | null; quote_lang: string | null; zh: string | null };
  workload_implication: { quote: string | null; zh: string | null; hotness_threshold: string | null };
  tuning_directions: Array<{
    direction_no: number;
    direction_quote: string | null;
    related_param_name: string | null;
    confidence: string | null;
  }>;
  cross_reference: string[];
  linked_case_ids: string[];
}

export function assembleFlameSignatureData(c: CaseBlock, _fm: Frontmatter): FlameSignatureData {
  const { fields, quotes, zh } = parseCaseFields(c.content);

  // 抓所有 #### direction N · <title> 区块
  const dirRe = /^####\s+direction\s+(\d+)[^\n]*\n([\s\S]*?)(?=\n####\s+|\n###\s+|\n##\s+|$(?![\s\S]))/gm;
  const directions: FlameSignatureData["tuning_directions"] = [];
  let dm: RegExpExecArray | null;
  while ((dm = dirRe.exec(c.content)) !== null) {
    const directionNo = parseInt(dm[1], 10);
    const df = parseTableFields(dm[2]);
    directions.push({
      direction_no: directionNo,
      direction_quote: nullable(df.get("direction_quote")),
      related_param_name: nullable(df.get("related_param_name")),
      confidence: nullable(df.get("confidence")),
    });
  }

  return {
    signature_type: nullable(fields.get("signature_type")),
    pattern_regex: nullable(fields.get("pattern_regex")),
    match_layer: nullable(fields.get("match_layer")),
    pattern_quote_anchor: nullable(fields.get("pattern_quote_anchor")),
    pattern_quote: quotes.get("pattern_quote") ?? null,
    mechanism: {
      quote: quotes.get("mechanism_quote") ?? null,
      quote_lang: nullable(fields.get("mechanism_quote_lang")),
      zh: zh.get("mechanism_zh") ?? null,
    },
    workload_implication: {
      quote: quotes.get("workload_implication_quote") ?? null,
      zh: zh.get("workload_implication_zh") ?? null,
      hotness_threshold: nullable(fields.get("hotness_threshold")),
    },
    tuning_directions: directions,
    cross_reference: [],
    linked_case_ids: [],
  };
}
