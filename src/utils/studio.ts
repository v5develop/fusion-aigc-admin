import type { Dayjs } from 'dayjs';

/** 批次状态：0 排队 1 切图中 2 反推中 3 生图中 4 全部成功 5 全部失败 6 部分成功 7 已取消 8 提交中（逐张冻结点数，通常看不到） */
export const BATCH_STATUS: Record<number, { text: string; color: string }> = {
  0: { text: '排队', color: 'default' },
  1: { text: '切图中', color: 'processing' },
  2: { text: '反推中', color: 'processing' },
  3: { text: '生图中', color: 'processing' },
  4: { text: '全部成功', color: 'success' },
  5: { text: '全部失败', color: 'error' },
  6: { text: '部分成功', color: 'warning' },
  7: { text: '已取消', color: 'default' },
  8: { text: '提交中', color: 'processing' },
};

/** 批次终态：4–7（8 提交中不是终态，不能用 >= 4 判断） */
export const BATCH_TERMINAL_STATUSES: readonly number[] = [4, 5, 6, 7];

/** 子任务状态：0 排队 1 生成中 2 成功 3 失败 4 已取消 5 交付中（已出图、确认扣点中，按生成中展示） */
export const TASK_STATUS: Record<number, { text: string; color: string }> = {
  0: { text: '排队', color: 'default' },
  1: { text: '生成中', color: 'processing' },
  2: { text: '成功', color: 'success' },
  3: { text: '失败', color: 'error' },
  4: { text: '已取消', color: 'default' },
  5: { text: '交付中', color: 'processing' },
};

/** 子任务终态：2 / 3 / 4（5 交付中仍在进行） */
export const TASK_TERMINAL_STATUSES: readonly number[] = [2, 3, 4];

/** 计费状态：0 未计费 1 已冻结 2 已结算 3 已退回 4 影子模式 */
export const BILLING_STATUS: Record<number, { text: string; color: string }> = {
  0: { text: '未计费', color: 'default' },
  1: { text: '已冻结', color: 'processing' },
  2: { text: '已结算', color: 'success' },
  3: { text: '已退回', color: 'warning' },
  4: { text: '影子模式', color: 'purple' },
};

export const KIND_LABEL: Record<string, string> = {
  tryon: '商拍',
  pose: '姿态',
  imagegen: '图片生成',
};

export function statusTag(map: Record<number, { text: string; color: string }>, s: number) {
  return map[s] ?? { text: String(s), color: 'default' };
}

/** 日期范围 -> [起 00:00:00 含, 止次日 00:00:00 不含] 的 unix 毫秒 */
export function rangeToMs(range?: [Dayjs, Dayjs] | null): { startAt?: number; endAt?: number } {
  if (!range || !range[0] || !range[1]) return {};
  return {
    startAt: range[0].startOf('day').valueOf(),
    endAt: range[1].add(1, 'day').startOf('day').valueOf(),
  };
}

/** 解析后端 JSON 文本；空串 / 非法返回 fallback */
export function parseJson<T>(text: string | undefined | null, fallback: T): T {
  if (!text) return fallback;
  try {
    const v = JSON.parse(text);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
