/**
 * 工作流定义 ↔ 流程图。纯函数，不依赖界面，便于单测。
 *
 * 依赖有两种来源（与后端 DefinitionValidator / BindingResolver 的语义一致）：
 * - 显式依赖：步骤的 `after` 列表（控制流，实线）；
 * - 数据依赖：参数或 `when` 里的 `{"bind": "<步骤id>.output[.字段]"}`（数据流，虚线）。
 * `input.*` 与 `config.*` 不是步骤，不产生边；`a|b` 形式的多候选，每个候选都算依赖。
 *
 * 编辑操作（加/删步骤、连/断线、改 id、改参数）都作用在已解析的定义对象上，
 * 返回新对象、不改入参；画布上的一条实线 = 目标步骤的 `after` 含源步骤。
 */

export interface GraphNode {
  id: string;
  kind: string;
  /** 参数里绑定到的来源（去重），用于节点上的小字说明 */
  sources: string[];
  hasCondition: boolean;
  /** gateway.call 步骤的模型组引用；其它步骤或未填写时为 undefined */
  modelGroup?: ModelGroupRef;
}

/** 字面量模型组可查网关就绪状态；绑定（bind）在运行时才解析，无法预先判断 */
export type ModelGroupRef = { kind: 'literal'; value: string } | { kind: 'runtime' };

/** 与后端 GatewayCallStepExecutor.KIND 一致 */
export const GATEWAY_CALL_KIND = 'gateway.call';

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

export type GraphResult = { ok: true; graph: WorkflowGraph } | { ok: false; error: GraphError };

/** 定义对象：顶层是 JSON 对象，未知字段（billing、outputs 等）原样保留。 */
export type DefinitionObject = Record<string, unknown>;
export type StepObject = Record<string, unknown>;

/** 编辑被拒绝的原因码，界面据此给出提示。 */
export type EditError =
  | 'invalid_json'
  | 'unknown_step'
  | 'self_loop'
  | 'already_connected'
  | 'not_connected'
  | 'data_edge'
  | 'cycle'
  | 'empty_id'
  | 'invalid_id'
  | 'duplicate_id';

export type EditResult = { ok: true; def: DefinitionObject } | { ok: false; error: EditError };

export const LAYER_GAP_X = 260;
export const ROW_GAP_Y = 120;

/** 与后端 DefinitionValidator.STEP_ID 一致 */
export const STEP_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** `{ bind: '...' }` 形式的绑定值 */
export function isBindValue(v: unknown): v is { bind: string; optional?: boolean } {
  return isRecord(v) && typeof v.bind === 'string';
}

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

/**
 * gateway.call 步骤的模型组引用（与后端 GatewayModelGroupRefs 口径一致）：
 * 非空字面量 → literal（去首尾空白）；bind → runtime；空白、缺省或其它 → undefined。
 */
export function modelGroupRefOf(step: unknown): ModelGroupRef | undefined {
  if (!isRecord(step) || step.kind !== GATEWAY_CALL_KIND || !isRecord(step.params)) return undefined;
  const group = step.params.modelGroup;
  // 字面量可以是裸字符串，也可以是运行时同样接受的 {"value": x} 包装（试点与转换器的写法）
  const literal =
    typeof group === 'string'
      ? group
      : isRecord(group) && Object.keys(group).length === 1 && typeof group.value === 'string'
        ? group.value
        : undefined;
  if (literal !== undefined) {
    return literal.trim() ? { kind: 'literal', value: literal.trim() } : undefined;
  }
  return isBindValue(group) ? { kind: 'runtime' } : undefined;
}

export interface NodePosition {
  x: number;
  y: number;
}

/** 画布坐标表（步骤 id → {x, y}）里坐标合法的项。坐标不属于定义，单独存取，不参与校验。 */
export function sanitizeLayout(layout: unknown): Record<string, NodePosition> {
  const out: Record<string, NodePosition> = {};
  if (!isRecord(layout)) return out;
  Object.entries(layout).forEach(([id, pos]) => {
    if (isRecord(pos) && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
      out[id] = { x: Number(pos.x), y: Number(pos.y) };
    }
  });
  return out;
}

