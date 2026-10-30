import type { CreaftSkillConfigSchema } from '@/api/creaft-compat';

/**
 * 技能执行配置（afv_compat_agent_skill.config）与可视化表单之间的互转，纯函数、不碰 Vue。
 *
 * 配置里单段提示词上万字，丢一个键就是静默抹掉线上内容，所以这里的约定是：
 * 表单不认识的键原样带回，原配置里没有且没填的键不凭空长出来，只解析再回写时内容不变。
 */

export type SkillShape = 'react' | 'localLife' | 'overrides';

/**
 * 智能体技能才有的键；判断「是不是智能体技能」只看它们有没有出现。与后端 CompatAgentSkillConfigService.REACT_FIELDS 一致：
 * 不含 tags——工作流形态的技能同样可以带 tags，把它算进来会让一条本地生活技能被当成智能体技能编辑。
 */
export const REACT_KEYS = ['system_prompt', 'planner_prompt', 'respond_prompt', 'tools'];

export interface ToolModel {
  name: string;
  descriptionOverride: string;
  extra: Record<string, unknown>;
}

export interface FreeOverride {
  key: string;
  value: string;
  /** 加载时的键名；新加的行没有。重名时优先保留键名没被改过的那一行 */
  originalKey?: string;
}

export interface SkillConfigModel {
  prompts: Record<string, string>;
  tags: string[];
  tools: ToolModel[];
  /** 覆盖提示词的唯一来源 */
  overrides: Record<string, string>;
  /** 顶层不认识的键 */
  extra: Record<string, unknown>;
  /** 原配置里出现过的顶层键 */
  had: Set<string>;
}

export function emptyModel(): SkillConfigModel {
  return { prompts: {}, tags: [], tools: [], overrides: {}, extra: {}, had: new Set() };
}

