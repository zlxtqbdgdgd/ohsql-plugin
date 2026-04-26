/**
 * hotspot/parsePerfScript — 把 `perf script` 的原始文本解析为带 DSO 的调用栈序列
 *
 * **Why**: stackcollapse-perf.pl 会把 DSO（`(/usr/lib64/libz.so.1.2.11)` 这类）扔掉，
 * 我们就失去了准确的模块归属，只能在下游用硬编码函数名正则去猜（维护噩梦）。
 * 业界标准是从 perf script 保留 DSO —— Speedscope 的 `linux-tools-perf.ts`
 * 就是这样做的，本文件即该解析器的 TS 移植（MIT）。
 *
 * **Input**: `perf script -F comm,pid,tid,time,event,ip,sym,dso,period -i perf.data`
 * 的 stdout，格式示例：
 *
 *   mongod 911593/911593  12345.678901:    10000000 task-clock:
 *       ffff8001a3f4b0c8 arch_cpu_idle+0x18 ([kernel.kallsyms])
 *       aaaabb00c1234   mongo::FTDCController::doLoop+0x1 (/usr/bin/mongod)
 *       ffff7f9a2b00    deflate+0x40 (/usr/lib64/libz.so.1.2.11)
 *
 *   mongod 911593/911593  12345.688901:    10000000 task-clock:
 *       ...
 *
 * **Output**: 每个采样一条 PerfSample，含 comm/pid/period + stack[]，每帧带 `dso`。
 * 下游 analyze.ts 直接用 `frame.dso` 推模块，不再需要函数名硬编码。
 *
 * **Sample 边界**: 空行分隔（speedscope 行为一致）。
 * **栈方向**: perf script 原生是 leaf → root（叶子在最上），我们反转为 root → leaf
 * 以匹配 stackcollapse-perf.pl / FlameGraph 的约定（`main;func_a;func_b count`）。
 */

export interface PerfFrame {
  /** 函数名（已剥离 `+0x1a` 偏移后缀）*/
  fn: string;
  /** DSO（动态链接库/内核/binary 路径），如 `[kernel.kallsyms]` / `/usr/bin/mongod` / `/usr/lib64/libz.so.1.2.11` */
  dso: string;
}

export interface PerfSample {
  comm: string;
  pid: number;
  tid: number;
  time: number;
  eventName: string;
  /** 样本权重（task-clock 下 = 纳秒），缺失时默认 1 */
  period: number;
  /** 调用栈，root → leaf 顺序（即 main → ... → 热点叶子）*/
  stack: PerfFrame[];
}

/**
 * 头行正则：`comm pid[/tid]  time: [period ]event:`
 *
 * 例子：
 *   `mongod 911593/911593  12345.678901:    10000000 task-clock:`
 *   `swapper     0 [000] 12345.678:       cpu-clock:`
 *
 * - Group 1: comm
 * - Group 2: pid
 * - Group 3: tid（可选）
 * - Group 4: time（浮点）
 * - Group 5: period（可选整数；-F 不含 period 时为空）
 * - Group 6: event name
 */
const HEADER_RE = /^(\S.+?)\s+(\d+)(?:\/(\d+))?\s+(?:\[\d+\]\s+)?(\d+\.\d+):\s+(?:(\d+)\s+)?(\S+):\s*$/;

/**
 * 栈帧正则（Speedscope 同款）：`address  symbol+off (dso)`
 *
 * 宽松匹配 symbol（允许含空格/冒号/模板参数 —— C++ mangled 名），
 * dso 是最后一组圆括号里的内容。
 */
const FRAME_RE = /^\s*([0-9a-f]+)\s+(.+)\s+\((\S*)\)\s*$/;

/** 剥离 `+0x1a2b3c` 这类偏移后缀 */
function stripOffset(sym: string): string {
  return sym.replace(/\+0x[\da-f]+$/i, "").trim();
}

/**
 * 解析一个已切分好的 sample 文本块（不含尾部空行）→ PerfSample，失败返回 null。
 */
