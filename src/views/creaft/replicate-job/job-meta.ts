import type {
  FeedbackReason,
  JobStatus,
  ReplicateContinuity,
  SegmentBridge,
} from '@/api/replicate-admin';

export const STATUS_LABEL: Record<JobStatus, string> = {
  submitting: '提交中',
  queued: '排队中',
  running: '生成中',
  waiting: '待继续',
  continuing: '继续提交中',
  succeeded: '成功',
  partial: '部分成功',
  failed: '失败',
  canceled: '已取消',
};

export const statusColor = (s: JobStatus): string =>
  ({
    submitting: 'processing',
    queued: 'processing',
    running: 'processing',
    continuing: 'processing',
    waiting: 'gold',
    succeeded: 'green',
    partial: 'orange',
    failed: 'red',
    canceled: 'default',
  })[s] ?? 'default';

/** 预留 / 计费状态的颜色：已确认绿、已退蓝、冻结橙、其余灰 */
export const reservationColor = (s: string): string =>
  ({ CONFIRMED: 'green', REFUNDED: 'blue', HELD: 'orange' })[s] ?? 'default';

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      document.body.removeChild(el);
    }
  }
}

/** RFC3339 → 本地可读的 YYYY-MM-DD HH:mm:ss（北京时间）；解析不了原样返回 */
export function fmtTime(v?: string | null): string {
  if (!v) return '—';
  const t = Date.parse(v);
  if (Number.isNaN(t)) return v;
  return new Date(t + 8 * 3600_000).toISOString().slice(0, 19).replace('T', ' ');
}

/** 成片反馈权限（契约 §AB：Go 若按资源细分才有 replicate:feedback:view；否则沿用任务查看权限）。要切换只改这一处 */
export const FEEDBACK_VIEW_PERMISSION = 'replicate:view';

export const CONTINUITY_LABEL: Record<ReplicateContinuity, string> = {
  fast: '更快',
  smooth: '更连贯',
};

export const BRIDGE_LABEL: Record<SegmentBridge, string> = {
  used: '已衔接',
  skipped_prev_failed: '没衔接：上一段失败',
  skipped_no_frame: '没衔接：没有末帧',
  skipped_refs_full: '没衔接：参考图已满',
};

export const FEEDBACK_REASON_LABEL: Record<FeedbackReason, string> = {
  face_mismatch: '人不像',
  product_deformed: '商品变形',
  motion_weird: '动作奇怪',
  seam_jump: '接缝跳变',
  text_garbled: '画面有乱码',
  other: '其他',
};

export const reasonLabel = (r: string): string =>
  (FEEDBACK_REASON_LABEL as Record<string, string>)[r] ?? r;
export const continuityLabel = (c?: string): string =>
  c ? ((CONTINUITY_LABEL as Record<string, string>)[c] ?? c) : '—';