/** 只保留定义里仍存在的步骤的坐标，坐标取整。 */
export function pruneLayout(
  layout: Record<string, NodePosition>,
  def: DefinitionObject,
): Record<string, NodePosition> {
  const ids = stepIdSet(def);
  const out: Record<string, NodePosition> = {};
  Object.entries(layout).forEach(([id, p]) => {
    if (ids.has(id) && Number.isFinite(p.x) && Number.isFinite(p.y)) {
      out[id] = { x: Math.round(p.x), y: Math.round(p.y) };
    }
  });
  return out;
}

/** 步骤改名后把坐标挪到新 id 下。 */
export function renameInLayout(
  layout: Record<string, NodePosition>,
  oldId: string,
  newId: string,
): Record<string, NodePosition> {
  if (!layout[oldId] || oldId === newId) return { ...layout };
  const out = { ...layout, [newId]: layout[oldId] };
  delete out[oldId];
  return out;
}

// ---------------------------------------------------------------------------
// 解析与画图
// ---------------------------------------------------------------------------

/** 文本 → 定义对象；顶层必须是 JSON 对象。 */
export function parseDefinition(
  source: string,
): { ok: true; def: DefinitionObject } | { ok: false; error: 'invalid_json'; message: string } {
  try {
    const parsed: unknown = JSON.parse(source);
    if (!isRecord(parsed)) return { ok: false, error: 'invalid_json', message: 'not an object' };
    return { ok: true, def: parsed };
  } catch (e) {
    return { ok: false, error: 'invalid_json', message: (e as Error).message };
  }
}

/** 定义对象 → 文本（两格缩进），与编辑器格式化一致。 */
export function serializeDefinition(def: DefinitionObject): string {
  return JSON.stringify(def, null, 2);
}

/** 定义对象 → 流程图。allowEmpty=true 时空 steps 返回空图（编辑态从空白开始）。 */
export function buildGraphFromDefinition(
  parsed: unknown,
  options: { allowEmpty?: boolean; layout?: Record<string, NodePosition> } = {},
): GraphResult {
  if (!isRecord(parsed) || !Array.isArray(parsed.steps)) {
    return { ok: false, error: 'no_steps' };
  }
  if (parsed.steps.length === 0) {
    return options.allowEmpty
      ? { ok: true, graph: { nodes: [], edges: [] } }
      : { ok: false, error: 'no_steps' };
  }

  const steps: {
    id: string;
    kind: string;
    after: string[];
    binds: string[];
    hasCondition: boolean;
    modelGroup?: ModelGroupRef;
  }[] = [];
  for (const raw of parsed.steps) {
    if (!isRecord(raw) || typeof raw.id !== 'string' || !raw.id || typeof raw.kind !== 'string') {
      return { ok: false, error: 'bad_step' };
    }
    // 重复 id 只画第一个（画布节点 id 必须唯一）；重复本身由即时校验报出
    if (steps.some((s) => s.id === raw.id)) continue;
    const after = Array.isArray(raw.after)
      ? raw.after.filter((x): x is string => typeof x === 'string')
      : [];
    const binds: string[] = [];
    collectBinds(raw.params, binds);
    collectBinds(raw.when, binds);
    steps.push({
      id: raw.id,
      kind: raw.kind,
      after,
      binds,
      hasCondition: isRecord(raw.when),
      modelGroup: modelGroupRefOf(raw),
    });
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
    const preds = predecessors.get(step.id) ?? new Set<string>();
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

  // 最长路径分层：层号 = 所有前驱的最大层号 + 1；遇到环（含自环）则报错
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

  // 同一层内按声明顺序纵向排列；坐标表里有的以坐标表为准
  const layout = options.layout ?? {};
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
      ...(s.modelGroup ? { modelGroup: s.modelGroup } : {}),
      layer,
      x: layout[s.id]?.x ?? layer * LAYER_GAP_X,
      y: layout[s.id]?.y ?? row * ROW_GAP_Y,
    };
  });

  return { ok: true, graph: { nodes, edges } };
}