function parseOne(block: string[]): PerfSample | null {
  if (block.length === 0) return null;
  // 跳过以 # 开头的注释
  const lines = block.filter((l) => !l.startsWith("#"));
  if (lines.length === 0) return null;

  const header = lines[0]!;
  const m = HEADER_RE.exec(header);
  if (!m) return null;

  const comm = m[1]!;
  const pid = parseInt(m[2]!, 10);
  const tid = m[3] !== undefined ? parseInt(m[3]!, 10) : pid;
  const time = parseFloat(m[4]!);
  const period = m[5] !== undefined ? parseInt(m[5]!, 10) : 1;
  const eventName = m[6]!;

  const frames: PerfFrame[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fm = FRAME_RE.exec(lines[i]!);
    if (!fm) continue;
    const symRaw = fm[2]!;
    const dso = fm[3]! || "[unknown]";
    const fn = stripOffset(symRaw);
    if (!fn) continue;
    frames.push({ fn, dso });
  }
  // perf script 栈是 leaf-first，反转为 root-first（匹配 FlameGraph 习惯）
  frames.reverse();

  return { comm, pid, tid, time, eventName, period, stack: frames };
}

/**
 * 主入口：解析整段 perf script stdout，返回所有 sample。
 * 样本间用空行分隔。
 */
export function parsePerfScript(text: string): PerfSample[] {
  const out: PerfSample[] = [];
  let buf: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line === "") {
      if (buf.length > 0) {
        const s = parseOne(buf);
        if (s) out.push(s);
        buf = [];
      }
    } else {
      buf.push(line);
    }
  }
  if (buf.length > 0) {
    const s = parseOne(buf);
    if (s) out.push(s);
  }
  return out;
}

/**
 * DSO 路径 → 规范化模块名（业界对齐）。
 *
 * - `perf report` 的 "Shared Object" 列显示 DSO：`[kernel.kallsyms]` / `[vdso]` /
 *   `/usr/lib64/libc.so.6` 等
 * - `pprof` 显示 binary basename：`mongod` / `libc.so.6`
 *
 * 我们取折中：保留 `[kernel.kallsyms]` / `[vdso]` / `[unknown]` 这类方括号形式
 * （perf 惯用），用户态文件走 basename（pprof 惯用）。
 *
 * 注意：**不把任何函数名揉进"模块"语义**。"这个符号是不是 idle 空转"是另一维度
 * 的信息（由 IDLE_FUNCTIONS 单独维护，analyze 层做过滤），不应污染 DSO 列。
 */
export function moduleFromDso(dso: string): string {
  if (!dso || dso === "[unknown]") return "[unknown]";

  // 方括号形式原样保留（perf 约定：[kernel.kallsyms]、[vdso]、[vsyscall]、
  // [JIT] 等等）
  if (dso.startsWith("[") && dso.endsWith("]")) return dso;
  if (dso.includes("vmlinux")) return "[kernel.kallsyms]";

  // 用户态：basename
  const base = dso.split("/").pop() ?? dso;
  return base;
}

/**
 * CPU 空闲栈的典型符号（业界共识，见 Brendan Gregg 博客 + Linux 内核源码）。
 *
 * 作用：analyze 阶段默认过滤掉以这些符号**作为叶子**的采样，让真正的热点浮上来
 * （py-spy 同款 `--idle` 惯例）。注意这里**只影响过滤**，不再当作"模块标签"。
 */
export const IDLE_FUNCTIONS = new Set([
  "arch_cpu_idle",
  "arch_cpu_idle_enter",
  "arch_cpu_idle_exit",
  "cpuidle_enter",
  "cpuidle_enter_state",
  "cpuidle_idle_call",
  "cpu_startup_entry",
  "default_idle",
  "default_idle_call",
  "do_idle",
  "intel_idle",
  "mwait_idle",
  "acpi_idle_do_entry",
  "poll_idle",
  "native_safe_halt",
  "secondary_start_kernel",
  "start_kernel",
  "swapper",
]);
