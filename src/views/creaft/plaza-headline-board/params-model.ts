import type { HeadlineParamMeta } from '@/api/plaza-admin';

/**
 * 头条参数的表单模型。Go 的参数是嵌套对象（velocity.min-base、weight.decay 是点路径），
 * 说明与范围由 GET /params 的 meta 下发，这里只补页面分组与步长。
 */

export type ParamKind = 'number' | 'boolean' | 'enum';

export interface ParamField {
  key: string;
  label: string;
  group: string;
  kind: ParamKind;
  min: number;
  max: number;
  step: number;
}

/** 点路径取值：velocity.min-base → obj.velocity['min-base'] */
export function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const k of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

export function setPath(obj: unknown, path: string, value: unknown): void {
  const keys = path.split('.');
  let cur = obj as Record<string, unknown>;
  for (const k of keys.slice(0, -1)) {
    if (cur[k] === null || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  cur[keys[keys.length - 1]] = value;
}

const GROUPS: [string, string[]][] = [
  ['榜单规模', ['top-n', 'max-visible', 'global-top-n', 'max-per-media']],
  [
    '评分',
    [
      'half-life-hours',
      'velocity.min-base',
      'velocity.min',
      'velocity.max',
      'fresh-days',
      'weight.decay',
      'weight.velocity',
      'weight.fresh',
      'weight.users',
      'weight.ctr',
      'score-normalize',
      'norm-scale',
    ],
  ],
  ['入选门槛', ['min-decayed', 'min-unique-users', 'rel-min-ratio', 'display-min-uses']],
  ['稳定性', ['hysteresis-delta', 'min-dwell-minutes', 'max-rank-move']],
  ['防刷', ['per-user-daily-cap', 'rapid-dedupe-seconds']],
  ['冷启动与保留', ['cold-start-fill', 'snapshot-retention-days']],
];

const INTEGER_KEYS = new Set([
  'top-n',
  'max-visible',
  'global-top-n',
  'max-per-media',
  'fresh-days',
  'min-unique-users',
  'display-min-uses',
  'min-dwell-minutes',
  'max-rank-move',
  'per-user-daily-cap',
  'rapid-dedupe-seconds',
  'snapshot-retention-days',
  'half-life-hours',
]);

const SMALL_STEP_KEYS = new Set(['hysteresis-delta', 'rel-min-ratio']);

export const SCORE_NORMALIZE_OPTIONS = [
  { label: 'none（不归一化）', value: 'none' },
  { label: 'scope_max（按范围归一化衰减项）', value: 'scope_max' },
];

/** 表单字段：以 meta 为准（meta 里没有的键不渲染），按页面分组排序 */
export function buildFields(meta: HeadlineParamMeta[]): ParamField[] {
  const byKey = new Map(meta.map((m) => [m.key, m]));
  const out: ParamField[] = [];
  const used = new Set<string>();
  for (const [group, keys] of GROUPS) {
    for (const key of keys) {
      const m = byKey.get(key);
      if (!m) continue;
      used.add(key);
      out.push(toField(m, group));
    }
  }
  // 服务端新增、页面尚未归组的键：放「其他」，不丢
  for (const m of meta) if (!used.has(m.key)) out.push(toField(m, '其他'));
  return out;
}

function toField(m: HeadlineParamMeta, group: string): ParamField {
  const kind: ParamKind =
    m.key === 'score-normalize' ? 'enum' : m.key === 'cold-start-fill' ? 'boolean' : 'number';
  const step = INTEGER_KEYS.has(m.key) ? 1 : SMALL_STEP_KEYS.has(m.key) ? 0.05 : 0.1;
  return { key: m.key, label: m.note || m.key, group, kind, min: m.min, max: m.max, step };
}

export function groupFields(fields: ParamField[]): { name: string; fields: ParamField[] }[] {
  const map = new Map<string, ParamField[]>();
  for (const f of fields) {
    if (!map.has(f.group)) map.set(f.group, []);
    map.get(f.group)!.push(f);
  }
  return Array.from(map, ([name, fs]) => ({ name, fields: fs }));
}

export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
