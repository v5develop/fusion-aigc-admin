/**
 * 工作流定义 → 只读流程图。纯函数，不依赖界面。
 *
 * 依赖有两种来源（与后端 DefinitionValidator / BindingResolver 的语义一致）：
 * - 显式依赖：步骤的 `after` 列表（控制流，实线）；
 * - 数据依赖：参数或 `when` 里的 `{"bind": "<步骤id>.output[.字段]"}`（数据流，虚线）。
 * `input.*` 与 `config.*` 不是步骤，不产生边；`a|b` 形式的多候选，每个候选都算依赖。
 */

export interface GraphNode {
  id: string;
  kind: string;
  /** 参数里绑定到的来源（去重），用于节点上的小字说明 */
  sources: string[];
  hasCondition: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  /** after：控制流；data：数据流 */
  type: 'after' | 'data';
}

export interface LaidOutNode extends GraphNode {
  x: number;
  y: number;
  layer: number;
}

export interface WorkflowGraph {
  nodes: LaidOutNode[];
  edges: GraphEdge[];
}

/** 解析失败（非 JSON、没有 steps、步骤结构不对、有环）时返回的原因码，界面据此给出提示。 */
export type GraphError = 'invalid_json' | 'no_steps' | 'bad_step' | 'cycle';

export const LAYER_GAP_X = 260;
export const ROW_GAP_Y = 120;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** 递归收集参数里的所有 bind 字符串。 */
function collectBinds(value: unknown, out: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectBinds(item, out));
    return;
  }
  if (!isRecord(value)) return;
  if (typeof value.bind === 'string') out.push(value.bind);
  Object.values(value).forEach((item) => collectBinds(item, out));
}

/** 绑定的每个候选的来源头：步骤 id、input 或 config。 */
function sourceHeads(bind: string, stepIds: Set<string>): string[] {
  return bind
    .split('|')
    .map((candidate) => candidate.trim().split('.')[0])
    .filter((head) => head === 'input' || head === 'config' || stepIds.has(head));
}

/** 绑定表达式里指向的上游步骤 id（input./config. 不算）。 */
function upstreamOf(bind: string, stepIds: Set<string>): string[] {
  return bind
    .split('|')
    .map((candidate) => candidate.trim().split('.')[0])
    .filter((head) => head && head !== 'input' && head !== 'config' && stepIds.has(head));
}

export function buildWorkflowGraph(
  source: string,
): { ok: true; graph: WorkflowGraph } | { ok: false; error: GraphError } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    return { ok: false, error: 'invalid_json' };
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
    return { ok: false, error: 'no_steps' };
  }

  const steps: { id: string; kind: string; after: string[]; binds: string[]; hasCondition: boolean }[] = [];
  for (const raw of parsed.steps) {
    if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.kind !== 'string') {
      return { ok: false, error: 'bad_step' };
    }
    const after = Array.isArray(raw.after) ? raw.after.filter((x): x is string => typeof x === 'string') : [];
    const binds: string[] = [];
    collectBinds(raw.params, binds);
    collectBinds(raw.when, binds);
    steps.push({ id: raw.id, kind: raw.kind, after, binds, hasCondition: isRecord(raw.when) });
  }

  const stepIds = new Set(steps.map((s) => s.id));
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  const addEdge = (from: string, to: string, type: GraphEdge['type']) => {
    if (from === to || !stepIds.has(from)) return;
    const key = `${from}->${to}`;
    if (seen.has(key)) {
      // 同一对步骤既有控制流又有数据流时，保留控制流（实线）
      const existing = edges.find((e) => e.source === from && e.target === to);
      if (existing && type === 'after') existing.type = 'after';
      return;
    }
    seen.add(key);
    edges.push({ id: key, source: from, target: to, type });
  };

  const predecessors = new Map<string, Set<string>>();
  for (const step of steps) {
    const preds = new Set<string>();
    step.after.forEach((p) => {
      if (stepIds.has(p)) {
        preds.add(p);
        addEdge(p, step.id, 'after');
      }
    });
    step.binds.forEach((bind) =>
      upstreamOf(bind, stepIds).forEach((p) => {
        preds.add(p);
        addEdge(p, step.id, 'data');
      }),
    );
    predecessors.set(step.id, preds);
  }

  // 最长路径分层：层号 = 所有前驱的最大层号 + 1；遇到环则报错
  const layerOf = new Map<string, number>();
  const visiting = new Set<string>();
  const layerFor = (id: string): number => {
    const known = layerOf.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) throw new Error('cycle');
    visiting.add(id);
    let layer = 0;
    predecessors.get(id)?.forEach((p) => {
      layer = Math.max(layer, layerFor(p) + 1);
    });
    visiting.delete(id);
    layerOf.set(id, layer);
    return layer;
  };
  try {
    steps.forEach((s) => layerFor(s.id));
  } catch {
    return { ok: false, error: 'cycle' };
  }

  // 同一层内按声明顺序纵向排列
  const rowInLayer = new Map<number, number>();
  const nodes: LaidOutNode[] = steps.map((s) => {
    const layer = layerOf.get(s.id) ?? 0;
    const row = rowInLayer.get(layer) ?? 0;
    rowInLayer.set(layer, row + 1);
    const sources = [...new Set(s.binds.flatMap((b) => sourceHeads(b, stepIds)))];
    return {
      id: s.id,
      kind: s.kind,
      sources,
      hasCondition: s.hasCondition,
      layer,
      x: layer * LAYER_GAP_X,
      y: row * ROW_GAP_Y,
    };
  });

  return { ok: true, graph: { nodes, edges } };
}
