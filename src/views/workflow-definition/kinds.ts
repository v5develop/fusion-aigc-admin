/**
 * 步骤类型的分组与显示名。分组规则只在这里维护：先查精确映射，再按 kind 前缀归组，其余归「其他」。
 * 显示名取 locale `workflowDefinition.kinds.<kind 点换下划线>.name`，缺失时回退到 schema 描述，再回退到原始 kind。
 */

export type KindGroup = 'generate' | 'prompt' | 'media' | 'deliver' | 'other';

/** 面板里分组的显示顺序 */
export const KIND_GROUP_ORDER: KindGroup[] = ['generate', 'prompt', 'media', 'deliver', 'other'];

const EXACT_GROUP: Record<string, KindGroup> = {
  'gateway.call': 'generate',
  'aigc.local': 'generate',
  deliver: 'deliver',
};

const PREFIX_GROUP: [string, KindGroup][] = [
  ['prompt.', 'prompt'],
  ['media.', 'media'],
  ['local.', 'deliver'],
];

export function kindGroupOf(kind: string): KindGroup {
  if (EXACT_GROUP[kind]) return EXACT_GROUP[kind];
  const hit = PREFIX_GROUP.find(([prefix]) => kind.startsWith(prefix));
  return hit ? hit[1] : 'other';
}

/** locale 键：`workflowDefinition.kinds.<kind 点换下划线>.name` */
export function kindNameKey(kind: string): string {
  return `workflowDefinition.kinds.${kind.replace(/\./g, '_')}.name`;
}

/**
 * 步骤类型的中文（当前语言）显示名。
 * te/t 由调用方的 useI18n 传入，description 为 schema 描述。
 */
export function kindDisplayName(
  kind: string,
  te: (key: string) => boolean,
  t: (key: string) => string,
  description?: string,
): string {
  if (!kind) return '';
  const key = kindNameKey(kind);
  if (te(key)) return t(key);
  if (description) return description.split(/[，,；;（(]/)[0] || description;
  return kind;
}

/** 分组配色（节点左侧色条、面板条目） */
export const KIND_GROUP_COLOR: Record<KindGroup, string> = {
  generate: '#722ed1',
  prompt: '#1677ff',
  media: '#13a8a8',
  deliver: '#52c41a',
  other: '#8c8c8c',
};
