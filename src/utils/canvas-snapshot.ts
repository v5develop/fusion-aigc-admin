/**
 * 画布快照（Vue Flow 原生 {nodes, edges}）的解析、运行态剥离与连线校验。
 *
 * 规则与后端保持一致（fusion_aigc_go docs/api/api-canvas.md 第 5、6 章；服务端保存时仍会再校验一遍，
 * 这里是体验层的前置校验，避免运营保存后才被打回）。
 */

export interface CanvasNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, any>;
  [key: string]: unknown;
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type?: string;
  data?: Record<string, any>;
  [key: string]: unknown;
}

export interface Snapshot {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

/** 快照整体上限（api-canvas.md 1.7） */
export const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024;

/** 运行态字段：模型节点与工具节点的这些字段不随模板存储，服务端保存时会剥离（api-canvas.md 0.1） */
const RUNTIME_KEYS = [
  'status',
  'progress',
  'runId',
  'requestId',
  'errorMessage',
  'requestedCount',
  'candidates',
  'selectedCandidate',
  'image',
  'video',
  'assetId',
  'resultText',
  'resultImage',
  'tryonResults',
];

/** 允许出现 data: 等字符串的文本字段（api-canvas.md 2.4） */
const TEXT_KEYS = new Set([
  'text',
  'prompt',
  'title',
  'subtitle',
  'maskPrompt',
  'resultText',
  'name',
  'label',
]);

/** 参考图族（归一后都记为 image 口，共用 maxImageRefs 名额）：image / image1 / image2 / first / last / image-in 之外的图片口 */
const IMAGE_FAMILY = new Set(['image', 'image1', 'image2', 'first', 'last']);
/** 节点 data 的路径（仅这一层的文本键豁免，连线 data 与嵌套 data 不豁免） */
const NODE_DATA_PATH = /^nodes\[\d+\]\.data$/;
/** 图片口接受的来源（服务端 accepts：image 口 = image / model / video / tool） */
const IMAGE_SOURCE_TYPES = new Set(['image', 'model', 'video', 'tool']);

export function parseSnapshot(
  text: string,
): { ok: true; snapshot: Snapshot } | { ok: false; error: string } {
  if (!text || !text.trim()) return { ok: false, error: '请填写 snapshot' };
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `JSON 格式错误：${(e as Error).message}` };
  }
  if (!v || typeof v !== 'object' || Array.isArray(v))
    return { ok: false, error: '应为 {nodes, edges} 对象' };
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o.nodes) || !Array.isArray(o.edges))
    return { ok: false, error: 'nodes 与 edges 必须是数组' };
  const isObj = (x: unknown): x is Record<string, unknown> =>
    !!x && typeof x === 'object' && !Array.isArray(x);
  for (const n of o.nodes) {
    if (!isObj(n) || typeof n.id !== 'string' || typeof n.type !== 'string')
      return { ok: false, error: '节点缺少 id 或 type' };
    if (n.data !== undefined && !isObj(n.data))
      return { ok: false, error: `节点 ${n.id} 的 data 应为对象` };
  }
  for (const e of o.edges) {
    if (
      !isObj(e) ||
      typeof e.id !== 'string' ||
      typeof e.source !== 'string' ||
      typeof e.target !== 'string'
    )
      return { ok: false, error: '连线缺少 id、source 或 target' };
  }
  return { ok: true, snapshot: { nodes: o.nodes as CanvasNode[], edges: o.edges as CanvasEdge[] } };
}

/** 深拷贝后删除模型 / 工具节点的运行态字段 */
export function stripRuntime(snap: Snapshot): Snapshot {
  const copy: Snapshot = JSON.parse(JSON.stringify(snap));
  for (const n of copy.nodes) {
    if ((n.type === 'model' || n.type === 'tool') && n.data && typeof n.data === 'object') {
      for (const k of RUNTIME_KEYS) delete n.data[k];
    }
  }
  return copy;
}

export function nodeLabel(n: CanvasNode): string {
  const title = n.data?.title || n.id;
  switch (n.type) {
    case 'text':
      return `文字：${title}`;
    case 'image':
      return `${n.data?.kind === 'result' ? '图片结果' : '图片输入'}：${title}`;
    case 'video':
      return `视频输入：${title}`;
    case 'model':
      return `${n.data?.kind === 'video' ? '视频生成' : '图片生成'}：${title}`;
    case 'tool':
      return `工具 ${n.data?.tool ?? ''}：${title}`;
    case 'module':
      return `分组：${title}`;
    default:
      return `${n.type}：${title}`;
  }
}

/** 找出 data: / blob: / file: 开头的图片字段（文本字段豁免） */
export function findInlineURLs(snap: Snapshot): string[] {
  const bad: string[] = [];
  const isBad = (s: string) => /^(data:|blob:|file:)/i.test(s);
  const walk = (v: unknown, path: string, depth: number) => {
    if (typeof v === 'string') {
      if (isBad(v)) bad.push(path);
      return;
    }
    if (Array.isArray(v)) {
      v.forEach((x, i) => walk(x, `${path}[${i}]`, depth + 1));
      return;
    }
    if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        // 节点 data 第一层的文本键豁免
        if (NODE_DATA_PATH.test(path) && TEXT_KEYS.has(k)) continue;
        walk(x, path ? `${path}.${k}` : k, depth + 1);
      }
    }
  };
  walk(snap, '', 0);
  return bad;
}

