/**
 * 链路耗时类别：code → 顺序 / 颜色 / i18n key。详情页与分析页共用，颜色只在这里定义。
 * 顺序即链路先后（用于堆叠条、图例排序）；未知类别归 other。
 */
export interface LatencyCategoryMeta {
  code: string;
  order: number;
  color: string;
}

export const LATENCY_CATEGORIES: readonly LatencyCategoryMeta[] = [
  { code: 'queue', order: 1, color: '#faad14' },
  { code: 'billing', order: 2, color: '#13c2c2' },
  { code: 'moderation', order: 3, color: '#eb2f96' },
  { code: 'input_transfer', order: 4, color: '#2f54eb' },
  { code: 'gateway_queue', order: 5, color: '#fa8c16' },
  { code: 'vendor', order: 6, color: '#722ed1' },
  { code: 'postprocess', order: 7, color: '#1677ff' },
  { code: 'delivery', order: 8, color: '#52c41a' },
  { code: 'settle', order: 9, color: '#a0d911' },
  { code: 'other', order: 10, color: '#8c8c8c' },
];

const BY_CODE = new Map(LATENCY_CATEGORIES.map((c) => [c.code, c]));

export function normalizeCategory(code: unknown): string {
  return typeof code === 'string' && BY_CODE.has(code) ? code : 'other';
}

export function categoryColor(code: unknown): string {
  return BY_CODE.get(normalizeCategory(code))!.color;
}

export function categoryOrder(code: unknown): number {
  return BY_CODE.get(normalizeCategory(code))!.order;
}

/** 按链路顺序排序（不改原数组） */
export function sortByCategory<T extends { category: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => categoryOrder(a.category) - categoryOrder(b.category));
}

/** i18n key；调用方 t(categoryI18nKey(code)) */
export function categoryI18nKey(code: unknown): string {
  return `latency.category.${normalizeCategory(code)}`;
}

/** 毫秒 → 紧凑字符串（与链路瀑布一致） */
export { formatDuration } from '@/views/creation/task/trace-helpers';
