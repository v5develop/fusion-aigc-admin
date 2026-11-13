import type { TaskSpan, TaskSpanService, TaskSpanStatus, TaskSpans } from '@/api/creation-task';

import { formatDuration } from '@/views/creation/task/trace-helpers';

import { pickColor, type DualColor, type ToneName } from '../trace-theme';

/**
 * 统一链路（spans）瀑布图的纯函数：规范化、建树、扁平化、时间轴换算、轮询决策。
 * 不依赖 Vue / DOM / 时钟（now 由调用方传入），后端字段一律可能为 null 或出现未知枚举值，这里统一兜住。
 */

export { formatDuration };

const SERVICES: readonly TaskSpanService[] = [
  'java',
  'go',
  'media',
  'gateway',
  'gpu',
  'admin',
  'user',
];
const STATUSES: readonly TaskSpanStatus[] = [
  'ok',
  'failed',
  'running',
  'cancelled',
  'timeout',
  'skipped',
  'pending',
];

export function normalizeService(v: unknown): TaskSpanService {
  return SERVICES.includes(v as TaskSpanService) ? (v as TaskSpanService) : 'java';
}

export function normalizeStatus(v: unknown): TaskSpanStatus {
  return STATUSES.includes(v as TaskSpanStatus) ? (v as TaskSpanStatus) : 'pending';
}

/** 服务徽标色调（TraceTag 的 tone；亮 / 暗两套在 trace-theme 的 TONES 里） */
export function serviceTone(v: unknown): ToneName {
  switch (normalizeService(v)) {
    case 'go':
      return 'cyan';
    case 'media':
      return 'orange';
    case 'gateway':
      return 'purple';
    case 'gpu':
      return 'magenta';
    case 'admin':
      return 'gold';
    case 'user':
      return 'green';
    default:
      return 'blue';
  }
}

/** 状态实色（亮 / 暗两套，低饱和）；条、图标、图例共用 */
export const STATUS_COLORS: Record<TaskSpanStatus, DualColor> = {
  ok: { light: '#52b02c', dark: '#4f9a45' },
  failed: { light: '#e5484d', dark: '#c9585b' },
  timeout: { light: '#e07b39', dark: '#c4713f' },
  running: { light: '#1677ff', dark: '#4f8fd6' },
  cancelled: { light: '#8c8c8c', dark: '#7a7a7a' },
  skipped: { light: '#a6a6a6', dark: '#666666' },
  pending: { light: '#bfbfbf', dark: '#595959' },
};

/** 状态 → 标签色调 */
export function statusTone(v: unknown): ToneName {
  switch (normalizeStatus(v)) {
    case 'ok':
      return 'green';
    case 'failed':
      return 'red';
    case 'timeout':
      return 'orange';
    case 'running':
      return 'blue';
    default:
      return 'gray';
  }
}

/** dark 传 useIsDark().value */
export function statusColor(v: unknown, dark = false): string {
  return pickColor(STATUS_COLORS[normalizeStatus(v)], dark);
}

/** 失败类状态 */
export function isBadStatus(v: unknown): boolean {
  const s = normalizeStatus(v);
  return s === 'failed' || s === 'timeout';
}

/** ISO 字符串 / 毫秒时间戳 → 毫秒；解析失败 null */
export function parseTs(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = Date.parse(String(v));
  return Number.isNaN(n) ? null : n;
}

export interface SpanNode {
  span: TaskSpan;
  service: TaskSpanService;
  status: TaskSpanStatus;
  startMs: number | null;
  endMs: number | null;
  /** 在原数组中的下标，排序稳定用 */
  order: number;
  children: SpanNode[];
}

/**
 * 建树：parentId 找不到（孤儿）或成环的 span 一律挂到根；兄弟按 startAt 升序，无时间的保持原序。
 * 返回根节点列表与 id → 节点映射。
 */
export function buildSpanTree(spans: readonly TaskSpan[] | null | undefined): {
  roots: SpanNode[];
  byId: Map<string, SpanNode>;
} {
  const byId = new Map<string, SpanNode>();
  const nodes: SpanNode[] = [];
  (spans || []).forEach((s, order) => {
    if (!s || s.id == null || byId.has(s.id)) return;
    const node: SpanNode = {
      span: s,
      service: normalizeService(s.service),
      status: normalizeStatus(s.status),
      startMs: parseTs(s.startAt),
      endMs: parseTs(s.endAt),
      order,
      children: [],
    };
    byId.set(s.id, node);
    nodes.push(node);
  });
  const roots: SpanNode[] = [];
  // 沿 parent 链走能回到自己 → 成环，挂根
  const cyclic = (n: SpanNode) => {
    const seen = new Set<string>([n.span.id]);
    let cur = n.span.parentId ? byId.get(n.span.parentId) : undefined;
    while (cur) {
      if (seen.has(cur.span.id)) return true;
      seen.add(cur.span.id);
      cur = cur.span.parentId ? byId.get(cur.span.parentId) : undefined;
    }
    return false;
  };
  for (const n of nodes) {
    const parent = n.span.parentId ? byId.get(n.span.parentId) : undefined;
    if (parent && parent !== n && !cyclic(n)) parent.children.push(n);
    else roots.push(n);
  }
  const cmp = (a: SpanNode, b: SpanNode) => {
    if (a.startMs != null && b.startMs != null && a.startMs !== b.startMs)
      return a.startMs - b.startMs;
    return a.order - b.order;
  };
  roots.sort(cmp);
  for (const n of nodes) n.children.sort(cmp);
  return { roots, byId };
}

