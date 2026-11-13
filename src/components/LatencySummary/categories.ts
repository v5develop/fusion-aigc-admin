/**
 * 链路耗时类别：code → 顺序 / 颜色 / i18n key。详情页与分析页共用，颜色只在这里定义。
 * 顺序即链路先后（用于堆叠条、图例排序）；未知类别归 other。
 */
import { pickColor, type DualColor } from '../trace-theme';

export interface LatencyCategoryMeta {
  code: string;
  order: number;
  /** 亮 / 暗两套低饱和色；唯一定义处 */
  color: DualColor;
}

export const LATENCY_CATEGORIES: readonly LatencyCategoryMeta[] = [
  { code: 'queue', order: 1, color: { light: '#d89614', dark: '#b8923a' } },
  { code: 'billing', order: 2, color: { light: '#13a8a8', dark: '#3f9ea0' } },
  { code: 'moderation', order: 3, color: { light: '#d4478a', dark: '#b8628c' } },
  { code: 'input_transfer', order: 4, color: { light: '#3f5fd6', dark: '#6b80c9' } },
  { code: 'gateway_queue', order: 5, color: { light: '#d4701a', dark: '#c0804a' } },
  { code: 'vendor', order: 6, color: { light: '#8a4fd0', dark: '#9378c4' } },
  { code: 'postprocess', order: 7, color: { light: '#1677ff', dark: '#4f8fd6' } },
  { code: 'delivery', order: 8, color: { light: '#3da81f', dark: '#5fa04f' } },
  { code: 'settle', order: 9, color: { light: '#8fb80f', dark: '#98a84a' } },
  { code: 'other', order: 10, color: { light: '#8c8c8c', dark: '#6e6e6e' } },
];

const BY_CODE = new Map(LATENCY_CATEGORIES.map((c) => [c.code, c]));

export function normalizeCategory(code: unknown): string {
  return typeof code === 'string' && BY_CODE.has(code) ? code : 'other';
}

/** 类别实色；dark 传 useIsDark().value（echarts 等拿不到 CSS 变量的场景） */
export function categoryColor(code: unknown, dark = false): string {
  return pickColor(BY_CODE.get(normalizeCategory(code))!.color, dark);
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
