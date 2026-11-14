import type { JobStatus } from '@/api/replicate-admin';

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