export interface FlatRow {
  node: SpanNode;
  depth: number;
  hasChildren: boolean;
  collapsed: boolean;
}

/** 按折叠集合把树扁平成可见行（前序） */
export function flattenTree(roots: readonly SpanNode[], collapsed: ReadonlySet<string>): FlatRow[] {
  const out: FlatRow[] = [];
  const walk = (n: SpanNode, depth: number) => {
    const isCollapsed = collapsed.has(n.span.id) && n.children.length > 0;
    out.push({ node: n, depth, hasChildren: n.children.length > 0, collapsed: isCollapsed });
    if (!isCollapsed) for (const c of n.children) walk(c, depth + 1);
  };
  for (const r of roots) walk(r, 0);
  return out;
}

/** span 的祖先 id（由近到远） */
export function ancestorIds(byId: Map<string, SpanNode>, id: string | null | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  let cur = id ? byId.get(id) : undefined;
  while (cur?.span.parentId && !seen.has(cur.span.parentId)) {
    seen.add(cur.span.parentId);
    out.push(cur.span.parentId);
    cur = byId.get(cur.span.parentId);
  }
  return out;
}

export interface Axis {
  t0: number;
  /** 总跨度（ms，至少 1） */
  span: number;
}

/**
 * 时间轴：起点取 startedAt 与最早 span 的较小者；终点取 endedAt、各 span 结束时刻、
 * 以及（未终态时）now 的最大者。运行中的 span 终点 = now（不早于它自己的 start）。
 */
export function computeAxis(data: TaskSpans, nodes: Iterable<SpanNode>, now: number): Axis {
  let t0 = parseTs(data.startedAt);
  let t1 = parseTs(data.endedAt);
  for (const n of nodes) {
    if (n.startMs != null) t0 = t0 == null ? n.startMs : Math.min(t0, n.startMs);
    const e = spanEnd(n, now);
    if (e != null) t1 = t1 == null ? e : Math.max(t1, e);
  }
  if (t0 == null) return { t0: 0, span: 1 };
  if (t1 == null || t1 <= t0) t1 = t0 + 1;
  return { t0, span: t1 - t0 };
}

/** 渲染用终点；运行中取 now；其余无 endAt 时用 start + durationMs */
export function spanEnd(n: SpanNode, now: number): number | null {
  if (n.endMs != null) return n.endMs;
  if (n.startMs == null) return null;
  if (n.status === 'running') return Math.max(now, n.startMs);
  const d = n.span.durationMs;
  return d != null && Number.isFinite(d) ? n.startMs + d : n.startMs;
}

export interface BarGeom {
  /** 0~100 */
  left: number;
  width: number;
  /** 点事件（零时长且非运行中）用菱形 */
  point: boolean;
  running: boolean;
}

export function barGeom(n: SpanNode, axis: Axis, now: number): BarGeom | null {
  if (n.startMs == null) return null;
  const end = spanEnd(n, now) ?? n.startMs;
  const running = n.status === 'running' && n.endMs == null;
  const point = !running && end - n.startMs <= 0;
  const left = clamp(((n.startMs - axis.t0) / axis.span) * 100, 0, 100);
  const width = clamp(((end - n.startMs) / axis.span) * 100, 0, 100 - left);
  return { left, width, point, running };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

/** 行展示耗时：优先后端 durationMs；运行中用 now - start；其余 null */
export function spanDurationMs(n: SpanNode, now: number): number | null {
  const d = n.span.durationMs;
  if (d != null && Number.isFinite(d)) return d;
  if (n.startMs == null) return null;
  const end = n.endMs ?? (n.status === 'running' ? now : null);
  return end == null ? null : Math.max(0, end - n.startMs);
}

const TICK_STEPS_MS: readonly number[] = [
  1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000, 15_000, 30_000, 60_000, 120_000,
  300_000, 600_000, 900_000, 1_800_000, 3_600_000, 7_200_000, 14_400_000, 43_200_000, 86_400_000,
];

/** 刻度文字：0 / 500ms / 30s / 1min / 1min 30s / 1h 30min（不带小数、不带 +） */
export function formatTick(ms: number): string {
  if (ms <= 0) return '0';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s ? `${m}min ${s}s` : `${m}min`;
  }
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return m ? `${h}h ${m}min` : `${h}h`;
}