export function parseConfig(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function stageKeys(schema: CreaftSkillConfigSchema | null): Set<string> {
  return new Set((schema?.localLifeStages || []).map((s) => s.key));
}

export function toModel(
  config: Record<string, unknown>,
  schema: CreaftSkillConfigSchema | null,
): SkillConfigModel {
  const { tool_prompt_overrides: overrides, tags, tools, ...rest } = config;
  const prompts: Record<string, string> = {};
  for (const field of schema?.promptFields || []) {
    // 只接管字符串；类型不对的值留在 extra 里原样带回，而不是被改写成空串
    if (typeof rest[field.key] === 'string') {
      prompts[field.key] = rest[field.key] as string;
      delete rest[field.key];
    } else if (!(field.key in rest)) {
      prompts[field.key] = '';
    }
  }
  const overrideMap: Record<string, string> = {};
  const extra: Record<string, unknown> = { ...rest };
  if (overrides !== undefined) {
    if (
      overrides &&
      typeof overrides === 'object' &&
      !Array.isArray(overrides) &&
      Object.values(overrides).every((v) => typeof v === 'string')
    ) {
      Object.assign(overrideMap, overrides);
    } else {
      // 形状不对（不是字符串映射）：不接管，原样放回，由原文 JSON 处理
      extra.tool_prompt_overrides = overrides;
    }
  }
  let toolModels: ToolModel[] = [];
  if (Array.isArray(tools) && tools.every((t) => t && typeof t === 'object' && !Array.isArray(t))) {
    toolModels = tools.map((tool) => {
      const {
        name,
        description_override: descriptionOverride,
        ...toolExtra
      } = tool as Record<string, unknown>;
      return {
        name: String(name ?? ''),
        descriptionOverride: typeof descriptionOverride === 'string' ? descriptionOverride : '',
        extra:
          descriptionOverride === undefined || typeof descriptionOverride === 'string'
            ? toolExtra
            : { ...toolExtra, description_override: descriptionOverride },
      };
    });
  } else if (tools !== undefined) {
    extra.tools = tools;
  }
  let tagList: string[] = [];
  if (Array.isArray(tags) && tags.every((t) => typeof t === 'string')) tagList = tags as string[];
  else if (tags !== undefined) extra.tags = tags;
  return {
    prompts,
    tags: tagList,
    tools: toolModels,
    overrides: overrideMap,
    extra,
    had: new Set(Object.keys(config)),
  };
}

/** 形态：有智能体键就是智能体技能；本地生活技能编码或出现分段键就是行业技能；否则只有覆盖 */
export function detectShape(
  config: Record<string, unknown>,
  schema: CreaftSkillConfigSchema | null,
  skillCode: string,
  model: SkillConfigModel,
): SkillShape {
  const keys = Object.keys(config);
  if (keys.some((k) => REACT_KEYS.includes(k))) return 'react';
  const stages = stageKeys(schema);
  if (
    (schema?.localLifeSkillCodes || []).includes(skillCode) ||
    Object.keys(model.overrides).some((k) => stages.has(k))
  )
    return 'localLife';
  return keys.length ? 'overrides' : 'react';
}

/** 行业技能形态下分段键在上面逐条编辑；其余的键进自由列表 */
export function freeRows(
  model: SkillConfigModel,
  shape: SkillShape,
  schema: CreaftSkillConfigSchema | null,
): FreeOverride[] {
  const fixed = shape === 'localLife' ? stageKeys(schema) : new Set<string>();
  return Object.entries(model.overrides)
    .filter(([key]) => !fixed.has(key))
    .map(([key, value]) => ({ key, value, originalKey: key }));
}

/**
 * 自由列表里每一行的问题：键名为空、与分段重名（行业技能形态下）、与前面某一行重名。有问题的行不写回配置——
 * 否则输入键名途中恰好拼出某个分段名（style_transform_v2 输到 style_transform），那一刻的空值就会冲掉上万字的分段；
 * 两行同名时后一行也会悄悄盖掉前一行。返回与 rows 同序的提示，没问题为空串。
 */
export function freeRowProblems(
  rows: FreeOverride[],
  shape: SkillShape,
  schema: CreaftSkillConfigSchema | null,
): string[] {
  const stages = shape === 'localLife' ? stageKeys(schema) : new Set<string>();
  // 先让「键名没被改过」的行占住自己的键：用户把 A 行误改成 B 行的键名时，标红的应该是改动的 A 行，
  // 而不是原封未动、可能装着上万字的 B 行
  const claimed = new Map<string, number>();
  rows.forEach((row, index) => {
    const key = row.key.trim();
    if (key && key === row.originalKey && !stages.has(key) && !claimed.has(key))
      claimed.set(key, index);
  });
  const seen = new Set<string>();
  return rows.map((row, index) => {
    const key = row.key.trim();
    if (!key) return row.value ? '键名不能为空' : '';
    if (stages.has(key)) return '与上面的分段同名，请直接在分段里编辑';
    const owner = claimed.get(key);
    if ((owner !== undefined && owner !== index) || (owner === undefined && seen.has(key)))
      return '与另一行同名';
    seen.add(key);
    return '';
  });
}

/** 把「分段」与「自由列表」两块收拢回一个映射：自由列表改了键名时旧键随之消失；有问题的行不写回 */
export function collectOverrides(
  model: SkillConfigModel,
  rows: FreeOverride[],
  shape: SkillShape,
  schema: CreaftSkillConfigSchema | null,
): Record<string, string> {
  const next: Record<string, string> = {};
  if (shape === 'localLife') {
    for (const key of stageKeys(schema))
      if (model.overrides[key] !== undefined) next[key] = model.overrides[key];
  }
  const problems = freeRowProblems(rows, shape, schema);
  rows.forEach((row, index) => {
    if (!problems[index] && row.key.trim()) next[row.key.trim()] = row.value;
  });
  return next;
}

export function buildConfig(
  model: SkillConfigModel,
  shape: SkillShape,
  schema: CreaftSkillConfigSchema | null,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...model.extra };
  const tools = () =>
    model.tools.map((t) => ({
      ...t.extra,
      name: t.name,
      description_override: t.descriptionOverride,
    }));
  for (const field of schema?.promptFields || []) {
    if (!(field.key in model.prompts)) continue;
    const value = model.prompts[field.key] || '';
    // 智能体形态下填了就写；其它形态只保留原有的，不因为切了一下形态就丢或多出键
    if (model.had.has(field.key) || (shape === 'react' && value)) out[field.key] = value;
  }
  if (model.had.has('tags') && !('tags' in out)) out.tags = model.tags;
  else if (shape === 'react' && model.tags.length && !('tags' in out)) out.tags = model.tags;
  if (model.had.has('tools') && !('tools' in out)) out.tools = tools();
  else if (shape === 'react' && model.tools.length && !('tools' in out)) out.tools = tools();
  if (!('tool_prompt_overrides' in out)) {
    // 空值不写：留空的分段等同于没配（服务端只取非空），写进去只会让「缺段」看起来像配了
    const overrides: Record<string, string> = {};
    for (const [key, value] of Object.entries(model.overrides)) if (value) overrides[key] = value;
    if (Object.keys(overrides).length || model.had.has('tool_prompt_overrides'))
      out.tool_prompt_overrides = overrides;
  }
  return out;
}

/** 键排序后的序列化：判断「内容有没有变」用，不受键顺序与缩进影响 */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