/** 文本 → 流程图（只读视图用）。 */
export function buildWorkflowGraph(
  source: string,
  options: { allowEmpty?: boolean } = {},
): GraphResult {
  const parsed = parseDefinition(source);
  if (!parsed.ok) return { ok: false, error: 'invalid_json' };
  return buildGraphFromDefinition(parsed.def, options);
}

// ---------------------------------------------------------------------------
// 编辑操作（不改入参，返回新对象）
// ---------------------------------------------------------------------------

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** 定义里的步骤（只取对象项） */
export function stepsOf(def: DefinitionObject): StepObject[] {
  return Array.isArray(def.steps) ? def.steps.filter(isRecord) : [];
}

export function findStep(def: DefinitionObject, id: string): StepObject | undefined {
  return stepsOf(def).find((s) => s.id === id);
}

function stepIdSet(def: DefinitionObject): Set<string> {
  return new Set(
    stepsOf(def)
      .map((s) => s.id)
      .filter((x): x is string => typeof x === 'string'),
  );
}

function afterOf(step: StepObject): string[] {
  return Array.isArray(step.after)
    ? step.after.filter((x): x is string => typeof x === 'string')
    : [];
}

function setAfter(step: StepObject, after: string[]): void {
  if (after.length) step.after = after;
  else delete step.after;
}

/** 由 kind 派生一个合法且不重复的步骤 id（如 `image_generate_2`）。 */
export function uniqueStepId(def: DefinitionObject, base: string): string {
  let stem = base
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^[_-]+/, '')
    .replace(/[_-]+$/, '');
  if (!stem) stem = 'step';
  const ids = stepIdSet(def);
  if (!ids.has(stem)) return stem;
  let n = 2;
  while (ids.has(`${stem}_${n}`)) n++;
  return `${stem}_${n}`;
}

/** 加一个步骤；after 非空时同时连到该上游步骤。 */
export function addStep(
  def: DefinitionObject,
  kind: string,
  after?: string,
): { def: DefinitionObject; id: string } {
  const next = clone(def);
  const id = uniqueStepId(next, kind);
  const step: StepObject = { id, kind, params: {} };
  if (after && stepIdSet(next).has(after)) step.after = [after];
  const steps = Array.isArray(next.steps) ? next.steps : [];
  steps.push(step);
  next.steps = steps;
  return { def: next, id };
}

/** 删一个步骤，并把它从其它步骤的 after 里摘掉。绑定到它的 bind 保留，交给校验报错。 */
export function removeStep(def: DefinitionObject, id: string): DefinitionObject {
  const next = clone(def);
  if (!Array.isArray(next.steps)) return next;
  next.steps = next.steps.filter((s) => !(isRecord(s) && s.id === id));
  stepsOf(next).forEach((s) => {
    const after = afterOf(s);
    if (after.includes(id))
      setAfter(
        s,
        after.filter((x) => x !== id),
      );
  });
  return next;
}

/** 连线 source → target：target.after 加入 source。拒绝自环、重复、成环。 */
export function connectSteps(def: DefinitionObject, source: string, target: string): EditResult {
  if (source === target) return { ok: false, error: 'self_loop' };
  const next = clone(def);
  const t = findStep(next, target);
  if (!t || !findStep(next, source)) return { ok: false, error: 'unknown_step' };
  const after = afterOf(t);
  if (after.includes(source)) return { ok: false, error: 'already_connected' };
  setAfter(t, [...after, source]);
  const graph = buildGraphFromDefinition(next, { allowEmpty: true });
  if (!graph.ok && graph.error === 'cycle') return { ok: false, error: 'cycle' };
  return { ok: true, def: next };
}