/**
 * 「整数」刻度：步长取 1/2/5×10^n（秒以上用 15/30 等自然进位），
 * 选出使刻度数（含 0）不超过 maxTicks 的最小步长；pct 为相对总跨度的百分比。
 */
export function niceTicks(axis: Axis, maxTicks = 7): { pct: number; label: string }[] {
  const span = Math.max(1, axis.span);
  let step = TICK_STEPS_MS[TICK_STEPS_MS.length - 1]!;
  for (const s of TICK_STEPS_MS) {
    if (Math.floor(span / s) + 1 <= maxTicks) {
      step = s;
      break;
    }
  }
  const out: { pct: number; label: string }[] = [];
  for (let t = 0; t <= span + 1e-6; t += step) {
    out.push({ pct: (t / span) * 100, label: formatTick(t) });
  }
  return out;
}

/**
 * 拆分展示名：「主名称（括号说明）」→ main + note；开头的「工作流步骤 」等通用前缀单独拆出，弱化显示。
 * 没有括号 / 前缀时对应字段为空串。
 */
export function splitLabel(label: string): { prefix: string; main: string; note: string } {
  let rest = label.trim();
  let prefix = '';
  const pm = /^(工作流步骤|网关调用|网关尝试|网关转存产物)\s+(\S.*)$/.exec(rest);
  if (pm && pm[1] === '工作流步骤') {
    prefix = pm[1];
    rest = pm[2]!;
  }
  let note = '';
  const m = /^(.*?)\s*[（(](.+)[)）]$/.exec(rest);
  if (m && m[1]) {
    rest = m[1];
    note = m[2]!;
  }
  return { prefix, main: rest, note };
}

/** 失败类 span 的一句话摘要，用于头部与「错误信息」卡片 */
export function failureSummary(span: TaskSpan | null | undefined): string {
  const f = span?.failure;
  if (!f) return '';
  return f.message || [f.class, f.code].filter(Boolean).join(' / ');
}

/** 时间线：所有 span 按开始时间升序（无时间的排最后，保持原序） */
export function sortSpansByTime(spans: readonly TaskSpan[] | null | undefined): TaskSpan[] {
  return (spans || [])
    .map((s, i) => ({ s, i, t: parseTs(s?.startAt) }))
    .filter((x) => !!x.s)
    .sort((a, b) => {
      if (a.t == null && b.t == null) return a.i - b.i;
      if (a.t == null) return 1;
      if (b.t == null) return -1;
      return a.t - b.t || a.i - b.i;
    })
    .map((x) => x.s);
}

/** 取失败 span（failingSpanId 优先，找不到则取第一个失败类 span） */
export function pickFailingSpan(data: TaskSpans | null | undefined): TaskSpan | null {
  if (!data) return null;
  const spans = data.spans || [];
  if (data.failingSpanId) {
    const hit = spans.find((s) => s?.id === data.failingSpanId);
    if (hit) return hit;
  }
  return null;
}

// ======================== 轮询决策 ========================

/** 只含会推进的字段；排除 now 之类每次都变的值，退避才有效 */
export function spansFingerprint(data: TaskSpans | null | undefined): string {
  if (!data) return '';
  return JSON.stringify([
    data.terminal,
    data.endedAt,
    data.stuckSpanId,
    data.failingSpanId,
    data.summary?.deliveredAt,
    (data.spans || []).map((s) =>
      s
        ? [s.id, s.parentId, s.status, s.startAt, s.endAt, s.durationMs, s.attempt, s.failure?.code]
        : null,
    ),
  ]);
}

/** terminal=true 停；未终态继续；连续失败达上限停 */
export function shouldStopSpansPolling(
  data: Pick<TaskSpans, 'terminal'> | null | undefined,
  failures: number,
  maxFailures: number,
): 'terminal' | 'failures' | null {
  if (failures >= maxFailures) return 'failures';
  return data?.terminal ? 'terminal' : null;
}

/** 整体状态：失败 > 进行中 > 完成 */
export function overallStatus(
  data: TaskSpans | null | undefined,
): 'failed' | 'running' | 'ok' | 'empty' {
  if (!data || !(data.spans || []).length) return 'empty';
  if (data.failingSpanId) return 'failed';
  if (!data.terminal) return 'running';
  const bad = data.spans.some((s) => isBadStatus(s?.status));
  return bad ? 'failed' : 'ok';
}
