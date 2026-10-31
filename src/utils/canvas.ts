import type { Dayjs } from 'dayjs';

/** run 状态（后端返回字符串）与筛选用的数值：0 排队 1 运行中 2 成功 3 失败 4 已取消 5 提交中 */
export const RUN_STATUS_OPTIONS: { value: number; text: string }[] = [
  { value: 0, text: '排队' },
  { value: 1, text: '运行中' },
  { value: 2, text: '成功' },
  { value: 3, text: '失败' },
  { value: 4, text: '已取消' },
  { value: 5, text: '提交中' },
];

export const RUN_STATUS: Record<string, { text: string; color: string }> = {
  submitting: { text: '提交中', color: 'processing' },
  queued: { text: '排队', color: 'default' },
  running: { text: '运行中', color: 'processing' },
  succeeded: { text: '成功', color: 'success' },
  failed: { text: '失败', color: 'error' },
  cancelled: { text: '已取消', color: 'default' },
  canceled: { text: '已取消', color: 'default' },
};

/** 未结束的 run 才能强制失败 */
export function isRunActive(status: string): boolean {
  return status === 'submitting' || status === 'queued' || status === 'running';
}

/** run 计费镜像（后端返回字符串） */
export const RUN_BILLING_STATUS: Record<string, { text: string; color: string }> = {
  none: { text: '未计费', color: 'default' },
  held: { text: '已冻结', color: 'processing' },
  settled: { text: '已结算', color: 'success' },
  unsettled: { text: '待对账', color: 'warning' },
  refunded: { text: '已退回', color: 'warning' },
  shadow: { text: '影子模式', color: 'purple' },
  java: { text: 'Java 计费', color: 'default' },
  studio: { text: 'Studio 计费', color: 'default' },
  review: { text: '待核查', color: 'warning' },
};

export const RUN_KIND_LABEL: Record<string, string> = {
  image: '图片',
  video: '视频',
  tool_crop: '工具-裁剪',
  tool_upscale: '工具-放大',
  tool_outpaint: '工具-扩图',
  tool_inpaint: '工具-重绘',
  tool_i2p: '工具-图转提示词',
  tool_tryon: '工具-试穿',
};

export const BACKEND_OPTIONS = ['gateway', 'media', 'java', 'studio'];

export const VERTICAL_LABEL: Record<string, string> = {
  ecommerce: '电商',
  general: '通用',
};

/** 日期范围 -> [起 00:00 含, 止次日 00:00 不含] 的 unix 毫秒（canvas 接口字段名为 start / end） */
export function rangeToStartEnd(range?: [Dayjs, Dayjs] | null): { start?: number; end?: number } {
  if (!range || !range[0] || !range[1]) return {};
  return {
    start: range[0].startOf('day').valueOf(),
    end: range[1].add(1, 'day').startOf('day').valueOf(),
  };
}

/** 统计 snapshot JSON 的节点 / 边数；非法返回 error */
export function inspectSnapshot(text: string): {
  ok: boolean;
  nodes: number;
  edges: number;
  error?: string;
} {
  if (!text.trim()) return { ok: false, nodes: 0, edges: 0, error: '请填写 snapshot' };
  try {
    const v = JSON.parse(text);
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
      return { ok: false, nodes: 0, edges: 0, error: '应为 {nodes, edges} 对象' };
    }
    if (!Array.isArray(v.nodes) || !Array.isArray(v.edges)) {
      return { ok: false, nodes: 0, edges: 0, error: 'nodes 与 edges 必须是数组' };
    }
    return { ok: true, nodes: v.nodes.length, edges: v.edges.length };
  } catch (e) {
    return { ok: false, nodes: 0, edges: 0, error: `JSON 格式错误：${(e as Error).message}` };
  }
}