/** 断线 source → target：从 target.after 里去掉 source。纯数据依赖（bind）不能在画布上断。 */
export function disconnectSteps(def: DefinitionObject, source: string, target: string): EditResult {
  const next = clone(def);
  const t = findStep(next, target);
  if (!t) return { ok: false, error: 'unknown_step' };
  const after = afterOf(t);
  if (!after.includes(source)) {
    const binds: string[] = [];
    collectBinds(t.params, binds);
    collectBinds(t.when, binds);
    const bound = binds.some((b) => upstreamOf(b, new Set([source])).length > 0);
    return { ok: false, error: bound ? 'data_edge' : 'not_connected' };
  }
  setAfter(
    t,
    after.filter((x) => x !== source),
  );
  return { ok: true, def: next };
}

/** 把 bind 表达式里每个以 oldId 开头的候选改成 newId。 */
function renameBind(bind: string, oldId: string, newId: string): string {
  return bind
    .split('|')
    .map((candidate) => {
      const trimmed = candidate.trim();
      const head = trimmed.split('.')[0];
      if (head !== oldId) return candidate;
      return candidate.replace(trimmed, newId + trimmed.slice(oldId.length));
    })
    .join('|');
}

function renameBindsDeep(value: unknown, oldId: string, newId: string): void {
  if (Array.isArray(value)) {
    value.forEach((item) => renameBindsDeep(item, oldId, newId));
    return;
  }
  if (!isRecord(value)) return;
  if (typeof value.bind === 'string') value.bind = renameBind(value.bind, oldId, newId);
  Object.values(value).forEach((item) => renameBindsDeep(item, oldId, newId));
}

/** 改步骤 id：同步改 after 引用、各步骤参数/条件和 outputs 里的 bind。 */
export function renameStep(def: DefinitionObject, oldId: string, newId: string): EditResult {
  const id = newId.trim();
  if (!id) return { ok: false, error: 'empty_id' };
  if (!STEP_ID_PATTERN.test(id)) return { ok: false, error: 'invalid_id' };
  if (id === oldId) return { ok: true, def: clone(def) };
  if (stepIdSet(def).has(id)) return { ok: false, error: 'duplicate_id' };
  const next = clone(def);
  const step = findStep(next, oldId);
  if (!step) return { ok: false, error: 'unknown_step' };
  step.id = id;
  stepsOf(next).forEach((s) => {
    const after = afterOf(s);
    if (after.includes(oldId))
      setAfter(
        s,
        after.map((x) => (x === oldId ? id : x)),
      );
    renameBindsDeep(s.params, oldId, id);
    renameBindsDeep(s.when, oldId, id);
  });
  renameBindsDeep(next.outputs, oldId, id);
  // outputs 的值可能直接是绑定表达式字符串
  if (isRecord(next.outputs)) {
    const outputs = next.outputs;
    Object.entries(outputs).forEach(([k, v]) => {
      if (typeof v === 'string') outputs[k] = renameBind(v, oldId, id);
    });
  }
  return { ok: true, def: next };
}

/** 改步骤的某个顶层字段（kind、when…）；value 为 undefined 时删除该字段。 */
export function setStepField(
  def: DefinitionObject,
  id: string,
  field: string,
  value: unknown,
): EditResult {
  const next = clone(def);
  const step = findStep(next, id);
  if (!step) return { ok: false, error: 'unknown_step' };
  if (value === undefined) delete step[field];
  else step[field] = clone(value);
  return { ok: true, def: next };
}

/** 改步骤的一个参数；value 为 undefined 时删除该参数。 */
export function setStepParam(
  def: DefinitionObject,
  id: string,
  name: string,
  value: unknown,
): EditResult {
  const next = clone(def);
  const step = findStep(next, id);
  if (!step) return { ok: false, error: 'unknown_step' };
  const params = isRecord(step.params) ? step.params : {};
  if (value === undefined) delete params[name];
  else params[name] = clone(value);
  step.params = params;
  return { ok: true, def: next };
}

// ---------------------------------------------------------------------------
// 校验错误 → 步骤
// ---------------------------------------------------------------------------

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 校验错误文本里点名的步骤 id：`steps[2]` 形式的路径按下标取，
 * 其余按 id 作为完整词出现（前后不是 id 字符）来认。
 */
