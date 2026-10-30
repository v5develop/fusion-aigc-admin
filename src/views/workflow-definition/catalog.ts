/**
 * 编排页的「模型」「提示词」目录：节点面板的拖拽条目与属性面板的下拉共用这里的数据形状与格式化。
 * 模型组来自网关目录（listModelGroupOptions）并合并工作流工具总览（scope=all）里的就绪与价格；
 * 提示词来自提示词平台。两份列表都由 detail.vue 加载一次，再以 props 传给属性面板。
 */
import type { ModelGroupOption } from '@/api/ai-gateway';
import type { WorkflowToolRow } from '@/api/workflow-tools';

import { pagePrompts, type Prompt } from '@/api/prompt-lab';

export interface ModelGroupItem {
  code: string;
  /** 显示名；没有时界面回退为编码 */
  name?: string;
  operations: string[];
  /** false = 网关里已停用 */
  enabled: boolean;
  /** 总览里查不到（旧后端只返回已引用的组、或接口缺失）时为空 → 就绪与价格未知 */
  tool?: WorkflowToolRow;
}

export interface PromptItem {
  code: string;
  name: string;
  description?: string;
}

/** 节点面板「模型」页签的分组顺序；不在其中的操作归入「其他」 */
export const OPERATION_ORDER = [
  'image.generate',
  'image.edit',
  'video.generate',
  'video.enhance',
  'chat.completion',
] as const;

export const OTHER_OPERATION = 'other';

/** 操作分组的 locale 键 */
export function operationLabelKey(op: string): string {
  const known = (OPERATION_ORDER as readonly string[]).includes(op);
  return `workflowDefinition.catalog.op.${known ? op.replace(/\./g, '_') : OTHER_OPERATION}`;
}

/** 网关目录 + 总览行合并：任一侧出现的组都列出，操作取并集 */
export function mergeModelGroups(
  options: ModelGroupOption[] | null,
  tools: Map<string, WorkflowToolRow>,
): ModelGroupItem[] {
  const out = new Map<string, ModelGroupItem>();
  (options ?? []).forEach((g) => {
    if (!g?.code) return;
    out.set(g.code, {
      code: g.code,
      name: g.display_name && g.display_name !== g.code ? g.display_name : undefined,
      operations: Array.isArray(g.operations) ? [...g.operations] : [],
      enabled: g.enabled !== false,
      tool: tools.get(g.code),
    });
  });
  tools.forEach((row, code) => {
    const ops = row.operations?.length ? row.operations : row.operation ? [row.operation] : [];
    const hit = out.get(code);
    if (hit) {
      ops.forEach((op) => !hit.operations.includes(op) && hit.operations.push(op));
      if (!hit.name && row.displayName && row.displayName !== code) hit.name = row.displayName;
      return;
    }
    out.set(code, {
      code,
      name: row.displayName && row.displayName !== code ? row.displayName : undefined,
      operations: [...ops],
      enabled: true,
      tool: row,
    });
  });
  return [...out.values()].sort((a, b) => a.code.localeCompare(b.code));
}

/** 模型组的显示名：目录/总览给了显示名就用，否则 undefined */
export function modelGroupDisplayName(
  code: string,
  items: ModelGroupItem[],
  tools: Map<string, WorkflowToolRow>,
): string | undefined {
  const hit = items.find((i) => i.code === code)?.name;
  if (hit) return hit;
  const dn = tools.get(code)?.displayName;
  return dn && dn !== code ? dn : undefined;
}

export type Readiness = 'ready' | 'notReady' | 'unknown';

export function readinessOf(tool?: WorkflowToolRow): Readiness {
  if (tool?.ready === true) return 'ready';
  if (tool?.ready === false) return 'notReady';
  return 'unknown';
}

export const READINESS_COLOR: Record<Readiness, string> = {
  ready: 'green',
  notReady: 'red',
  unknown: 'default',
};

export const READINESS_LABEL_KEY: Record<Readiness, string> = {
  ready: 'workflowDefinition.tools.statusReady',
  notReady: 'workflowDefinition.tools.statusNotReady',
  unknown: 'workflowDefinition.tools.statusUnknown',
};

/**
 * 一行简短价格：第一个配置了价格模型的部署的最低一档「price currency / unit」，
 * 还有更多档位或部署时附「+N」。无价格信息返回 undefined（不显示）。
 */
export function shortPriceText(
  tool: WorkflowToolRow | undefined,
  t: (key: string, named?: Record<string, unknown>) => string,
): string | undefined {
  if (!tool?.prices.length) return undefined;
  const priced = tool.prices.filter((p) => p.priceModelCode !== null && p.components.length);
  if (!priced.length) return t('workflowDefinition.tools.noPrice');
  const first = priced[0];
  const cheapest = first.components.reduce((m, c) => (c.price < m.price ? c : m));
  const head = first.currency ? `${cheapest.price} ${first.currency}` : `${cheapest.price}`;
  const text = `${head} / ${cheapest.unit}`;
  const more = priced.reduce((n, p) => n + p.components.length, 0) - 1;
  return more > 0 ? `${text} ${t('workflowDefinition.catalog.priceMore', { count: more })}` : text;
}

const PROMPT_PAGE_SIZE = 100;
const PROMPT_MAX_PAGES = 20;

/**
 * 提示词平台里的模板（翻页取全）。agent 类型是智能体提示词，不是步骤的 templateCode，排除；
 * 其余类型（optimize 及将来新增的）都列出。只存在于文件中的模板不会出现在这里。
 */
export async function loadPromptItems(): Promise<PromptItem[]> {
  const first = await pagePrompts({ page: 1, pageSize: PROMPT_PAGE_SIZE });
  const all: Prompt[] = Array.isArray(first?.list) ? [...first.list] : [];
  const pages = Math.min(PROMPT_MAX_PAGES, Math.ceil((first?.total ?? 0) / PROMPT_PAGE_SIZE));
  if (pages > 1) {
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, i) =>
        pagePrompts({ page: i + 2, pageSize: PROMPT_PAGE_SIZE }),
      ),
    );
    rest.forEach((r) => all.push(...(Array.isArray(r?.list) ? r.list : [])));
  }
  const seen = new Set<string>();
  return all
    .filter((p) => p?.code && p.type !== 'agent')
    .filter((p) => (seen.has(p.code) ? false : (seen.add(p.code), true)))
    .map((p) => ({ code: p.code, name: p.name || p.code, description: p.description }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

export function matchesQuery(query: string, ...fields: (string | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  return !q || fields.some((f) => !!f && f.toLowerCase().includes(q));
}