function reachable(edges: CanvasEdge[], from: string, to: string): boolean {
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === to) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const e of edges) if (e.source === cur) stack.push(e.target);
  }
  return false;
}

/**
 * 校验一条待添加的连线。返回错误文案，合法返回 null。
 * edges 为当前已有的连线（不含待添加这一条）。
 */
/**
 * 参考图上限，与服务端 DefaultImageLimit 一致：data.maxImageRefs 优先；视频模型 2；
 * 模型 Image 14 / Banana 5；其它 3。
 */
export function defaultImageLimit(dst: CanvasNode): number {
  const v = dst.data?.maxImageRefs;
  if (typeof v === 'number' && v > 0) return v;
  if (dst.type === 'model' && dst.data?.kind === 'video') return 2;
  if (dst.data?.model === 'Image') return 14;
  if (dst.data?.model === 'Banana') return 5;
  return 3;
}

/**
 * 校验一条待添加的连线（规则与服务端 app/canvas/rpc/internal/logic/validate.go 一致）。
 * 返回错误文案，合法返回 null。edges 为当前已有的连线（不含待添加这一条）。
 */
export function validateEdge(
  snap: Snapshot,
  edges: CanvasEdge[],
  conn: {
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  },
): string | null {
  const byId = new Map(snap.nodes.map((n) => [n.id, n]));
  const src = byId.get(conn.source);
  const dst = byId.get(conn.target);
  if (!src || !dst) return '连线引用的节点不存在';
  if (src.id === dst.id) return '不能连到自己';

  const sh = conn.sourceHandle ?? '';
  const th = conn.targetHandle ?? '';
  const dup = edges.some(
    (e) =>
      e.source === conn.source &&
      e.target === conn.target &&
      (e.sourceHandle ?? '') === sh &&
      (e.targetHandle ?? '') === th,
  );
  if (dup) return '这两个口之间已经有连线';

  // 目标只能是模型节点、试穿工具、结果图片节点（服务端 checkTarget）
  const tryon = dst.type === 'tool' && dst.data?.tool === 'tryon';
  const result = dst.type === 'image' && dst.data?.kind === 'result';
  if (dst.type !== 'model' && !tryon && !result) return `「${nodeLabel(dst)}」没有输入口`;
  if (result && th !== 'image-in') return '结果图片只有一个输入口';
  if (tryon && th !== 'garment' && th !== 'models') return '试穿节点只有服装和模特两个输入口';

  // 来源与数量
  const into = (names: string[]) =>
    edges.filter((e) => e.target === dst.id && names.includes(e.targetHandle ?? '')).length;

  if (result) {
    if (!IMAGE_SOURCE_TYPES.has(src.type)) return '结果图片只收图片类来源';
    if (into(['image-in']) >= 1) return '结果图片只能接一条线';
  } else if (tryon) {
    if (!IMAGE_SOURCE_TYPES.has(src.type)) return '试穿输入只收图片类来源';
    if (th === 'garment' && into(['garment']) >= 1) return '服装口只能接一条线';
    if (th === 'models' && into(['models']) >= 9) return '模特口最多接 9 条线';
  } else if (th === 'prompt') {
    const textOK = src.type === 'text' || (src.type === 'tool' && src.data?.tool === 'i2p');
    if (!textOK) return '提示词口只收文字节点或反推工具的输出';
    if (into(['prompt']) >= 1) return '提示词口只能接一条线，请先删除原连线';
  } else if (th === 'video') {
    if (!(src.type === 'model' && src.data?.kind === 'video'))
      return '参考视频口只收视频模型的输出';
    if (into(['video']) >= 1) return '参考视频口只能接一条线';
  } else if (th === 'audio') {
    return '音频参考暂未接入';
  } else if (IMAGE_FAMILY.has(th)) {
    if (!IMAGE_SOURCE_TYPES.has(src.type)) return '参考图口只收图片、模型或工具的输出';
    // 视频模型的首图 / 次图口各 1 条（服务端 portLimit）
    if (dst.data?.kind === 'video' && (th === 'image1' || th === 'image2') && into([th]) >= 1)
      return `${th} 口只能接一条线`;
    if (into([...IMAGE_FAMILY]) >= defaultImageLimit(dst))
      return `节点「${nodeLabel(dst)}」的参考图最多接 ${defaultImageLimit(dst)} 条`;
  } else {
    return '请连到有编号的输入端口';
  }

  // 成环：从目标出发能走回来源，就会形成环
  if (reachable(edges, conn.target, conn.source)) return '会形成环，不能连接';
  return null;
}

/** 整体校验：节点 id 唯一、连线端点存在、逐条连线规则、无内联图片、大小上限。返回全部错误。 */
export function validateSnapshot(snap: Snapshot, rawText?: string): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const n of snap.nodes) {
    if (ids.has(n.id)) errors.push(`节点 id 重复：${n.id}`);
    ids.add(n.id);
  }
  const accepted: CanvasEdge[] = [];
  for (const e of snap.edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) {
      errors.push(`连线 ${e.id} 引用的节点不存在`);
      continue;
    }
    const err = validateEdge(snap, accepted, e);
    if (err) errors.push(`连线 ${e.id}：${err}`);
    accepted.push(e);
  }
  for (const p of findInlineURLs(snap)) errors.push(`不能是 data: / blob: 地址，请先上传：${p}`);
  const bytes = new TextEncoder().encode(rawText ?? JSON.stringify(snap)).length;
  if (bytes > MAX_SNAPSHOT_BYTES) errors.push('画布内容超过 2MB');
  return errors;
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