export function stepIdsInError(text: string, def: DefinitionObject): string[] {
  const steps = stepsOf(def);
  const hit = new Set<string>();
  for (const m of text.matchAll(/steps\[(\d+)\]/g)) {
    const s = steps[Number(m[1])];
    if (s && typeof s.id === 'string') hit.add(s.id);
  }
  steps.forEach((s) => {
    if (typeof s.id !== 'string' || !s.id) return;
    const re = new RegExp(`(^|[^A-Za-z0-9_-])${escapeRegExp(s.id)}(?![A-Za-z0-9_-])`);
    if (re.test(text)) hit.add(s.id);
  });
  return [...hit];
}

// ---------------------------------------------------------------------------
// 即时校验（前端预检，规则与后端 DefinitionValidator / BindingRef 对齐；保存时仍以服务端校验为准）
// ---------------------------------------------------------------------------

/** 预检用到的步骤类型说明（与接口 step-kinds/schema 同形，只取用到的字段） */
export interface KindSchemaLike {
  kind: string;
  params?: { name: string; required?: boolean }[];
  outputs?: string[];
}

export type LocalIssueCode =
  | 'empty_id'
  | 'invalid_id'
  | 'duplicate_id'
  | 'unknown_kind'
  | 'missing_param'
  | 'missing_after'
  | 'cycle'
  | 'bad_bind'
  | 'unknown_input'
  | 'unknown_step_ref'
  | 'not_upstream'
  | 'unknown_output';

export interface LocalIssue {
  code: LocalIssueCode;
  /** 出问题的步骤 id；outputs 等非步骤位置为 undefined */
  stepId?: string;
  /** 步骤在 steps[] 里的下标（id 为空时用它定位） */
  index?: number;
  /** 参数名、引用的 id、bind 表达式等，界面拼进提示 */
  detail?: string;
}

/**
 * 纯前端预检。kinds 为 null 表示步骤类型清单尚未加载（或接口缺失），跳过 kind / 必填参数 / 输出字段检查；
 * kinds 只有名称（string[]）时只检查 kind 是否存在。
 */
