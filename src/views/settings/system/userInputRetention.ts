/** 用户输入图片保留策略的纯判断逻辑（与后端 1..3650 的取值范围一致）。 */
export const USER_INPUT_RETENTION_MIN_DAYS = 1;
export const USER_INPUT_RETENTION_MAX_DAYS = 3650;

export interface RetentionState {
  keepForever: boolean;
  retentionDays: number;
}

/** 合法天数返回整数，否则返回 null（非数字、非整数、越界都算非法）。 */
export function normalizeRetentionDays(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n)) return null;
  if (n < USER_INPUT_RETENTION_MIN_DAYS || n > USER_INPUT_RETENTION_MAX_DAYS) return null;
  return n;
}

/**
 * 是否是会让更多数据被删除的变更，需要二次确认：
 * - 改为永久保留：从不删除，不需要确认；
 * - 从永久保留切为按天清理：需要确认；
 * - 已在按天清理时调低天数：需要确认；调高或不变不需要。
 */
export function isDestructiveRetentionChange(prev: RetentionState, next: RetentionState): boolean {
  if (next.keepForever) return false;
  if (prev.keepForever) return true;
  return next.retentionDays < prev.retentionDays;
}