export function validateDefinitionLocal(
  def: DefinitionObject,
  kinds: readonly (KindSchemaLike | string)[] | null,
): LocalIssue[] {
  const issues: LocalIssue[] = [];
  const schemaByKind = new Map<string, KindSchemaLike>();
  const kindNames = new Set<string>();
  (kinds ?? []).forEach((k) => {
    if (typeof k === 'string') kindNames.add(k);
    else {
      kindNames.add(k.kind);
      schemaByKind.set(k.kind, k);
    }
  });

  const rawSteps = Array.isArray(def.steps) ? def.steps : [];
  const seen = new Set<string>();
  const stepIds = new Set<string>();
  const kindOfStep = new Map<string, string>();
  rawSteps.forEach((raw, index) => {
    const step = isRecord(raw) ? raw : {};
    const id = typeof step.id === 'string' ? step.id.trim() : '';
    if (!id) {
      issues.push({ code: 'empty_id', index });
      return;
    }
    if (!STEP_ID_PATTERN.test(id)) issues.push({ code: 'invalid_id', stepId: id, index });
    if (seen.has(id)) issues.push({ code: 'duplicate_id', stepId: id, index });
    seen.add(id);
    stepIds.add(id);
    if (typeof step.kind === 'string') kindOfStep.set(id, step.kind);
  });

  // 祖先只按 after 计算（与后端一致：bind 不建立依赖，只能引用 after 链上的祖先）
  const afterById = new Map<string, string[]>();
  stepsOf(def).forEach((s) => {
    if (typeof s.id === 'string' && s.id) afterById.set(s.id, afterOf(s));
  });

  rawSteps.forEach((raw, index) => {
    if (!isRecord(raw) || typeof raw.id !== 'string' || !raw.id.trim()) return;
    const id = raw.id;
    const kind = typeof raw.kind === 'string' ? raw.kind : '';
    if (kinds !== null && !kindNames.has(kind)) {
      issues.push({ code: 'unknown_kind', stepId: id, index, detail: kind });
    }
    const schema = schemaByKind.get(kind);
    const params = isRecord(raw.params) ? raw.params : {};
    schema?.params?.forEach((p) => {
      const v = params[p.name];
      if (p.required && (v === undefined || v === null || v === '')) {
        issues.push({ code: 'missing_param', stepId: id, index, detail: p.name });
      }
    });
    afterOf(raw).forEach((dep) => {
      if (!stepIds.has(dep)) issues.push({ code: 'missing_after', stepId: id, index, detail: dep });
    });
  });

  // 环：只看 after（后端口径）
  const state = new Map<string, 1 | 2>();
  const inCycle = new Set<string>();
  const visit = (id: string, path: string[]): void => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) {
      path.slice(path.indexOf(id)).forEach((x) => inCycle.add(x));
      return;
    }
    state.set(id, 1);
    (afterById.get(id) ?? []).forEach((dep) => {
      if (afterById.has(dep)) visit(dep, [...path, id]);
    });
    state.set(id, 2);
  };
  afterById.forEach((_, id) => visit(id, []));
  inCycle.forEach((id) => issues.push({ code: 'cycle', stepId: id }));

  const ancestorCache = new Map<string, Set<string>>();
  const ancestorsOf = (id: string, guard = new Set<string>()): Set<string> => {
    const cached = ancestorCache.get(id);
    if (cached) return cached;
    const out = new Set<string>();
    if (guard.has(id)) return out;
    guard.add(id);
    (afterById.get(id) ?? []).forEach((dep) => {
      out.add(dep);
      ancestorsOf(dep, guard).forEach((x) => out.add(x));
    });
    if (!inCycle.has(id)) ancestorCache.set(id, out);
    return out;
  };

  const inputs = isRecord(def.inputs) ? def.inputs : {};
  const checkBind = (bind: string, owner: string | undefined, visible: Set<string> | null) => {
    const push = (code: LocalIssueCode, detail: string) =>
      issues.push({ code, stepId: owner, detail });
    if (!bind.trim()) {
      push('bad_bind', bind);
      return;
    }
    bind.split('|').forEach((candidate) => {
      const text = candidate.trim();
      const parts = text.split('.');
      if (parts.length < 2 || !parts[1]) {
        push('bad_bind', text);
        return;
      }
      const [head, second] = parts;
      if (head === 'input' || head === 'config') {
        if (parts.length !== 2) push('bad_bind', text);
        else if (head === 'input' && !(second in inputs)) push('unknown_input', second);
        return;
      }
      if (second !== 'output') {
        push('bad_bind', text);
        return;
      }
      if (!stepIds.has(head)) {
        push('unknown_step_ref', head);
        return;
      }
      if (visible && !visible.has(head)) {
        push('not_upstream', head);
        return;
      }
      const field = parts.slice(2).join('.');
      const outputs = schemaByKind.get(kindOfStep.get(head) ?? '')?.outputs ?? [];
      if (field && outputs.length && !outputs.includes(field.split('.')[0])) {
        push('unknown_output', `${head}.output.${field}`);
      }
    });
  };

  stepsOf(def).forEach((s) => {
    if (typeof s.id !== 'string' || !s.id) return;
    const binds: string[] = [];
    collectBinds(s.params, binds);
    collectBinds(s.when, binds);
    const visible = inCycle.has(s.id) ? null : ancestorsOf(s.id);
    binds.forEach((b) => checkBind(b, s.id as string, visible));
  });

  // outputs 里的 {bind}（与后端一样只查对象形式）；可见所有步骤
  const outputBinds: string[] = [];
  collectBinds(def.outputs, outputBinds);
  outputBinds.forEach((b) => checkBind(b, undefined, null));

  return issues;
}

/** 按步骤 id 归组预检问题，节点标红用。 */
export function issuesByStep(issues: LocalIssue[]): Map<string, LocalIssue[]> {
  const map = new Map<string, LocalIssue[]>();
  issues.forEach((i) => {
    if (!i.stepId) return;
    const list = map.get(i.stepId) ?? [];
    list.push(i);
    map.set(i.stepId, list);
  });
  return map;
}
